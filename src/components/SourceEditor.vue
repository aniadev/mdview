<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { useThemeStore } from "../stores/theme";

const themeStore = useThemeStore();

const props = defineProps<{
  modelValue: string;
  tabKey: string;
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

function build(initial: string): EditorView {
  const baseExt = [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown(),
  ];
  const themeExt = themeStore.theme === "dark" ? [oneDark] : [];
  const state = EditorState.create({
    doc: initial,
    extensions: [
      ...baseExt,
      ...themeExt,
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
        if (upd.docChanged && !suppressEmit) {
          emit("update:modelValue", upd.state.doc.toString());
        }
      }),
      EditorView.domEventHandlers({
        scroll: (_e, v) => {
          const el = v.scrollDOM;
          const max = el.scrollHeight - el.clientHeight;
          const pct = max > 0 ? el.scrollTop / max : 0;
          emit("scroll", pct);
        },
      }),
    ],
  });
  return new EditorView({ state, parent: host.value! });
}

onMounted(() => {
  view = build(props.modelValue);
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
  }
);

watch(
  () => themeStore.theme,
  () => {
    if (!view || !host.value) return;
    const current = view.state.doc.toString();
    view.destroy();
    view = build(current);
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
</script>

<template>
  <div class="source-editor-wrap">
    <div class="md-toolbar" role="toolbar">
      <button class="tb-btn" title="Bold (Cmd/Ctrl+B)" @click="actBold"><strong>B</strong></button>
      <button class="tb-btn" title="Italic (Cmd/Ctrl+I)" @click="actItalic"><em>I</em></button>
      <button class="tb-btn" title="Heading (cycle H1-H3)" @click="actHeading">
        <span class="tb-h">H</span>
      </button>
      <button class="tb-btn" title="Underline" @click="actUnderline"><span style="text-decoration: underline">U</span></button>
      <button class="tb-btn" title="Strikethrough" @click="actStrike"><span style="text-decoration: line-through">S</span></button>
      <span class="tb-sep"></span>
      <button class="tb-btn" title="Ordered list" @click="actOl">1.</button>
      <button class="tb-btn" title="Unordered list" @click="actUl">•</button>
      <button class="tb-btn" title="Checklist" @click="actCheck">☐</button>
      <span class="tb-sep"></span>
      <button class="tb-btn" title="Quote" @click="actQuote">❝</button>
      <button class="tb-btn" title="Code block" @click="actCode">&lt;/&gt;</button>
      <button class="tb-btn" title="Table" @click="actTable">⊞</button>
      <span class="tb-sep"></span>
      <button class="tb-btn" title="Link" @click="actLink">↗</button>
      <button class="tb-btn" title="Image" @click="actImage">🖼</button>
      <span class="tb-spacer"></span>
      <button class="tb-btn" title="Open preview in browser" @click="emit('open-browser')">⧉</button>
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

.tb-h {
  font-weight: 700;
  font-size: 14px;
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
