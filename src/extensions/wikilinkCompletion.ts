import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import type { MdFile } from '../stores/palette';

export function wikilinkCompletion(getFiles: () => MdFile[]): Extension {
  function source(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/\[\[[^\]]*$/);
    if (!match) return null;

    const files = getFiles();
    const options = files.map((f) => {
      const label = f.name.replace(/\.md$/i, '');
      return {
        label,
        detail: f.rel_path,
        apply: (view: EditorView, _c: unknown, from: number, to: number) => {
          view.dispatch({ changes: { from, to, insert: label + ']]' } });
        },
      };
    });

    return { from: match.from + 2, options, filter: true };
  }

  return autocompletion({ override: [source] });
}
