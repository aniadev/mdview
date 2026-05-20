<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { Icon } from "@iconify/vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { headingPxToProgress, headingProgressToPx } from "../utils/scrollSync";
import { useThemeStore } from "../stores/theme";
import { useUiStore } from "../stores/ui";
import { useI18n } from "../i18n";

const themeStore = useThemeStore();
const uiStore = useUiStore();
const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  tabKey: string;
  scrollPercent?: number;
  scrollToHeading?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "scroll", percent: number): void;
  (e: "save"): void;
  (e: "open-browser"): void;
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let suppressEmit = false;
let scrollRafPending = false;
let snapDebounce: number | null = null;
const wordWrap = ref(false);
const editorHeadings = ref<{ line: number; level: number }[]>([]);

function updateEditorHeadings(source: string) {
  const result: { line: number; level: number }[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m) result.push({ line: i + 1, level: m[1].length });
  }
  editorHeadings.value = result;
}



function getEditorHeadingPx(): number[] {
  if (!view) return [];
  const positions: number[] = [];
  for (const h of editorHeadings.value) {
    const block = view.lineBlockAt(view.state.doc.line(h.line).from);
    if (block) positions.push(block.top);
  }
  return positions;
}

function findHeadingIdxFromPx(headPx: number[], scrollTop: number): number {
  for (let i = headPx.length - 1; i >= 0; i--) {
    if (headPx[i] <= scrollTop + 2) return i;
  }
  return -1;
}

function build(initial: string): EditorView {
  const wrapExt = wordWrap.value ? [EditorView.lineWrapping] : [];
  const baseExt = [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown(),
    keymap.of([...searchKeymap]),
    highlightSelectionMatches(),
  ];
  const themeExt = themeStore.theme === "dark" ? [oneDark] : [];
  const state = EditorState.create({
    doc: initial,
    extensions: [
      ...baseExt,
      ...themeExt,
      ...wrapExt,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            emit("save");
            return true;
          },
        },
        { key: "Mod-b", preventDefault: true, run: () => (wrapSelection("**", "**"), true) },
        { key: "Mod-i", preventDefault: true, run: () => (wrapSelection("*", "*"), true) },
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((upd) => {
        if (upd.docChanged) {
          updateEditorHeadings(upd.state.doc.toString());
          if (!suppressEmit) {
            emit("update:modelValue", upd.state.doc.toString());
          }
        }
      }),
      EditorView.domEventHandlers({
        scroll: (_e, v) => {
          if (scrollRafPending) return;
          scrollRafPending = true;
          requestAnimationFrame(() => {
            scrollRafPending = false;
            const el = v.scrollDOM;
            const headPx = getEditorHeadingPx();
            const progress = headingPxToProgress(el.scrollTop, headPx, el.scrollHeight);
            
            emit("scroll", progress);
            if (snapDebounce !== null) clearTimeout(snapDebounce);
            snapDebounce = window.setTimeout(() => {
              snapDebounce = null;
              if (!v) return;
              const px = getEditorHeadingPx();
              const idx = findHeadingIdxFromPx(px, v.scrollDOM.scrollTop);
              if (idx >= 0) uiStore.setActiveHeadingIndex(idx);
            }, 300);
          });
        },
      }),
    ],
  });
  return new EditorView({ state, parent: host.value! });
}

onMounted(() => {
  view = build(props.modelValue);
  updateEditorHeadings(props.modelValue);
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

watch(
  () => props.tabKey,
  () => {
    if (!view || !host.value) return;
    view.destroy();
    view = build(props.modelValue);
    updateEditorHeadings(props.modelValue);
  }
);

watch(
  () => themeStore.theme,
  () => {
    if (!view || !host.value) return;
    const current = view.state.doc.toString();
    view.destroy();
    view = build(current);
    updateEditorHeadings(current);
  }
);

watch(
  () => props.modelValue,
  (next) => {
    if (!view) return;
    if (next === view.state.doc.toString()) return;
    suppressEmit = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
    suppressEmit = false;
  }
);

watch(
  () => props.scrollPercent,
  (pct) => {
    if (pct === undefined || !view) return;
    const dom = view.scrollDOM;
    const headPx = getEditorHeadingPx();
    const target = headingProgressToPx(pct, headPx, dom.scrollHeight);
    if (Math.abs(dom.scrollTop - target) > 2) {
      dom.scrollTop = target;
    }
  }
);

watch(
  () => props.scrollToHeading,
  (idx) => {
    if (idx === undefined || idx < 0 || !view) return;
    const headings = editorHeadings.value;
    if (idx >= headings.length) return;
    const line = view.state.doc.line(headings[idx].line);
    const dom = view.scrollDOM;
    const headPx = getEditorHeadingPx();
    const target = headPx.length > 0
      ? headingProgressToPx((idx + 1) / (headPx.length + 1), headPx, dom.scrollHeight)
      : (line.from / view.state.doc.length) * dom.scrollHeight;
    if (Math.abs(dom.scrollTop - target) > 2) {
      dom.scrollTop = target;
    }
  }
);

function wrapSelection(before: string, after: string, placeholder = "text") {
  if (!view) return;
  view.focus();
  const sel = view.state.selection.main;
  const selected = view.state.sliceDoc(sel.from, sel.to);
  const text = selected.length > 0 ? selected : placeholder;
  const insert = `${before}${text}${after}`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: selected.length > 0
      ? { anchor: sel.from + before.length, head: sel.from + before.length + text.length }
      : { anchor: sel.from + before.length, head: sel.from + before.length + text.length },
  });
}

function prefixLines(prefix: string | ((lineNum: number) => string)) {
  if (!view) return;
  view.focus();
  const sel = view.state.selection.main;
  const startLine = view.state.doc.lineAt(sel.from);
  const endLine = view.state.doc.lineAt(sel.to);
  const changes: { from: number; insert: string }[] = [];
  let n = 1;
  for (let ln = startLine.number; ln <= endLine.number; ln++) {
    const line = view.state.doc.line(ln);
    const p = typeof prefix === "function" ? prefix(n++) : prefix;
    changes.push({ from: line.from, insert: p });
  }
  view.dispatch({ changes });
}

function toggleHeading() {
  if (!view) return;
  view.focus();
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const m = line.text.match(/^(#{1,6})\s/);
  if (!m) {
    view.dispatch({ changes: { from: line.from, insert: "# " } });
    return;
  }
  const level = m[1].length;
  if (level < 3) {
    view.dispatch({
      changes: { from: line.from, to: line.from + m[1].length, insert: "#".repeat(level + 1) },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from + m[0].length, insert: "" },
    });
  }
}

function insertBlock(text: string, cursorOffset?: number) {
  if (!view) return;
  view.focus();
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const lineAt = doc.lineAt(sel.from);
  const atLineStart = sel.from === lineAt.from;
  const prefix = atLineStart ? "" : "\n";
  const full = `${prefix}${text}`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: full },
    selection: {
      anchor: sel.from + (cursorOffset !== undefined ? prefix.length + cursorOffset : full.length),
    },
  });
}

function actBold() { wrapSelection("**", "**", "bold"); }
function actItalic() { wrapSelection("*", "*", "italic"); }
function actStrike() { wrapSelection("~~", "~~", "strikethrough"); }
function actUnderline() { wrapSelection("<u>", "</u>", "underline"); }
function actHeading() { toggleHeading(); }
function actQuote() { prefixLines("> "); }
function actUl() { prefixLines("- "); }
function actOl() { prefixLines((n) => `${n}. `); }
function actCheck() { prefixLines("- [ ] "); }
function actCode() {
  if (!view) return;
  const sel = view.state.selection.main;
  const selected = view.state.sliceDoc(sel.from, sel.to);
  const body = selected.length > 0 ? selected : "code";
  insertBlock("```\n" + body + "\n```\n", 4);
}
function actTable() {
  const t = "| Header | Header |\n| --- | --- |\n| Cell | Cell |\n";
  insertBlock(t);
}
function actLink() { wrapSelection("[", "](https://)", "text"); }
function actImage() { wrapSelection("![", "](https://)", "alt"); }

function toggleWrap() {
  wordWrap.value = !wordWrap.value;
  if (!view || !host.value) return;
  const current = view.state.doc.toString();
  view.destroy();
  view = build(current);
}
</script>

<template>
  <div class="source-editor-wrap">
    <div class="md-toolbar" role="toolbar">
      <button class="tb-btn" :title="t('toolbar.bold')" @click="actBold"><Icon icon="lucide:bold" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.italic')" @click="actItalic"><Icon icon="lucide:italic" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.heading')" @click="actHeading"><Icon icon="lucide:heading" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.underline')" @click="actUnderline"><Icon icon="lucide:underline" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.strikethrough')" @click="actStrike"><Icon icon="lucide:strikethrough" width="14" height="14" /></button>
      <span class="tb-sep"></span>
      <button class="tb-btn" :title="t('toolbar.orderedList')" @click="actOl"><Icon icon="lucide:list-ordered" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.unorderedList')" @click="actUl"><Icon icon="lucide:list" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.checklist')" @click="actCheck"><Icon icon="lucide:list-checks" width="14" height="14" /></button>
      <span class="tb-sep"></span>
      <button class="tb-btn" :title="t('toolbar.quote')" @click="actQuote"><Icon icon="lucide:quote" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.codeBlock')" @click="actCode"><Icon icon="lucide:code" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.table')" @click="actTable"><Icon icon="lucide:table" width="14" height="14" /></button>
      <span class="tb-sep"></span>
      <button class="tb-btn" :title="t('toolbar.link')" @click="actLink"><Icon icon="lucide:link" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.image')" @click="actImage"><Icon icon="lucide:image" width="14" height="14" /></button>
      <span class="tb-spacer"></span>
      <button class="tb-btn" :class="{ active: wordWrap }" :title="t('toolbar.wordWrap')" @click="toggleWrap"><Icon icon="lucide:wrap-text" width="14" height="14" /></button>
      <button class="tb-btn" :title="t('toolbar.openBrowser')" @click="emit('open-browser')"><Icon icon="lucide:external-link" width="14" height="14" /></button>
    </div>
    <div ref="host" class="source-editor"></div>
  </div>
</template>

<style>
.source-editor-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
}

.md-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  flex: 0 0 auto;
  overflow-x: auto;
}

.tb-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 28px;
  height: 26px;
  padding: 0;
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.tb-btn:active {
  background: var(--bg-selected);
}

.tb-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 4px;
}

.tb-spacer {
  flex: 1;
}

.source-editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-app);
}

.source-editor .cm-editor {
  height: 100%;
  font-family: var(--font-mono);
  font-size: 13px;
}

.source-editor .cm-scroller {
  font-family: var(--font-mono);
}
</style>
