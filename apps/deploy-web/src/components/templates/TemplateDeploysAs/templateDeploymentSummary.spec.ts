import { describe, expect, it } from "vitest";

import { summarizeTemplateDeployment } from "./templateDeploymentSummary";

const SINGLE_SERVICE_SDL = `
version: "2.0"
services:
  web:
    image: ghcr.io/akash-network/hello-akash-world:2.1.0
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const ANY_NVIDIA_GPU_SDL = `
version: "2.0"
services:
  app:
    image: comfyui
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
        storage:
          size: 50Gi
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

const PINNED_GPU_MODELS_SDL = `
version: "2.0"
services:
  app:
    image: vllm/vllm-openai
    expose:
      - port: 8000
        to:
          - global: true
profiles:
  compute:
    app:
      resources:
        cpu:
          units: 8
        memory:
          size: 64Gi
        gpu:
          units: 2
          attributes:
            vendor:
              nvidia:
                - model: h100
                - model: a100
        storage:
          size: 100Gi
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

const GPU_WITHOUT_VENDOR_SDL = `
version: "2.0"
services:
  app:
    image: ollama/ollama
    expose:
      - port: 11434
        to:
          - global: true
profiles:
  compute:
    app:
      resources:
        cpu:
          units: 4
        memory:
          size: 16Gi
        gpu:
          units: 1
          attributes:
            vendor: {}
        storage:
          size: 20Gi
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

const TWO_SERVICES_SDL = `
version: "2.0"
services:
  wordpress:
    image: wordpress
    expose:
      - port: 80
        to:
          - global: true
    params:
      storage:
        wordpress-data:
          mount: /var/www/html
  db:
    image: mariadb:10.6.4
    expose:
      - port: 3306
        to:
          - service: wordpress
    params:
      storage:
        wordpress-db:
          mount: /var/lib/mysql
profiles:
  compute:
    wordpress:
      resources:
        cpu:
          units: 4
        memory:
          size: 4Gi
        storage:
          - size: 4Gi
          - name: wordpress-data
            size: 32Gi
            attributes:
              persistent: true
              class: beta3
    db:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          - size: 1Gi
          - name: wordpress-db
            size: 8Gi
            attributes:
              persistent: true
              class: beta3
  placement:
    akash:
      pricing:
        wordpress:
          denom: uact
          amount: 10000
        db:
          denom: uact
          amount: 10000
deployment:
  wordpress:
    akash:
      profile: wordpress
      count: 1
  db:
    akash:
      profile: db
      count: 2
`;

describe(summarizeTemplateDeployment.name, () => {
  it("summarizes a single-service template with its image", () => {
    expect(summarizeTemplateDeployment(SINGLE_SERVICE_SDL)).toEqual({
      serviceCount: 1,
      image: "ghcr.io/akash-network/hello-akash-world:2.1.0",
      gpu: undefined,
      cpu: "0.5",
      memory: "512 MiB",
      storage: "512 MiB",
      persistentStorage: undefined
    });
  });

  it("names the GPU vendor when the template takes any of its models", () => {
    expect(summarizeTemplateDeployment(ANY_NVIDIA_GPU_SDL)).toEqual(expect.objectContaining({ gpu: "1× NVIDIA", cpu: "6", memory: "35 GiB" }));
  });

  it("names the GPU models the template pins", () => {
    expect(summarizeTemplateDeployment(PINNED_GPU_MODELS_SDL)?.gpu).toBe("2× H100 / A100");
  });

  it("says any GPU will do when the template names no vendor", () => {
    expect(summarizeTemplateDeployment(GPU_WITHOUT_VENDOR_SDL)?.gpu).toBe("1\u00d7 Any");
  });

  it("totals several services and their replicas, counting the services instead of naming an image", () => {
    expect(summarizeTemplateDeployment(TWO_SERVICES_SDL)).toEqual({
      serviceCount: 2,
      image: undefined,
      gpu: undefined,
      cpu: "6",
      memory: "6 GiB",
      storage: "6 GiB",
      persistentStorage: "48 GiB"
    });
  });

  it("returns nothing for an SDL Configure cannot import", () => {
    expect(summarizeTemplateDeployment("services:\n  web:\n    image: nginx\n")).toBeUndefined();
  });

  it("returns nothing for an SDL without services", () => {
    expect(summarizeTemplateDeployment('version: "2.0"\n')).toBeUndefined();
  });

  it("returns nothing without an SDL", () => {
    expect(summarizeTemplateDeployment(undefined)).toBeUndefined();
    expect(summarizeTemplateDeployment("")).toBeUndefined();
  });
});
