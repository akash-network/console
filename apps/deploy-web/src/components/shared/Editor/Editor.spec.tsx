import { describe, expect, it, vi } from "vitest";

import type { Props } from "./Editor";
import { DEPENDENCIES, Editor, EditorSkeleton } from "./Editor";

import { render } from "@testing-library/react";

describe(Editor.name || "Editor", () => {
  it("renders monaco editor with default props", async () => {
    const LazyMonacoEditor = vi.fn(() => <div data-testid="lazy-monaco-editor" />);
    const props = {
      height: "50%",
      value: "test monaco editor",
      theme: "light",
      onChange: () => {},
      onMount: () => {},
      onValidate: () => {},
      wrapperProps: { "data-testid": "monaco-editor" },
      path: "test-path.yaml",
      language: "yaml" as const
    };
    setup({
      ...props,
      dependencies: {
        ...DEPENDENCIES,
        LazyMonacoEditor
      }
    });
    expect(LazyMonacoEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ...props,
        language: "yaml"
      }),
      expect.anything()
    );
  });

  function setup(input?: Partial<Omit<Props, "dependencies">> & { dependencies?: Partial<typeof DEPENDENCIES> }) {
    return render(
      <Editor
        {...input}
        value={input?.value ?? "test"}
        dependencies={{
          ...DEPENDENCIES,
          ...input?.dependencies
        }}
      />
    );
  }
});

describe(EditorSkeleton.name, () => {
  it("renders skeleton lines with varying widths", () => {
    const result = render(<EditorSkeleton />);
    expect(result.container).toMatchSnapshot();
  });
});
