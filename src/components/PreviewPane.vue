<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { Icon } from "@iconify/vue";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItTaskLists from "markdown-it-task-lists";
import katexPlugin from "@vscode/markdown-it-katex";
import hljs from "highlight.js";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import hljsDarkCss from "highlight.js/styles/github-dark.css?inline";
import hljsLightCss from "highlight.js/styles/github.css?inline";
import "katex/dist/katex.min.css";
import { headingPxToProgress, headingProgressToPx } from "../utils/scrollSync";
import { useThemeStore } from "../stores/theme";
import { useUiStore } from "../stores/ui";
import { useI18n } from "../i18n";
import type { TocHeading } from "./TocPanel.vue";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useTabsStore } from "../stores/tabs";

const { t } = useI18n();


interface HeadingInfo extends TocHeading {
  offsetTop: number;
}

const props = defineProps<{
  source: string;
  filePath: string;
  scrollPercent: number;
  scrollToHeading?: number;
}>();

const emit = defineEmits<{
  (e: "scroll", pct: number): void;
  (e: "toggle-checklist", idx: number, checked: boolean): void;
}>();

const themeStore = useThemeStore();
const uiStore = useUiStore();
const tabs = useTabsStore();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: true,
  highlight: (code, lang) => {
    if (lang === "mermaid") return "";
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        /* noop */
      }
    }
    return hljs.highlightAuto(code).value;
  },
})
  .use(markdownItAnchor)
  .use(markdownItTaskLists)
  .use(katexPlugin);

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = (token.info || "").trim();
  if (info === "mermaid") {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

function dirname(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(0, idx) : "";
}

function isAbsolute(p: string): boolean {
  return /^([a-z]+:\/\/|data:|\/|[A-Za-z]:[\\/])/.test(p);
}

function joinAndNormalize(base: string, rel: string): string {
  const normBase = base.replace(/\\/g, "/");
  const normRel = rel.replace(/\\/g, "/");
  const isUnix = normBase.startsWith("/") || !/^[A-Za-z]:/.test(normBase);
  const winDrive = !isUnix ? normBase.slice(0, 2) : "";
  const baseBody = !isUnix ? normBase.slice(2) : normBase;
  const baseParts = baseBody.split("/").filter(Boolean);
  for (const p of normRel.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") baseParts.pop();
    else baseParts.push(p);
  }
  const leader = isUnix ? "/" : `${winDrive}/`;
  return leader + baseParts.join("/");
}

const html = ref("");
let debounceTimer: number | null = null;
let mermaidInitialized = false;
let renderSeq = 0;

const root = ref<HTMLDivElement | null>(null);
const lastPct = ref(0);
let resizeObs: ResizeObserver | null = null;
let bodyEl: HTMLElement | null = null;
const headings = ref<HeadingInfo[]>([]);
let previewScrollRafPending = false;
let previewSnapDebounce: number | null = null;

async function runMermaid(seq: number) {
  if (!root.value) return;
  const nodes = root.value.querySelectorAll<HTMLElement>("pre.mermaid");
  if (nodes.length === 0) return;
  const { default: mermaid } = await import("mermaid");
  if (seq !== renderSeq) return;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: themeStore.previewTheme === "dark" ? "dark" : "default",
      securityLevel: "loose",
    });
    mermaidInitialized = true;
  }
  try {
    await mermaid.run({ nodes: Array.from(nodes) });
  } catch (e) {
    console.error("mermaid render failed", e);
  }
}

function extractHeadings(): HeadingInfo[] {
  if (!root.value) return [];
  const els = root.value.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
  return Array.from(els).map((el) => ({
    id: el.id || "",
    text: el.textContent || "",
    level: parseInt(el.tagName[1]),
    offsetTop: el.offsetTop,
  }));
}

function getPreviewHeadingPx(): number[] {
  return headings.value.map((h) => h.offsetTop);
}

function findHeadingIndexAt(scrollTop: number): number {
  const px = getPreviewHeadingPx();
  for (let i = px.length - 1; i >= 0; i--) {
    if (px[i] <= scrollTop + 50) return i;
  }
  return -1;
}

function applyScroll() {
  if (!root.value) return;
  const px = getPreviewHeadingPx();
  const target = headingProgressToPx(lastPct.value, px, root.value.scrollHeight);
  if (Math.abs(root.value.scrollTop - target) > 2) {
    root.value.scrollTop = target;
  }
}

function applyHeadingScroll(index: number) {
  if (!root.value) return;
  const h = headings.value;
  if (index >= 0 && index < h.length) {
    const target = h[index].offsetTop;
    if (Math.abs(root.value.scrollTop - target) > 2) {
      root.value.scrollTop = target;
    }
  }
}

async function render() {
  const raw = md.render(props.source ?? "");
  let checkboxCount = 0;
  const processedHtml = raw.replace(/<input\s+([^>]*?)type="checkbox"([^>]*?)>/g, (_match, pre, post) => {
    let attrs = (pre + " " + post).replace(/\s*disabled(?:\s*=\s*(?:"[^"]*"|'[^']*'))?\s*/gi, " ").trim();
    const idx = checkboxCount++;
    return `<input type="checkbox" ${attrs} data-checklist-idx="${idx}" style="cursor: pointer; position: relative; top: 1px;">`;
  });
  
  const baseDir = dirname(props.filePath);
  html.value = processedHtml.replace(
    /<img\s+([^>]*?)src="([^"]+)"([^>]*)>/g,
    (_m, pre: string, src: string, post: string) => {
      if (!src || isAbsolute(src)) return `<img ${pre}src="${src}"${post}>`;
      const joined = baseDir ? joinAndNormalize(baseDir, src) : src;
      const url = convertFileSrc(joined);
      return `<img ${pre}src="${url}"${post}>`;
    }
  );
  const seq = ++renderSeq;
  await nextTick();
  headings.value = extractHeadings();
  const tocHeadings: TocHeading[] = headings.value.map(({ id, text, level }) => ({ id, text, level }));
  uiStore.setCurrentHeadings(tocHeadings);
  await runMermaid(seq);
}

watch(
  () => [props.source, props.filePath],
  () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void render();
    }, 150);
  },
  { immediate: true }
);

let hljsStyleEl: HTMLStyleElement | null = null;
function applyHljsTheme(theme: string) {
  if (!hljsStyleEl) {
    hljsStyleEl = document.createElement("style");
    hljsStyleEl.id = "hljs-theme";
    document.head.appendChild(hljsStyleEl);
  }
  hljsStyleEl.textContent = theme === "dark" ? hljsDarkCss : hljsLightCss;
}

watch(
  () => themeStore.previewTheme,
  (t) => {
    applyHljsTheme(t);
    mermaidInitialized = false;
    void render();
  }
);

watch(html, async () => {
  await nextTick();
  headings.value = extractHeadings();
  const tocHeadings: TocHeading[] = headings.value.map(({ id, text, level }) => ({ id, text, level }));
  uiStore.setCurrentHeadings(tocHeadings);
  if (!root.value) return;
  const next = root.value.querySelector<HTMLElement>(".markdown-body");
  if (next !== bodyEl) {
    resizeObs?.disconnect();
    bodyEl = next;
    if (bodyEl && resizeObs) resizeObs.observe(bodyEl);
  }
  applyScroll();
});

watch(
  () => props.scrollPercent,
  (pct) => {
    lastPct.value = pct;
    applyScroll();
  }
);

watch(
  () => props.scrollToHeading,
  (idx) => {
    if (idx !== undefined && idx >= 0) {
      applyHeadingScroll(idx);
    }
  }
);

onMounted(() => {
  applyHljsTheme(themeStore.previewTheme);
  resizeObs = new ResizeObserver(() => {
    headings.value = extractHeadings();
    const tocHeadings: TocHeading[] = headings.value.map(({ id, text, level }) => ({ id, text, level }));
    uiStore.setCurrentHeadings(tocHeadings);
    applyScroll();
  });
  if (root.value) {
    bodyEl = root.value.querySelector<HTMLElement>(".markdown-body");
    if (bodyEl) resizeObs.observe(bodyEl);
  }
});

function buildStandaloneHtml(title: string, forPrint = false): string {
  const bodyHtml = bodyEl ? bodyEl.innerHTML : html.value;
  const effectiveTheme = forPrint ? "light" : themeStore.previewTheme;
  const hljsCss = effectiveTheme === "dark" ? hljsDarkCss : hljsLightCss;
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  const printScript = forPrint
    ? `<script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 500); });<\/script>`
    : "";
  const printCss = forPrint
    ? `<style media="print">
@page { margin: 2cm; size: A4; }
body { font-size: 11pt; line-height: 1.6; color: #000; background: #fff; }
.markdown-body { max-width: 100%; padding: 0; }
pre, code { background: #f5f5f5 !important; border: 1px solid #ddd; page-break-inside: avoid; }
h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
img { max-width: 100%; page-break-inside: avoid; }
table { page-break-inside: avoid; }
.mermaid svg { background: #fff !important; }
</style>`
    : "";

  return `<!doctype html>
<html data-theme="${effectiveTheme}">
<head>
<meta charset="utf-8">
<title>${escapedTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>${hljsCss}</style>
<style>${BASE_EXPORT_CSS}</style>${printCss}
</head>
<body>
<main class="markdown-body">${bodyHtml}</main>${printScript}
</body>
</html>`;
}

const BASE_EXPORT_CSS = `
:root { color-scheme: light dark; }
html[data-theme="dark"] { --bg:#1e1e1e; --text:#cccccc; --muted:#858585; --border:#3c3c3c; --link:#4daafc; --code-bg:#0d1117; --inline-code-bg:rgba(255,255,255,0.08); }
html[data-theme="light"] { --bg:#ffffff; --text:#333333; --muted:#6e6e6e; --border:#d4d4d4; --link:#0366d6; --code-bg:#f6f8fa; --inline-code-bg:rgba(0,0,0,0.06); }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.markdown-body { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { margin: 1.4em 0 0.5em; font-weight:600; line-height:1.25; }
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body p { margin: 0 0 1em; }
.markdown-body a { color: var(--link); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body code { background: var(--inline-code-bg); padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
.markdown-body pre { background: var(--code-bg); padding: 14px 16px; border-radius: 4px; overflow-x: auto; }
.markdown-body pre code { background: transparent; padding: 0; font-size: 0.875em; display: block; }
.markdown-body pre.mermaid { background: transparent; text-align: center; padding: 12px 0; }
.markdown-body blockquote { border-left: 3px solid var(--border); margin: 0 0 1em; padding: 0 1em; color: var(--muted); }
.markdown-body ul, .markdown-body ol { padding-left: 1.6em; }
.markdown-body table { border-collapse: collapse; display: block; overflow-x: auto; margin: 0 0 1em; }
.markdown-body th, .markdown-body td { border: 1px solid var(--border); padding: 6px 12px; }
.markdown-body img { max-width: 100%; height: auto; }
.markdown-body hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
.markdown-body .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; }
`;

function onUserScroll() {
  if (previewScrollRafPending) return;
  previewScrollRafPending = true;
  requestAnimationFrame(() => {
    previewScrollRafPending = false;
    if (!root.value) return;
    const el = root.value;
    const px = getPreviewHeadingPx();
    const progress = headingPxToProgress(el.scrollTop, px, el.scrollHeight);
    
    lastPct.value = progress;
    emit("scroll", progress);
    
    if (previewSnapDebounce !== null) clearTimeout(previewSnapDebounce);
    previewSnapDebounce = window.setTimeout(() => {
      previewSnapDebounce = null;
      if (!root.value) return;
      const idx = findHeadingIndexAt(root.value.scrollTop);
      if (idx >= 0) {
        uiStore.setActiveHeadingIndex(idx);
      }
    }, 300);
  });
}

async function exportForPrint(title: string) {
  const html = buildStandaloneHtml(title, true);
  try {
    const path = await invoke<string>("write_temp_html", { html, baseName: title });
    await openPath(path);
  } catch (e) {
    console.error("exportForPrint failed", e);
  }
}

function onCheckboxChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target && target.type === "checkbox" && target.hasAttribute("data-checklist-idx")) {
    const idx = parseInt(target.getAttribute("data-checklist-idx") || "0", 10);
    emit("toggle-checklist", idx, target.checked);
  }
}

async function onPreviewClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const anchor = target.closest("a");
  if (!anchor) return;
  e.preventDefault();

  const href = anchor.getAttribute("href") ?? "";
  if (!href || href.startsWith("#")) return;

  if (/^https?:\/\//i.test(href)) {
    const confirmed = window.confirm(`Open in browser?\n${href}`);
    if (confirmed) await openUrl(href);
    return;
  }

  if (!isAbsolute(href)) {
    const baseDir = dirname(props.filePath);
    const resolved = baseDir ? joinAndNormalize(baseDir, href) : href;
    const filename = resolved.replace(/\\/g, "/").split("/").pop() ?? resolved;
    await tabs.openFile(resolved, filename);
  }
}

defineExpose({
  buildStandaloneHtml,
  exportForPrint,
});

const isEmpty = computed(() => !props.source || props.source.trim() === "");
</script>

<template>
  <div class="preview-wrap">
    <div class="preview-toolbar">
      <button class="icon-btn" :title="t('preview.print')" @click="exportForPrint(props.filePath.replace(/\\/g, '/').split('/').pop() ?? 'preview')">
        <Icon icon="lucide:printer" width="16" height="16" />
      </button>
      <button class="icon-btn" :title="themeStore.previewTheme === 'dark' ? t('preview.light') : t('preview.dark')" @click="themeStore.togglePreviewTheme()">
        <Icon :icon="themeStore.previewTheme === 'dark' ? 'lucide:sun' : 'lucide:moon'" width="16" height="16" />
      </button>
    </div>
    <div ref="root" class="preview-pane" :data-theme="themeStore.previewTheme" @scroll.passive="onUserScroll" @change="onCheckboxChange" @click="onPreviewClick">
      <div v-if="isEmpty" class="preview-empty">{{ t('preview.empty') }}</div>
      <div v-else class="markdown-body" v-html="html"></div>
    </div>
  </div>
</template>

<style>
.preview-toolbar .icon-btn {
  width: 26px !important;
  height: 26px !important;
}

.preview-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  flex: 0 0 auto;
}

.preview-pane {
  flex: 1;
  width: 100%;
  overflow: auto;
  padding: 24px 32px;
  background: var(--bg-app);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.6;
  user-select: text;
}

/* scoped CSS vars so preview theme is independent of app theme */
.preview-pane[data-theme="dark"] {
  --bg-app: #1e1e1e;
  --bg-sidebar: #252526;
  --bg-hover: #2a2d2e;
  --bg-code: #0d1117;
  --border: #3c3c3c;
  --text: #cccccc;
  --text-muted: #858585;
  --link: #4daafc;
}

.preview-pane[data-theme="light"] {
  --bg-app: #ffffff;
  --bg-sidebar: #f3f3f3;
  --bg-hover: #e8e8e8;
  --bg-code: #f6f8fa;
  --border: #d4d4d4;
  --text: #333333;
  --text-muted: #6e6e6e;
  --link: #0366d6;
}

.preview-empty {
  color: var(--text-muted);
  text-align: center;
  margin-top: 40px;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 1.4em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body h1 {
  font-size: 1.8em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.4em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.2em;
}

.markdown-body p {
  margin: 0 0 1em 0;
}

.markdown-body a {
  color: var(--link);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body code {
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.markdown-body pre {
  background: var(--bg-code);
  padding: 12px 16px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0 0 1em 0;
}

.markdown-body pre.mermaid {
  background: transparent;
  padding: 12px 0;
  text-align: center;
  overflow-x: auto;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  display: block;
}

.markdown-body blockquote {
  border-left: 3px solid var(--border);
  margin: 0 0 1em 0;
  padding: 0 1em;
  color: var(--text-muted);
}

.markdown-body ul,
.markdown-body ol {
  margin: 0 0 1em 0;
  padding-left: 1.6em;
}

.markdown-body ul {
  list-style-type: disc;
}

.markdown-body ol {
  list-style-type: decimal;
}

.markdown-body ul ul {
  list-style-type: circle;
}

.markdown-body ul ul ul {
  list-style-type: square;
}

.markdown-body ol ol {
  list-style-type: lower-alpha;
}

.markdown-body ol ol ol {
  list-style-type: lower-roman;
}

.markdown-body li {
  margin-bottom: 0.2em;
}

.markdown-body li.task-list-item {
  list-style: none;
}

.markdown-body li.task-list-item > p {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 0;
}

.markdown-body input[type="checkbox"] {
  margin-top: 3px;
  flex-shrink: 0;
  cursor: pointer;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 0 0 1em 0;
  display: block;
  overflow-x: auto;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 6px 12px;
}

.markdown-body th {
  background: var(--bg-sidebar);
  font-weight: 600;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}

.markdown-body del {
  color: var(--text-muted);
}

.markdown-body .katex-display {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
