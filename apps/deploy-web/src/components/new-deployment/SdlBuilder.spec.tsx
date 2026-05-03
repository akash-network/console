import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServiceType } from "@src/types";
import { type DEPENDENCIES, SdlBuilder } from "./SdlBuilder";

import { act, render } from "@testing-library/react";

type SimpleServiceFormControlProps = ComponentProps<typeof DEPENDENCIES.SimpleServiceFormControl>;

const buildSdl = (image: string) =>
  [
    "version: '2.0'",
    "services:",
    "  web:",
    `    image: ${image}`,
    "    expose:",
    "      - port: 80",
    "        as: 80",
    "        to:",
    "          - global: true",
    "profiles:",
    "  compute:",
    "    web:",
    "      resources:",
    "        cpu:",
    "          units: 0.5",
    "        memory:",
    "          size: 512Mi",
    "        storage:",
    "          - size: 512Mi",
    "  placement:",
    "    dcloud:",
    "      pricing:",
    "        web:",
    "          denom: uact",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1"
  ].join("\n");

describe("SdlBuilder", () => {
  it("imports services from sdlString on mount", async () => {
    const { SimpleServiceFormControl } = setup({ sdlString: buildSdl("nginx:1.0") });

    await vi.waitFor(() => {
      expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("nginx:1.0");
    });
  });

  it("re-imports services when sdlString changes externally", async () => {
    const { SimpleServiceFormControl, rerender } = setup({ sdlString: buildSdl("nginx:1.0") });

    await vi.waitFor(() => {
      expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("nginx:1.0");
    });

    rerender({ sdlString: buildSdl("redis:7.0") });

    await vi.waitFor(() => {
      expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("redis:7.0");
    });
  });

  it("preserves user form edits when sdlString does not change externally", async () => {
    const initialSdl = buildSdl("nginx:1.0");
    const { SimpleServiceFormControl, setEditedManifest, rerender } = setup({ sdlString: initialSdl });

    await vi.waitFor(() => {
      expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("nginx:1.0");
    });

    const lastSetValue = SimpleServiceFormControl.mock.calls.at(-1)?.[0].setValue;
    expect(lastSetValue).toBeDefined();

    act(() => {
      (lastSetValue as (path: string, value: string) => void)("services.0.image", "user-edited-image");
    });

    await vi.waitFor(() => {
      expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("user-edited-image");
    });

    const lastEditedManifest = setEditedManifest.mock.calls.at(-1)?.[0] as string | undefined;
    expect(lastEditedManifest).toBeDefined();
    rerender({ sdlString: lastEditedManifest! });

    await Promise.resolve();
    expect(getLastServices(SimpleServiceFormControl)?.[0]?.image).toBe("user-edited-image");
  });

  function getLastServices(SimpleServiceFormControl: ReturnType<typeof createSimpleServiceFormControl>): ServiceType[] | undefined {
    return SimpleServiceFormControl.mock.calls.at(-1)?.[0]._services;
  }

  function createSimpleServiceFormControl() {
    return vi.fn<(props: SimpleServiceFormControlProps) => null>(() => null);
  }

  function setup(input: { sdlString: string | null }) {
    const setEditedManifest = vi.fn();
    const SimpleServiceFormControl = createSimpleServiceFormControl();
    const RemoteRepositoryDeployManager = vi.fn(() => null);

    const dependencies: typeof DEPENDENCIES = {
      SimpleServiceFormControl: SimpleServiceFormControl as unknown as typeof DEPENDENCIES.SimpleServiceFormControl,
      RemoteRepositoryDeployManager: RemoteRepositoryDeployManager as unknown as typeof DEPENDENCIES.RemoteRepositoryDeployManager,
      useSdlBuilder: () =>
        mock<ReturnType<typeof DEPENDENCIES.useSdlBuilder>>({
          hasComponent: () => false,
          toggleCmp: vi.fn(),
          imageList: undefined
        }),
      useWallet: () =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
          isManaged: false
        }),
      useSdlServiceManager: () =>
        mock<ReturnType<typeof DEPENDENCIES.useSdlServiceManager>>({
          add: vi.fn(),
          remove: vi.fn()
        }),
      useGpuModels: () => mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({ data: undefined })
    };

    const view = render(
      <SdlBuilder sdlString={input.sdlString} setEditedManifest={setEditedManifest} setDeploymentName={vi.fn()} deploymentName="" dependencies={dependencies} />
    );

    const rerender = (next: { sdlString: string | null }) => {
      view.rerender(
        <SdlBuilder
          sdlString={next.sdlString}
          setEditedManifest={setEditedManifest}
          setDeploymentName={vi.fn()}
          deploymentName=""
          dependencies={dependencies}
        />
      );
    };

    return { SimpleServiceFormControl, RemoteRepositoryDeployManager, setEditedManifest, rerender };
  }
});
