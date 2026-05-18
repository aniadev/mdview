<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import katexPlugin from "@vscode/markdown-it-katex";
import hljs from "highlight.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import hljsDarkCss from "highlight.js/styles/github-dark.css?inline";
import hljsLightCss from "highlight.js/styles/github.css?inline";
import "katex/dist/katex.min.css";
import { useThemeStore } from "../stores/theme";

const props = defineProps<{
  source: string;
  filePath: string;
  scrollPercent: number;
}>();

const themeStore = useThemeStore();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
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

async function runMermaid(seq: number) {
  if (!root.value) return;
  const nodes = root.value.querySelectorAll<HTMLElement>("pre.mermaid");
  if (nodes.length === 0) return;
  const { default: mermaid } = await import("mermaid");
  if (seq !== renderSeq) return;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: themeStore.theme === "dark" ? "dark" : "default",
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

async function render() {
  const raw = md.render(props.source ?? "");
  const baseDir = dirname(props.filePath);
  html.value = raw.replace(
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
  () => themeStore.theme,
  (t) => {
    applyHljsTheme(t);
    mermaidInitialized = false;
    void render();
  }
);

onBeforeUnmount(() => {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  resizeObs?.disconnect();
  resizeObs = null;
  bodyEl = null;
});

const root = ref<HTMLDivElement | null>(null);
const lastPct = ref(0);
let resizeObs: ResizeObserver | null = null;
let bodyEl: HTMLElement | null = null;

function applyScroll() {
  if (!root.value) return;
  const max = root.value.scrollHeight - root.value.clientHeight;
  if (max <= 0) return;
  const target = Math.round(lastPct.value * max);
  if (Math.abs(root.value.scrollTop - target) > 2) {
    root.value.scrollTop = target;
  }
}

watch(
  () => props.scrollPercent,
  (pct) => {
    lastPct.value = pct;
    applyScroll();
  }
);

watch(html, async () => {
  await nextTick();
  if (!root.value) return;
  const next = root.value.querySelector<HTMLElement>(".markdown-body");
  if (next !== bodyEl) {
    resizeObs?.disconnect();
    bodyEl = next;
    if (bodyEl && resizeObs) resizeObs.observe(bodyEl);
  }
  applyScroll();
});

onMounted(() => {
  applyHljsTheme(themeStore.theme);
  resizeObs = new ResizeObserver(() => applyScroll());
  if (root.value) {
    bodyEl = root.value.querySelector<HTMLElement>(".markdown-body");
    if (bodyEl) resizeObs.observe(bodyEl);
  }
});

function buildStandaloneHtml(title: string): string {
  const bodyHtml = bodyEl ? bodyEl.innerHTML : html.value;
  const hljsCss = themeStore.theme === "dark" ? hljsDarkCss : hljsLightCss;
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html data-theme="${themeStore.theme}">
<head>
<meta charset="utf-8">
<title>${escapedTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>${hljsCss}</style>
<style>${BASE_EXPORT_CSS}</style>
</head>
<body>
<main class="markdown-body">${bodyHtml}</main>
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

defineExpose({
  buildStandaloneHtml,
});

const isEmpty = computed(() => !props.source || props.source.trim() === "");
</script>

<template>
  <div ref="root" class="preview-pane">
    <div v-if="isEmpty" class="preview-empty">Preview will appear here.</div>
    <div v-else class="markdown-body" v-html="html"></div>
  </div>
</template>

<style>
.preview-pane {
  height: 100%;
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

.markdown-body li {
  margin-bottom: 0.2em;
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
