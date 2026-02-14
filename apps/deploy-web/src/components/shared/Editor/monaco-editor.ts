/**
 * Monaco ESM "feature wiring" imports.
 * Sorted into categories with short purpose comments.
 *
 * taken from: node_modules/monaco-editor/esm/vs/editor/edcore.main.js
 */

/** eslint-disable simple-import-sort/imports */
//
// ============================================================================
// 0) Bootstrap / initialization
// ============================================================================
import "monaco-editor/esm/vs/editor/internal/initialize.js"; // Initializes standalone editor services/registries used by many contribs
// ============================================================================
// 1) Core editor widgets (required for any editor UI)
// ============================================================================
import "monaco-editor/esm/vs/editor/browser/coreCommands.js"; // Registers core editor commands & keybindings (basic editing commands)
import "monaco-editor/esm/vs/editor/browser/widget/codeEditor/codeEditorWidget.js"; // The standalone code editor widget (main editor UI)
// import 'monaco-editor/esm/vs/editor/browser/widget/diffEditor/diffEditor.contribution.js'; // Diff editor widget contribution (side-by-side diff UI)
// ============================================================================
// 2) Basic editing ergonomics (typing, selection, cursor behavior, clipboard)
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/anchorSelect/browser/anchorSelect.js'; // Expand selection from anchor / selection utilities
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js"; // Bracket pair matching + highlight
import "monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations.js"; // Cursor/caret operations (move/insert caret actions)
// import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/transpose.js'; // Transpose characters/words actions
import "monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js"; // Cut/copy/paste commands + clipboard integration
import "monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js"; // Toggle line/block comment commands (language-aware)
import "monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo.js"; // Cursor position undo/redo (navigate cursor history)
import "monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation.js"; // Indent/outdent (Tab/Shift+Tab) and indentation commands
// import 'monaco-editor/esm/vs/editor/contrib/insertFinalNewLine/browser/insertFinalNewLine.js'; // Insert final newline command / normalization
import "monaco-editor/esm/vs/editor/contrib/lineSelection/browser/lineSelection.js"; // Line selection behavior enhancements
import "monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js"; // Move/copy/sort/duplicate lines and similar ops
import "monaco-editor/esm/vs/editor/contrib/middleScroll/browser/middleScroll.contribution.js"; // Middle-click auto-scroll behavior
// import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js'; // Multi-cursor support & commands
import "monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect.js"; // Smart expand/shrink selection (semantic selection)
import "monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js"; // Toggle whether Tab moves focus vs indents
import "monaco-editor/esm/vs/editor/contrib/unusualLineTerminators/browser/unusualLineTerminators.js"; // Detect/unify unusual line terminators
// import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js'; // Word-level cursor/edit operations
// import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations.js'; // Sub-word (camelCase/snake_case) operations
import "monaco-editor/esm/vs/editor/contrib/readOnlyMessage/browser/contribution.js"; // Shows “read-only” message/UX when editor is read-only
// ============================================================================
// 3) UI interactions (context menu, drag&drop, drop/paste UX, floating menus)
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js'; // Right-click context menu framework for editor
// import 'monaco-editor/esm/vs/editor/contrib/dnd/browser/dnd.js'; // Drag & drop integration (drag selection/text)
import "monaco-editor/esm/vs/editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js"; // Paste-related contributions (e.g., paste providers/hooks)
// import 'monaco-editor/esm/vs/editor/contrib/dropOrPasteInto/browser/dropIntoEditorContribution.js'; // Drop-into-editor providers/hooks (drop targets & transforms)
import "monaco-editor/esm/vs/editor/contrib/floatingMenu/browser/floatingMenu.contribution.js"; // Floating context/action menu (inline UI actions)
// ============================================================================
// 4) IntelliSense / language UX (suggest, hover, parameter hints, snippets)
// ============================================================================
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js"; // Hover UI (tooltip on hover)
// import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints.js'; // Signature/parameter hints UI
import "monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js"; // Snippet insertion & navigation (tabstops/placeholders)
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js"; // Suggest widget (Ctrl/Cmd+Space autocomplete list)
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestInlineCompletions.js"; // Bridges suggest with inline completions in some flows
// import 'monaco-editor/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletions.contribution.js'; // Inline/ghost-text completions (Copilot-like)
// import 'monaco-editor/esm/vs/editor/contrib/inlineProgress/browser/inlineProgress.js'; // Inline progress UI (spinner) for async inline features
// import 'monaco-editor/esm/vs/editor/contrib/inlayHints/browser/inlayHintsContribution.js'; // Inlay hints UI (inline annotations)
// import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing.js'; // Linked editing ranges (edit mirrored parts together)
// ============================================================================
// 5) Diagnostics & code actions (errors, quick fixes, refactors)
// ============================================================================
import "monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions.js"; // Lightbulb + code actions UI (quick fixes/refactors)
import "monaco-editor/esm/vs/editor/contrib/gotoError/browser/gotoError.js"; // Navigate markers (next/prev error, F8)
// ============================================================================
// 6) Navigation & symbol tooling (go-to, rename, symbols, references)
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/documentSymbols.js'; // Document symbol provider UI integration
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands.js'; // Go-to commands (definition/type/implementation/symbol, etc.)
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.js'; // Ctrl/Cmd+click go-to-definition link support
// import 'monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js'; // Rename symbol UI + command
// import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js'; // Standalone references search UI
// ============================================================================
// 7) Search & find/replace
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js'; // Find/Replace widget (Ctrl/Cmd+F)
// ============================================================================
// 8) Formatting & styling helpers
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js'; // Format document/selection actions (uses registered formatters)
// import 'monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorPickerContribution.js'; // Color picker UI when color tokens are detected
// import 'monaco-editor/esm/vs/editor/contrib/fontZoom/browser/fontZoom.js'; // Editor font zoom actions (increase/decrease font size)
// ============================================================================
// 9) Folding, layout, and readability helpers
// ============================================================================
import "monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js"; // Code folding (fold/unfold regions)
import "monaco-editor/esm/vs/editor/contrib/longLinesHelper/browser/longLinesHelper.js"; // Long-line handling helpers (performance/UX)
import "monaco-editor/esm/vs/editor/contrib/placeholderText/browser/placeholderText.contribution.js"; // Placeholder text when editor is empty
import "monaco-editor/esm/vs/editor/contrib/sectionHeaders/browser/sectionHeaders.js"; // Section headers / header decorations for readability
// import 'monaco-editor/esm/vs/editor/contrib/stickyScroll/browser/stickyScrollContribution.js'; // Sticky scroll (keep context headers visible)
import "monaco-editor/esm/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.js"; // Highlight potentially confusing unicode characters
// ============================================================================
// 10) Tokenization & semantic highlighting
// ============================================================================
import "monaco-editor/esm/vs/editor/contrib/tokenization/browser/tokenization.js"; // Tokenization pipeline (syntax highlighting foundation)
import "monaco-editor/esm/vs/editor/contrib/semanticTokens/browser/documentSemanticTokens.js"; // Document-level semantic tokens
import "monaco-editor/esm/vs/editor/contrib/semanticTokens/browser/viewportSemanticTokens.js"; // Viewport semantic tokens (perf-friendly)
// ============================================================================
// 11) Links, word highlights, and minor editor assists
// ============================================================================
import "monaco-editor/esm/vs/editor/contrib/links/browser/links.js"; // Detect clickable links + Ctrl/Cmd+click navigation
import "monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js"; // Highlights occurrences of word under cursor
import "monaco-editor/esm/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.js"; // In-place replace UI (replace mode / inline replace)
// ============================================================================
// 12) Codelens (inline actions above symbols)
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/codelens/browser/codelensController.js'; // CodeLens UI (inline actionable annotations)
// ============================================================================
// 13) GPU-related actions (debug/toggles)
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/gpu/browser/gpuActions.js'; // Commands for GPU acceleration/debugging
// ============================================================================
// 14) Diff-editor related UI extras
// ============================================================================
// import 'monaco-editor/esm/vs/editor/contrib/diffEditorBreadcrumbs/browser/contribution.js'; // Breadcrumbs for diff editor navigation/context
// ============================================================================
// 15) Standalone strings + icons + platform helpers (standalone UX polish)
// ============================================================================
import "monaco-editor/esm/vs/editor/common/standaloneStrings.js"; // Localized strings for standalone editor UI
import "monaco-editor/esm/vs//base/browser/ui/codicons/codicon/codicon.css"; // Codicon base icon font CSS (as requested with vs/editor prefix)
import "monaco-editor/esm/vs//base/browser/ui/codicons/codicon/codicon-modifiers.css"; // Codicon modifiers CSS
import "monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js"; // iPad/iOS Safari keyboard focus workaround
// import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js'; // “Inspect Tokens” dev tool (token inspection UI)
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js'; // Quick access: help
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js'; // Quick access: go to line
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js'; // Quick access: go to symbol
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js'; // Quick access: command palette
// import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js'; // Toggle high-contrast mode (accessibility)
// ============================================================================
// 16) Supported languages
// ============================================================================
// NOTE: Do NOT import from monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js
// Those files import ALL editor contributions, negating our selective imports.
// Instead, we copied the YAML language definition here:
import "./monaco-yaml-definitions";
import "./monaco-log-definitions";

import { editor, MarkerSeverity } from "monaco-editor/esm/vs/editor/editor.api.js";

// Workaround https://github.com/remcohaszing/monaco-yaml/issues/272.
const oldCreateWebWorker = editor.createWebWorker;
editor.createWebWorker = opts => {
  if ("worker" in opts) return oldCreateWebWorker(opts);
  return createWebWorker(opts);
};

export * from "monaco-editor/esm/vs/editor/editor.api.js";

/**
 * Workers code taken from node_modules/monaco-editor/esm/vs/common/workers.js
 */
function getWorker(descriptor: Pick<CreateWebWorkerOpts, "label" | "moduleId" | "createWorker">) {
  const label = descriptor.label;
  const monacoEnvironment = globalThis.MonacoEnvironment;
  if (typeof monacoEnvironment?.getWorker === "function") {
    return monacoEnvironment.getWorker("workerMain.js", label);
  }
  throw new Error(`You must define a function MonacoEnvironment.getWorker`);
}
type CreateWebWorkerOpts = {
  label: string;
  moduleId: string;
  createWorker?: () => Worker;
  createData: unknown;
  host: Record<string, (...args: unknown[]) => unknown> | undefined;
  keepIdleModels: boolean | undefined;
};
function createWebWorker<T extends object>(opts: CreateWebWorkerOpts) {
  const worker = Promise.resolve(
    getWorker({
      label: opts.label ?? "monaco-editor-worker",
      moduleId: opts.moduleId,
      createWorker: opts.createWorker
    })
  ).then(w => {
    w.postMessage("ignore");
    w.postMessage(opts.createData);
    return w;
  });
  return editor.createWebWorker<T>({
    worker,
    host: opts.host,
    keepIdleModels: opts.keepIdleModels
  });
}

export { createWebWorker, MarkerSeverity };
