import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { ListedDeploymentDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useLastConfiguration";
import { MAX_LAST_CONFIGURATION_CANDIDATES, useLastConfiguration } from "./useLastConfiguration";

import { renderHook, waitFor } from "@testing-library/react";

describe(useLastConfiguration.name, () => {
  it("returns the newest deployment across open and closed ones with its configuration", () => {
    const { result } = setup({
      active: [deployment("100")],
      closed: [deployment("200")],
      definitions: { "100": usable("api"), "200": usable("api") }
    });

    expect(result.current?.deployment.dseq).toBe("200");
    expect(result.current?.definition.sdl).toBe("sdl-of-api");
  });

  it("compares dseqs as numbers rather than as text", () => {
    const { result } = setup({
      active: [deployment("99")],
      closed: [deployment("100")],
      definitions: { "99": usable("api"), "100": usable("api") }
    });

    expect(result.current?.deployment.dseq).toBe("100");
  });

  it("moves on to the next newest deployment when the newest has no configuration", async () => {
    const { result } = setup({
      active: [deployment("300"), deployment("100")],
      closed: [deployment("200")],
      definitions: { "300": { sdl: undefined, name: undefined, source: "absent" }, "200": usable("local"), "100": usable("api") }
    });

    await waitFor(() => expect(result.current?.deployment.dseq).toBe("200"));
    expect(result.current?.definition.source).toBe("local");
  });

  it("skips a deployment whose only copy the console cannot stand behind", async () => {
    const { result } = setup({
      active: [deployment("300"), deployment("100")],
      definitions: { "300": { sdl: "rejected-sdl", name: "rejected", source: "absent" }, "100": usable("api") }
    });

    await waitFor(() => expect(result.current?.deployment.dseq).toBe("100"));
  });

  it("waits on the newest deployment while its configuration is still resolving", () => {
    const { result, useDeploymentDefinition } = setup({
      active: [deployment("300"), deployment("100")],
      definitions: { "300": { sdl: undefined, name: undefined, source: "resolving" }, "100": usable("api") }
    });

    expect(result.current).toBeNull();
    expect(useDeploymentDefinition).not.toHaveBeenCalledWith("100", expect.anything());
  });

  it("returns null when no recent deployment has a configuration", async () => {
    const { result, useDeploymentDefinition } = setup({
      active: [deployment("300")],
      closed: [deployment("200")],
      definitions: {}
    });

    await waitFor(() => expect(useDeploymentDefinition).toHaveBeenCalledWith("200", expect.anything()));
    expect(result.current).toBeNull();
  });

  it("returns null for an account without deployments", () => {
    const { result } = setup({ definitions: {} });

    expect(result.current).toBeNull();
  });

  it("returns null while the deployment lists load", () => {
    const { result, useDeploymentDefinition } = setup({ active: null, closed: null, definitions: {} });

    expect(result.current).toBeNull();
    expect(useDeploymentDefinition).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it("looks no further back than the newest deployments", async () => {
    const newest = ["600", "500", "400", "300", "200"];
    const { result, useDeploymentDefinition } = setup({
      active: [...newest, "100"].map(deployment),
      definitions: { "100": usable("api") }
    });

    await waitFor(() => expect(useDeploymentDefinition).toHaveBeenCalledWith("200", expect.anything()));
    expect(useDeploymentDefinition).not.toHaveBeenCalledWith("100", expect.anything());
    expect(result.current).toBeNull();
  });

  it("asks for the newest page of open and of closed deployments once the wallet exists", () => {
    const { useDeploymentsListQuery } = setup({ definitions: {} });

    const page = { search: "", skip: 0, limit: MAX_LAST_CONFIGURATION_CANDIDATES };
    expect(useDeploymentsListQuery).toHaveBeenCalledWith({ state: "active", ...page }, { enabled: true });
    expect(useDeploymentsListQuery).toHaveBeenCalledWith({ state: "closed", ...page }, { enabled: true });
  });

  it("holds the deployment lists back until the wallet exists", () => {
    const { useDeploymentsListQuery } = setup({ hasWallet: false, definitions: {} });

    expect(useDeploymentsListQuery).toHaveBeenCalledWith(expect.objectContaining({ state: "active" }), { enabled: false });
    expect(useDeploymentsListQuery).toHaveBeenCalledWith(expect.objectContaining({ state: "closed" }), { enabled: false });
  });

  it("reads each configuration the way a redeploy from the deployment page does", () => {
    const { useDeploymentDefinition } = setup({ active: [deployment("100")], definitions: { "100": usable("api") } });

    expect(useDeploymentDefinition).toHaveBeenCalledWith("100", { acceptReferences: true });
  });

  function deployment(dseq: string): ListedDeploymentDto {
    return { dseq, state: "active", name: `deployment-${dseq}` } as ListedDeploymentDto;
  }

  function usable(source: "api" | "local"): DeploymentDefinition {
    return { sdl: `sdl-of-${source}`, name: `name-of-${source}`, source };
  }

  function setup(input: {
    active?: ListedDeploymentDto[] | null;
    closed?: ListedDeploymentDto[] | null;
    definitions: Record<string, DeploymentDefinition>;
    hasWallet?: boolean;
  }) {
    const pages = {
      active: listQueryResult(input.active === undefined ? [] : input.active),
      closed: listQueryResult(input.closed === undefined ? [] : input.closed)
    };
    const absent: DeploymentDefinition = { sdl: undefined, name: undefined, source: "absent" };
    const useDeploymentsListQuery = vi.fn<typeof DEPENDENCIES.useDeploymentsListQuery>(params => pages[params.state as keyof typeof pages]);
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(dseq => (dseq ? input.definitions[dseq] ?? absent : absent));
    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ hasWallet: input.hasWallet ?? true }),
      useDeploymentsListQuery,
      useDeploymentDefinition
    };

    const { result } = renderHook(() => useLastConfiguration(dependencies));

    return { result, useDeploymentsListQuery, useDeploymentDefinition };
  }

  function listQueryResult(deployments: ListedDeploymentDto[] | null) {
    return Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentsListQuery>>(), {
      data: deployments ? { deployments, total: deployments.length, hasNextPage: false, isSearchTooBroad: false } : undefined
    });
  }
});
