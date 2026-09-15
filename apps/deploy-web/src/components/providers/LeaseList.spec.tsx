import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, LeaseList } from "./LeaseList";
import type { LeaseRowProps } from "./LeaseRow";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("LeaseList", () => {
  it("hands each lease the name the console holds for its deployment", () => {
    const { LeaseRow } = setup({ leases: [lease("100")], names: { "100": "web" } });

    expect(LeaseRow).toHaveBeenCalledWith(
      expect.objectContaining({ lease: expect.objectContaining({ dseq: "100" }), deploymentName: "web" }),
      expect.anything()
    );
  });

  it("hands a lease no name when the console holds none for its deployment", () => {
    const { LeaseRow } = setup({ leases: [lease("100")] });

    expect(LeaseRow).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: null }), expect.anything());
  });

  it("asks for the names of the leases on the current page only", () => {
    const { useDeploymentNames } = setup({ leases: Array.from({ length: 12 }, (_, index) => lease(String(100 + index))) });

    expect(useDeploymentNames.mock.lastCall?.[0]).toHaveLength(10);
  });

  it("asks for the names under the deployments the current page's leases belong to", () => {
    const { useDeploymentNames } = setup({ leases: [lease("100"), lease("200")] });

    expect(useDeploymentNames).toHaveBeenLastCalledWith(expect.arrayContaining(["100", "200"]));
  });

  function lease(dseq: string) {
    return mock<LeaseDto>({ id: `lease-${dseq}`, dseq, state: "active" });
  }

  function setup(input: { leases: LeaseDto[]; names?: Record<string, string> }) {
    const useDeploymentNames = vi.fn<typeof DEPENDENCIES.useDeploymentNames>(() => ({ getDeploymentName: dseq => input.names?.[String(dseq)] ?? null }));
    const LeaseRow = vi.fn(({ lease }: LeaseRowProps) => (
      <tr>
        <td>{lease.dseq}</td>
      </tr>
    ));

    render(<LeaseList leases={input.leases} isLoadingLeases={false} dependencies={MockComponents(DEPENDENCIES, { useDeploymentNames, LeaseRow })} />);

    return { useDeploymentNames, LeaseRow };
  }
});
