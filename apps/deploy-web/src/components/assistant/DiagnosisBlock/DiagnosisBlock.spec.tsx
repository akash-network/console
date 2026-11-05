import { describe, expect, it } from "vitest";

import type { AssistantDiagnosis } from "@src/types/assistant";
import { DiagnosisBlock } from "./DiagnosisBlock";

import { render, screen, within } from "@testing-library/react";

describe(DiagnosisBlock.name, () => {
  it("shows the evidence it read, the diagnosis and then the fix", () => {
    setup({
      diagnosis: {
        summary: "The model is gated and HF_TOKEN is not set, so it exits on start.",
        evidence: ["OSError: You are trying to access a gated repo.", "Back-off restarting failed container"]
      }
    });

    const block = screen.getByRole("region", { name: "Diagnosis" });
    expect(within(block).getByLabelText("Evidence").textContent).toBe("OSError: You are trying to access a gated repo.\nBack-off restarting failed container");
    expect(within(block).getByText("The model is gated and HF_TOKEN is not set, so it exits on start.")).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: "Add the token" })).toBeInTheDocument();
  });

  it("leaves the evidence out when the diagnosis quotes none", () => {
    setup({ diagnosis: { summary: "The lease closed because the provider left.", evidence: [] } });

    expect(screen.queryByLabelText("Evidence")).not.toBeInTheDocument();
    expect(screen.getByText("The lease closed because the provider left.")).toBeInTheDocument();
  });

  function setup(input: { diagnosis: AssistantDiagnosis }) {
    render(
      <DiagnosisBlock diagnosis={input.diagnosis}>
        <button type="button">Add the token</button>
      </DiagnosisBlock>
    );
  }
});
