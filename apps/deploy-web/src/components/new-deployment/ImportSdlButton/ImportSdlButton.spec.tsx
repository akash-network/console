import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ImportedDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import { helloWorldTemplate } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./ImportSdlButton";
import { ImportSdlButton } from "./ImportSdlButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const IMPORTED_STATE: ImportedDeploymentState = { values: mock<SdlBuilderFormValuesType>(), sdl: "imported: sdl", selectedServiceId: "svc-1", changes: [] };

describe("ImportSdlButton", () => {
  it("opens the import dialog with the hello world example on offer", async () => {
    const { ImportSdlDialog } = setup();

    expect(ImportSdlDialog).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Import SDL" }));

    expect(ImportSdlDialog).toHaveBeenCalledWith(expect.objectContaining({ exampleSdl: helloWorldTemplate.content }), expect.anything());
  });

  it("opens the applied sdl in a configure draft, tracks how it came in and closes the dialog", async () => {
    const { push, createConfigureDraft, analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Import SDL" }));
    await userEvent.click(screen.getByRole("button", { name: "apply" }));

    expect(createConfigureDraft).toHaveBeenCalledWith("imported: sdl");
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ draftId: "draft-xyz" }));
    expect(analyticsService.track).toHaveBeenCalledWith("sdl_uploaded", { category: "deployments", method: "example" }, "Amplitude");
    expect(screen.queryByRole("button", { name: "apply" })).not.toBeInTheDocument();
  });

  it("closes the dialog without leaving the page", async () => {
    const { push, createConfigureDraft } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Import SDL" }));
    await userEvent.click(screen.getByRole("button", { name: "close" }));

    expect(screen.queryByRole("button", { name: "apply" })).not.toBeInTheDocument();
    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  function setup() {
    const push = vi.fn();
    const createConfigureDraft = vi.fn(() => "draft-xyz");
    const analyticsService = mock<AnalyticsService>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
    const ImportSdlDialog = vi.fn<typeof DEPENDENCIES.ImportSdlDialog>(props => (
      <>
        <button type="button" onClick={() => "onImport" in props && props.onImport(IMPORTED_STATE, { method: "example" })}>
          apply
        </button>
        <button type="button" onClick={props.onClose}>
          close
        </button>
      </>
    ));

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <ImportSdlButton dependencies={{ useRouter: () => router, ImportSdlDialog, createConfigureDraft }} />
      </TestContainerProvider>
    );

    return { push, createConfigureDraft, analyticsService, ImportSdlDialog };
  }
});
