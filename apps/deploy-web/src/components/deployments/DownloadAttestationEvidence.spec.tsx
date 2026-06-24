import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { TEE_TYPE_ATTRIBUTE_KEY } from "@src/utils/confidentialCompute";
import { DEPENDENCIES, DownloadAttestationEvidence } from "./DownloadAttestationEvidence";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const TEE_GROUP = mock<DeploymentGroup>({
  group_spec: { requirements: { attributes: [{ key: TEE_TYPE_ATTRIBUTE_KEY, value: "cpu-gpu" }] } }
} as unknown as DeploymentGroup);

describe(DownloadAttestationEvidence.name, () => {
  it("renders the trigger when the lease is live and a TEE type is declared", () => {
    setup({ state: "active", group: TEE_GROUP });
    expect(screen.getByRole("button", { name: /Attestation evidence/ })).toBeInTheDocument();
  });

  it("renders nothing when the lease is not live", () => {
    setup({ state: "closed", group: TEE_GROUP });
    expect(screen.queryByRole("button", { name: /Attestation evidence/ })).not.toBeInTheDocument();
  });

  it("renders nothing for a non-Confidential-Compute lease", () => {
    setup({ state: "active", group: undefined });
    expect(screen.queryByRole("button", { name: /Attestation evidence/ })).not.toBeInTheDocument();
  });

  it("opens the evidence modal when the trigger is clicked", async () => {
    const { AttestationEvidenceModal } = setup({ state: "active", group: TEE_GROUP });

    expect(AttestationEvidenceModal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Attestation evidence/ }));

    expect(AttestationEvidenceModal).toHaveBeenCalled();
  });

  function setup(input: { state: LeaseDto["state"]; group?: DeploymentGroup }) {
    const AttestationEvidenceModal = vi.fn(() => <div>modal</div>);
    const lease = mock<LeaseDto>({ state: input.state, group: input.group, dseq: "123", gseq: 1, oseq: 2 });

    render(
      <DownloadAttestationEvidence
        lease={lease}
        provider={{ owner: "akash1provider", hostUri: "https://provider.test" }}
        dependencies={MockComponents(DEPENDENCIES, { AttestationEvidenceModal })}
      />
    );

    return { AttestationEvidenceModal };
  }
});
