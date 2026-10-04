import React from "react";
import { describe, expect, it } from "vitest";

import { TemplateDeploysAs } from "./TemplateDeploysAs";

import { render, screen, within } from "@testing-library/react";

const GPU_SDL = `
version: "2.0"
services:
  app:
    image: ghcr.io/comfyanonymous/comfyui:latest-cuda
    expose:
      - port: 8188
        to:
          - global: true
profiles:
  compute:
    app:
      resources:
        cpu:
          units: 6
        memory:
          size: 35Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: a100
        storage:
          - size: 50Gi
          - name: models
            size: 100Gi
            attributes:
              persistent: true
              class: beta3
  placement:
    akash:
      pricing:
        app:
          denom: uact
          amount: 10000
deployment:
  app:
    akash:
      profile: app
      count: 1
`;

const CPU_TWO_SERVICES_SDL = `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        to:
          - global: true
  cache:
    image: redis:7
    expose:
      - port: 6379
        to:
          - service: web
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          size: 1Gi
    cache:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    akash:
      pricing:
        web:
          denom: uact
          amount: 1000
        cache:
          denom: uact
          amount: 1000
deployment:
  web:
    akash:
      profile: web
      count: 1
  cache:
    akash:
      profile: cache
      count: 1
`;

describe(TemplateDeploysAs.name, () => {
  it("shows the GPU, vCPU, memory, storage and image of a single-service template", () => {
    setup({ sdl: GPU_SDL });

    expect(getSpec("GPU")).toHaveTextContent("1× A100");
    expect(getSpec("vCPU")).toHaveTextContent("6");
    expect(getSpec("Memory")).toHaveTextContent("35 GiB");
    expect(getSpec("Storage")).toHaveTextContent("50 GiB");
    expect(getSpec("Persistent")).toHaveTextContent("100 GiB");
    expect(getSpec("Image")).toHaveTextContent("ghcr.io/comfyanonymous/comfyui:latest-cuda");
  });

  it("keeps the full image in a title for when it is cut short", () => {
    setup({ sdl: GPU_SDL });

    expect(getSpec("Image")).toHaveAttribute("title", "ghcr.io/comfyanonymous/comfyui:latest-cuda");
  });

  it("leaves out GPU and persistent storage when the template asks for neither", () => {
    setup({ sdl: CPU_TWO_SERVICES_SDL });

    expect(screen.queryByText("GPU")).not.toBeInTheDocument();
    expect(screen.queryByText("Persistent")).not.toBeInTheDocument();
  });

  it("counts the services of a multi-service template instead of naming an image", () => {
    setup({ sdl: CPU_TWO_SERVICES_SDL });

    expect(getSpec("vCPU")).toHaveTextContent("1.5");
    expect(getSpec("Services")).toHaveTextContent("2");
    expect(screen.queryByText("Image")).not.toBeInTheDocument();
  });

  it("follows a change of SDL", () => {
    const { rerender } = setup({ sdl: GPU_SDL });

    rerender(<TemplateDeploysAs sdl={CPU_TWO_SERVICES_SDL} />);

    expect(getSpec("vCPU")).toHaveTextContent("1.5");
  });

  it("renders nothing for an SDL it cannot read", () => {
    const { container } = setup({ sdl: "services: [unclosed" });

    expect(container).toBeEmptyDOMElement();
  });

  function getSpec(label: string) {
    const term = within(screen.getByRole("region", { name: "Deploys as" })).getByText(label);
    return term.nextElementSibling as HTMLElement;
  }

  function setup(input: { sdl: string | undefined }) {
    return render(<TemplateDeploysAs sdl={input.sdl} />);
  }
});
