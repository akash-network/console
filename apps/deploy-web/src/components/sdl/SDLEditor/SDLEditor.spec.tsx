import type { OnChange } from "@monaco-editor/react";
import type * as monacoModule from "monaco-editor";
import { describe, expect, it, type Mock, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { DEPENDENCIES, SDLEditor, type SdlEditorRefType } from "./SDLEditor";

import { act, render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(SDLEditor.name || "SDLEditor", () => {
  it("renders editor with yaml language", () => {
    const { Editor } = setup();

    expect(Editor).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "yaml"
      }),
      expect.anything()
    );
  });

  it("passes readonly option when readonly prop is true", () => {
    const { Editor } = setup({ readonly: true });

    expect(Editor).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          readOnly: true,
          domReadOnly: true
        })
      }),
      expect.anything()
    );
  });

  it("passes readonly as false when readonly prop is false", () => {
    const { Editor } = setup({ readonly: false });

    expect(Editor).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          readOnly: false,
          domReadOnly: false
        })
      }),
      expect.anything()
    );
  });

  it("preserves custom hover options when provided", () => {
    const { Editor } = setup({
      options: {
        hover: {
          delay: 500
        }
      }
    });

    expect(Editor).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          hover: expect.objectContaining({
            enabled: true,
            delay: 500
          })
        })
      }),
      expect.anything()
    );
  });

  it("calls onMount callback when editor mounts", () => {
    const onMount = vi.fn();
    const { simulateMount, mockEditor, mockMonaco } = setup({ onMount });

    simulateMount();

    expect(onMount).toHaveBeenCalledWith(mockEditor, mockMonaco);
  });

  it("calls onChange when content changes", () => {
    const onChange = vi.fn();
    const { simulateMount, simulateContentChange } = setup({ onChange });

    simulateMount();
    simulateContentChange("new content");

    expect(onChange).toHaveBeenCalledWith("new content", expect.anything());
  });

  it("clears markers when content is empty", () => {
    const { simulateMount, simulateContentChange, mockMonaco, mockModel } = setup();

    simulateMount();
    simulateContentChange("");

    expect(mockMonaco.editor.setModelMarkers).toHaveBeenCalledWith(mockModel, "akash-sdl", []);
  });

  it("schedules validation when content changes", async () => {
    const onValidate = vi.fn();
    const { simulateMount, simulateContentChange } = setup({ onValidate });
    vi.useFakeTimers();

    simulateMount();
    simulateContentChange("version: '2.0'");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(onValidate).toHaveBeenCalled();
    });
  });

  it("debounces validation calls", async () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const { simulateMount, simulateContentChange } = setup({ onValidate });

    simulateMount();
    simulateContentChange("version: '2.0'");
    simulateContentChange("version: '2.1'");
    simulateContentChange("version: '2.2'");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(onValidate).toHaveBeenCalledTimes(1);
    });

    vi.useRealTimers();
  });

  it("validates initial content on mount", async () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const { simulateMount } = setup({
      onValidate,
      initialValue: "version: '2.0'"
    });

    simulateMount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(onValidate).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });

  it("does not schedule validation when value is unchanged", () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const { simulateMount, simulateContentChange } = setup({
      onValidate,
      initialValue: "version: '2.0'"
    });

    simulateMount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    onValidate.mockClear();
    simulateContentChange("version: '2.0'");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onValidate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("clears pending validation timer on dispose", () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const { simulateMount, simulateContentChange, simulateDispose } = setup({ onValidate });

    simulateMount();
    simulateContentChange("version: '2.0'");
    simulateDispose();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onValidate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("disposes content change listener on editor dispose", () => {
    const contentDisposable = { dispose: vi.fn() };
    const { simulateMount, simulateDispose, mockModel } = setup();
    mockModel.onDidChangeContent.mockReturnValue(contentDisposable);

    simulateMount();
    simulateDispose();

    expect(contentDisposable.dispose).toHaveBeenCalled();
  });

  it("provides validate method via ref", async () => {
    vi.useFakeTimers();
    const { ref, simulateMount } = setup({
      initialValue: "version: '2.0'"
    });

    simulateMount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const result = await act(async () => {
      return ref.current?.validate();
    });

    expect(typeof result).toBe("boolean");

    vi.useRealTimers();
  });

  it("clears pending timer when validate is called via ref", async () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const { ref, simulateMount, simulateContentChange } = setup({
      onValidate
    });

    simulateMount();

    // Schedule a validation
    simulateContentChange("version: '2.1'");

    // Call validate via ref (should clear the pending timer and validate immediately)
    await act(async () => {
      await ref.current?.validate();
    });

    // Advance timers - the scheduled validation should have been cleared
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Only one call from the ref.validate(), the scheduled timer should have been cleared
    expect(onValidate).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("reports invalid when yaml has syntax errors", async () => {
    vi.useFakeTimers();
    const onValidate = vi.fn();
    const invalidYaml = "version: '2.0'\n  invalid: indentation";
    const { simulateMount, simulateContentChange } = setup({ onValidate });

    simulateMount();
    simulateContentChange(invalidYaml);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(onValidate).toHaveBeenCalledWith({ isValid: false });
    });

    vi.useRealTimers();
  });

  it("sets model markers for SDL validation errors", async () => {
    vi.useFakeTimers();
    const validYaml = `version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1`;

    const { simulateMount, simulateContentChange, mockMonaco, mockModel } = setup();

    simulateMount();
    simulateContentChange(validYaml);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(mockMonaco.editor.setModelMarkers).toHaveBeenCalledWith(mockModel, "akash-sdl", expect.any(Array));
    });

    vi.useRealTimers();
  });

  it("generates file path with editorId pattern", () => {
    const { Editor } = setup();

    const path = Editor.mock.calls[0][0].path;

    expect(path).toMatch(/^file:\/\/\/akash-sdl\.\d+\.yaml$/);
  });

  function setup(input?: {
    readonly?: boolean;
    onMount?: (editor: unknown, monaco: unknown) => void;
    onChange?: OnChange;
    onValidate?: (event: { isValid: boolean }) => void;
    options?: Record<string, unknown>;
    initialValue?: string;
  }) {
    const ref = { current: null as SdlEditorRefType | null };
    let onMountCallback: ((editor: unknown, monaco: typeof monacoModule) => void) | undefined;
    let onDisposeCallback: (() => void) | undefined;
    let onContentChangeCallback: ((event: unknown) => void) | undefined;

    const mockModel = mock<monacoModule.editor.ITextModel>({
      getValue: vi.fn().mockReturnValue(input?.initialValue ?? ""),
      onDidChangeContent: vi.fn().mockImplementation(callback => {
        onContentChangeCallback = callback;
        return { dispose: vi.fn() };
      })
    });

    const mockEditor = mock<monacoModule.editor.IStandaloneCodeEditor>({
      getModel: vi.fn().mockReturnValue(mockModel),
      onDidDispose: vi.fn().mockImplementation(callback => {
        onDisposeCallback = callback;
        return { dispose: vi.fn() };
      })
    });

    const mockMonaco = mockDeep<typeof monacoModule>();
    const Editor = vi.fn().mockImplementation(props => {
      onMountCallback = props.onMount;
      return <div data-testid="mock-editor">Mock Editor</div>;
    }) as unknown as (typeof DEPENDENCIES)["Editor"];
    Editor.preload = vi.fn();

    const networkStore = mock<AppDIContainer["networkStore"]>({
      useSelectedNetworkId: () => "mainnet"
    });

    render(
      <TestContainerProvider
        services={{
          networkStore: () => networkStore
        }}
      >
        <SDLEditor
          ref={el => {
            ref.current = el;
          }}
          value=""
          readonly={input?.readonly}
          onMount={input?.onMount}
          onChange={input?.onChange}
          onValidate={input?.onValidate}
          options={input?.options}
          dependencies={{
            ...DEPENDENCIES,
            Editor
          }}
        />
      </TestContainerProvider>
    );

    const simulateMount = () => {
      act(() => {
        onMountCallback?.(mockEditor, mockMonaco);
      });
    };

    const simulateDispose = () => {
      act(() => {
        onDisposeCallback?.();
      });
    };

    const simulateContentChange = (newValue: string) => {
      mockModel.getValue.mockReturnValue(newValue);
      act(() => {
        onContentChangeCallback?.({});
      });
    };

    return {
      Editor: Editor as unknown as Mock,
      mockEditor,
      mockMonaco,
      mockModel,
      ref,
      simulateMount,
      simulateDispose,
      simulateContentChange
    };
  }
});
