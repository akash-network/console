import type { PropsWithChildren } from "react";
import { act } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { PlacementVerificationType, SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { getPlacementVerificationSummary, PlacementVerificationEditor } from "./PlacementVerificationEditor";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementVerificationEditor.name, () => {
  it("summarizes the placement requirement", () => {
    expect(
      getPlacementVerificationSummary({
        minTier: 3,
        minAuditorCount: 2,
        capabilities: ["persistent_storage"],
        auditors: [{ id: "auditor-1", value: "akash1auditor" }],
        auditorMode: "all"
      })
    ).toBe("L3 minimum · 2 auditors · 1 capability · 1 named auditor");
  });

  it("shows the unrestricted state before a requirement is configured", () => {
    setup();

    expect(screen.getByRole("button", { name: "Edit provider verification: Not required" })).toBeInTheDocument();
  });

  it("edits the placement verification requirement", async () => {
    const user = userEvent.setup();
    const { form } = setup();

    await user.click(screen.getByRole("button", { name: "Edit provider verification: Not required" }));
    await user.click(screen.getByRole("switch", { name: "Require provider verification" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(form().getValues("placements.0.verification")).toEqual({ minTier: 1, capabilities: [], auditors: [] });
    expect(screen.getByRole("button", { name: "Edit provider verification: L1 minimum" })).toBeInTheDocument();
  });

  it("edits only the selected placement", async () => {
    const user = userEvent.setup();
    const firstPlacementVerification: PlacementVerificationType = { minTier: 4, capabilities: [], auditors: [] };
    const { form } = setup({ placementIndex: 1, firstPlacementVerification });

    await user.click(screen.getByRole("button", { name: "Edit provider verification: Not required" }));
    await user.click(screen.getByRole("switch", { name: "Require provider verification" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(form().getValues("placements.0.verification")).toEqual(firstPlacementVerification);
    expect(form().getValues("placements.1.verification")).toEqual({ minTier: 1, capabilities: [], auditors: [] });
  });

  it("restores nested verification fields when editing is cancelled", async () => {
    const user = userEvent.setup();
    const verification: PlacementVerificationType = {
      minTier: 2,
      minAuditorCount: 1,
      capabilities: ["persistent_storage"],
      auditors: [{ id: "kept", value: "akash1kept" }],
      auditorMode: "all"
    };
    const { form } = setup({ verification });

    await user.click(screen.getByRole("button", { name: /Edit provider verification/ }));
    await user.clear(screen.getByRole("spinbutton", { name: "Minimum auditors" }));
    await user.type(screen.getByRole("spinbutton", { name: "Minimum auditors" }), "3");
    await user.click(screen.getByRole("button", { name: "Add auditor" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(form().getValues("placements.0.verification")).toEqual(verification);
  });

  it("restores verification fields when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    const verification: PlacementVerificationType = { minTier: 2, capabilities: [], auditors: [] };
    const { form } = setup({ verification });

    await user.click(screen.getByRole("button", { name: /Edit provider verification/ }));
    await user.click(screen.getByRole("switch", { name: "Require provider verification" }));
    await user.keyboard("{Escape}");

    expect(form().getValues("placements.0.verification")).toEqual(verification);
  });

  it("prunes blank named auditors only when the editor is saved", async () => {
    const user = userEvent.setup();
    const { form } = setup({
      verification: {
        minTier: 2,
        capabilities: [],
        auditors: [
          { id: "blank", value: "" },
          { id: "kept", value: "akash1kept" }
        ],
        auditorMode: "any"
      }
    });

    await user.click(screen.getByRole("button", { name: /Edit provider verification/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(form().getValues("placements.0.verification.auditors")).toEqual([{ id: "kept", value: "akash1kept" }]);
  });

  it("opens read-only while the deployment form is locked", async () => {
    const user = userEvent.setup();
    setup({ locked: true });

    const button = screen.getByRole("button", { name: "Edit provider verification: Not required" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(screen.getByRole("switch", { name: "Require provider verification" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("marks the closed editor when submitted verification fields are invalid", async () => {
    const { form } = setup({ verification: { minTier: 2, capabilities: [], auditors: [] } });

    await act(async () => {
      await form().handleSubmit(() => undefined)();
      form().setError("placements.0.verification.minTier", { type: "manual", message: "Invalid tier" });
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /Edit provider verification/ })).toHaveAttribute("aria-invalid", "true"));
  });

  it("does not select the placement when the editor is opened", async () => {
    const user = userEvent.setup();
    const onPlacementClick = vi.fn();
    setup({ onPlacementClick });

    await user.click(screen.getByRole("button", { name: "Edit provider verification: Not required" }));

    expect(onPlacementClick).not.toHaveBeenCalled();
  });
});

function setup({
  verification,
  locked = false,
  onPlacementClick,
  placementIndex = 0,
  firstPlacementVerification
}: {
  verification?: PlacementVerificationType;
  locked?: boolean;
  onPlacementClick?: () => void;
  placementIndex?: number;
  firstPlacementVerification?: PlacementVerificationType;
} = {}) {
  const values = defaultServiceWithPlacement();
  if (placementIndex === 1) {
    values.placements.push({ ...structuredClone(values.placements[0]), id: "placement-2", name: "edge" });
    values.placements[0].verification = firstPlacementVerification;
  }
  values.placements[placementIndex].verification = verification;
  let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;

  const Wrapper = ({ children }: PropsWithChildren) => {
    const methods = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
    form = methods;

    return (
      <TooltipProvider>
        <FormProvider {...methods}>
          <div onClick={onPlacementClick}>{children}</div>
        </FormProvider>
      </TooltipProvider>
    );
  };

  render(<PlacementVerificationEditor placementName={values.placements[placementIndex].name} placementIndex={placementIndex} locked={locked} />, {
    wrapper: Wrapper
  });

  return {
    form: () => {
      if (!form) throw new Error("Form did not initialize");
      return form;
    }
  };
}
