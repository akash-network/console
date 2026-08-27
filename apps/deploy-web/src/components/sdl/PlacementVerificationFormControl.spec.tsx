import type { RefObject } from "react";
import { createRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import type { PlacementVerificationType, SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { PlacementVerificationRefType } from "./PlacementVerificationFormControl";
import { PlacementVerificationFormControl } from "./PlacementVerificationFormControl";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementVerificationFormControl.name, () => {
  it("adds and removes the optional verification requirement", async () => {
    const user = userEvent.setup();
    const { form } = setup();
    const toggle = screen.getByRole("switch", { name: "Require provider verification" });

    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole("combobox", { name: "Minimum verification tier" })).not.toBeInTheDocument();
    expect(screen.getByText("Any provider may bid")).toBeInTheDocument();
    expect(screen.getByText("L1 - Identified")).toBeInTheDocument();
    expect(screen.getByText("L4 - Trusted")).toBeInTheDocument();

    await user.click(toggle);

    expect(form().getValues("placements.0.verification")).toEqual({
      minTier: 1,
      capabilities: [],
      auditors: []
    });
    expect(screen.getByRole("combobox", { name: "Minimum verification tier" })).toHaveTextContent("L1 - Identified");
    expect(screen.getByText("Operator identity verified")).toBeInTheDocument();

    await user.click(toggle);

    expect(form().getValues("placements.0.verification")).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Minimum verification tier" })).not.toBeInTheDocument();
    expect(screen.getByText("Any provider may bid")).toBeInTheDocument();
  });

  it("updates the tier and its concise meaning", () => {
    const { form } = setup({ verification: buildVerification() });

    fireEvent.click(screen.getByRole("combobox", { name: "Minimum verification tier" }));
    fireEvent.click(screen.getByRole("option", { name: "L3 - Established" }));

    expect(form().getValues("placements.0.verification.minTier")).toBe(3);
    expect(screen.getByText("Sustained reliability checked")).toBeInTheDocument();
  });

  it("writes canonical capabilities without duplicates", async () => {
    const user = userEvent.setup();
    const { form } = setup({ verification: buildVerification() });
    const persistentStorage = screen.getByRole("checkbox", { name: "Persistent storage" });
    const bareMetal = screen.getByRole("checkbox", { name: "Bare metal" });

    await user.click(persistentStorage);
    await user.click(bareMetal);

    expect(form().getValues("placements.0.verification.capabilities")).toEqual(["persistent_storage", "bare_metal"]);

    await user.click(persistentStorage);

    expect(form().getValues("placements.0.verification.capabilities")).toEqual(["bare_metal"]);
  });

  it("updates the minimum auditor count", async () => {
    const user = userEvent.setup();
    const { form } = setup({ verification: buildVerification() });
    const input = screen.getByRole("spinbutton", { name: "Minimum auditors" });

    await user.clear(input);
    await user.type(input, "2");

    expect(form().getValues("placements.0.verification.minAuditorCount")).toBe(2);
  });

  it("manages named auditors and their any/all policy", async () => {
    const user = userEvent.setup();
    const { form } = setup({ verification: buildVerification() });

    await user.click(screen.getByRole("button", { name: "Add auditor" }));
    await user.type(screen.getByRole("textbox", { name: "Auditor 1" }), "akash1auditor");
    fireEvent.click(screen.getByRole("combobox", { name: "Named auditor policy" }));
    fireEvent.click(screen.getByRole("option", { name: "All listed auditors" }));

    expect(form().getValues("placements.0.verification.auditors.0.value")).toBe("akash1auditor");
    expect(form().getValues("placements.0.verification.auditorMode")).toBe("all");

    await user.click(screen.getByRole("button", { name: "Remove auditor 1" }));

    expect(form().getValues("placements.0.verification.auditors")).toEqual([]);
    expect(form().getValues("placements.0.verification.auditorMode")).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Named auditor policy" })).not.toBeInTheDocument();
  });

  it("renders imported requirements without changing them on mount", () => {
    const verification = buildVerification({
      minTier: 4,
      capabilities: ["tee_hardware_attestation", "confidential_computing"],
      auditors: [{ id: "auditor-1", value: "akash1trusted" }],
      auditorMode: "all",
      minAuditorCount: 2
    });
    const { form } = setup({ verification });

    expect(screen.getByRole("switch", { name: "Require provider verification" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Minimum verification tier" })).toHaveTextContent("L4 - Trusted");
    expect(screen.getByRole("checkbox", { name: "TEE hardware attestation" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Auditor 1" })).toHaveValue("akash1trusted");
    expect(form().getValues("placements.0.verification")).toEqual(verification);
  });

  it("leaves legacy signedBy untouched when verification is disabled", async () => {
    const user = userEvent.setup();
    const { form } = setup({ verification: buildVerification(), signedBy: "akash1legacy" });

    await user.click(screen.getByRole("switch", { name: "Require provider verification" }));

    expect(form().getValues("placements.0.verification")).toBeUndefined();
    expect(form().getValues("placements.0.signedBy")).toEqual({
      anyOf: [{ id: "legacy", value: "akash1legacy" }],
      allOf: []
    });
  });

  it("exposes the same blank-row pruning operation as the placement editor's other arrays", () => {
    const ref = createRef<PlacementVerificationRefType>();
    const { form } = setup({
      verification: buildVerification({
        auditors: [
          { id: "blank", value: "" },
          { id: "kept", value: "akash1kept" }
        ]
      }),
      verificationRef: ref
    });

    act(() => ref.current?.removeAuditors([0]));

    expect(form().getValues("placements.0.verification.auditors")).toEqual([{ id: "kept", value: "akash1kept" }]);
  });
});

function buildVerification(overrides: Partial<PlacementVerificationType> = {}): PlacementVerificationType {
  return {
    minTier: 1,
    capabilities: [],
    auditors: [],
    auditorMode: "any",
    minAuditorCount: 0,
    ...overrides
  };
}

function setup({
  verification,
  signedBy,
  verificationRef
}: {
  verification?: PlacementVerificationType;
  signedBy?: string;
  verificationRef?: RefObject<PlacementVerificationRefType>;
} = {}) {
  const values = defaultServiceWithPlacement();
  values.placements[0].verification = verification;
  if (signedBy) {
    values.placements[0].signedBy = { anyOf: [{ id: "legacy", value: signedBy }], allOf: [] };
  }

  let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
  const Wrapper = () => {
    const methods = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
    form = methods;
    return (
      <TooltipProvider>
        <FormProvider {...methods}>
          <PlacementVerificationFormControl ref={verificationRef} control={methods.control} placementIndex={0} />
        </FormProvider>
      </TooltipProvider>
    );
  };

  render(<Wrapper />);

  return {
    form: () => {
      if (!form) throw new Error("Form did not initialize");
      return form;
    }
  };
}
