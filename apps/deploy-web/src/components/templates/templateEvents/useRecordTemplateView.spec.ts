import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateViewKind } from "@src/types/marketplace-template";
import type { DEPENDENCIES } from "./useRecordTemplateView";
import { useRecordTemplateView } from "./useRecordTemplateView";

import { renderHook } from "@testing-library/react";

describe(useRecordTemplateView.name, () => {
  it("records the view of the named template for a signed-in user", () => {
    const { recordView } = setup({ kind: "configure_open", templateId: "tpl-1" });

    expect(recordView.mock.calls).toEqual([[{ id: "tpl-1", data: { kind: "configure_open" } }]]);
  });

  it("records nothing for a visitor without a session", () => {
    const { recordView } = setup({ templateId: "tpl-1", isSignedIn: false });

    expect(recordView).not.toHaveBeenCalled();
  });

  it("records nothing while no template is named", () => {
    const { recordView } = setup({ templateId: undefined });

    expect(recordView).not.toHaveBeenCalled();
  });

  it("records once per template however often the page renders, and again for another template", () => {
    const { recordView, rerender } = setup({ templateId: "tpl-1" });

    rerender({ templateId: "tpl-1" });
    rerender({ templateId: undefined });
    rerender({ templateId: "tpl-1" });
    rerender({ templateId: "tpl-2" });

    expect(recordView.mock.calls.map(([input]) => input.id)).toEqual(["tpl-1", "tpl-2"]);
  });

  function setup(input: { kind?: TemplateViewKind; templateId: string | undefined; isSignedIn?: boolean }) {
    const recordView = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
          user: input.isSignedIn === false ? undefined : mock<NonNullable<ReturnType<typeof DEPENDENCIES.useCustomUser>["user"]>>()
        }),
      useRecordTemplateViewMutation: () => mock<ReturnType<typeof DEPENDENCIES.useRecordTemplateViewMutation>>({ mutate: recordView })
    };
    const { rerender } = renderHook(({ templateId }) => useRecordTemplateView(input.kind ?? "page_view", templateId, dependencies), {
      initialProps: { templateId: input.templateId }
    });

    return { recordView, rerender };
  }
});
