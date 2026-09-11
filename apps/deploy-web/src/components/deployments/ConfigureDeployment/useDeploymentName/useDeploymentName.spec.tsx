import { describe, expect, it } from "vitest";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import type { DEPENDENCIES } from "./useDeploymentName";
import { useDeploymentName } from "./useDeploymentName";

import { act, renderHook } from "@testing-library/react";

describe(useDeploymentName.name, () => {
  it("seeds the name from initialName", () => {
    const { result } = setup({ initialName: "my-app" });

    expect(result.current.name).toBe("my-app");
  });

  it("holds a seeded name to the length the api accepts, so a legacy name cannot fail the create", () => {
    const { result } = setup({ initialName: "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH + 10) });

    expect(result.current.name).toBe("a".repeat(MAX_DEPLOYMENT_NAME_LENGTH));
  });

  it("fills the field from the api when this session typed no name of its own", () => {
    const { result } = setup({ dseq: "12345", apiName: "named-elsewhere" });

    expect(result.current.name).toBe("named-elsewhere");
  });

  it("keeps a name typed after the deployment exists, so an edit is never discarded", () => {
    const { result } = setup({ initialName: "my-app", dseq: "12345", apiName: "named-elsewhere" });

    act(() => result.current.setName("renamed-before-retrying"));

    expect(result.current.name).toBe("renamed-before-retrying");
  });

  it("keeps showing the typed name while no deployment exists to carry it", () => {
    const { result } = setup({ initialName: "my-app", dseq: null, apiName: "named-elsewhere" });

    expect(result.current.name).toBe("my-app");
  });

  it("reports no typed name of its own while the shown one came from the api, so nothing derived is persisted as the user's", () => {
    const { result } = setup({ dseq: "12345", apiName: "web+postgres" });

    expect(result.current.name).toBe("web+postgres");
    expect(result.current.typedName).toBe("");
  });

  it("reports the typed name as its own once this session types over the api's", () => {
    const { result } = setup({ dseq: "12345", apiName: "web+postgres" });

    act(() => result.current.setName("my-app"));

    expect(result.current.typedName).toBe("my-app");
  });

  it("resolves to an empty name when neither the api nor this session holds one, leaving the field its placeholder", () => {
    const { result } = setup({ dseq: "12345" });

    expect(result.current.name).toBe("");
  });

  it("updates the name via setName", () => {
    const { result } = setup({ initialName: "my-app" });

    act(() => result.current.setName("renamed"));

    expect(result.current.name).toBe("renamed");
  });

  function setup(input: { initialName?: string; dseq?: string | null; apiName?: string }) {
    const useResolvedDeploymentName: typeof DEPENDENCIES.useResolvedDeploymentName = dseq => (dseq ? input.apiName : undefined);

    return renderHook((props: { initialName?: string; dseq: string | null }) => useDeploymentName(props, { useResolvedDeploymentName }), {
      initialProps: { initialName: input.initialName, dseq: input.dseq ?? null }
    });
  }
});
