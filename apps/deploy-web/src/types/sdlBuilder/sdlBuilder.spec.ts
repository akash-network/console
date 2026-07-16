import { describe, expect, it } from "vitest";

import { CredentialsSchema, EndpointSchema, EnvironmentVariableSchema, SdlBuilderFormValuesSchema, ServiceSchema, ServiceStorageSchema } from "./sdlBuilder";

describe("ServiceStorageSchema", () => {
  it("surfaces a friendly required message instead of the raw type error when size is cleared", () => {
    const result = ServiceStorageSchema.safeParse({ size: null, unit: "Gi" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["size"], message: "Storage is required." }));
    expect(result.error.issues.some(issue => /received null/i.test(issue.message))).toBe(false);
  });
});

describe("ServiceSchema", () => {
  it("validates a minimal valid service", () => {
    const result = ServiceSchema.safeParse({
      id: "svc-1",
      title: "web",
      image: "nginx:latest",
      profile: {
        cpu: 0.1,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 512, unit: "Mi" }]
      },
      expose: [{ port: 80, as: 80, global: true }],
      placementId: "placement-1",
      pricing: { amount: 1000, denom: "uakt" },
      count: 1
    });

    expect(result.success).toBe(true);
  });
});

describe("EnvironmentVariableSchema", () => {
  it("rejects a user-entered reserved key", () => {
    const result = EnvironmentVariableSchema.safeParse({ id: "user-1", key: "SSH_PUBKEY", value: "abc" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["key"], message: '"SSH_PUBKEY" is a reserved variable name' }));
  });

  it("accepts the managed reserved entry whose id matches its key", () => {
    const result = EnvironmentVariableSchema.safeParse({ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "abc" });

    expect(result.success).toBe(true);
  });

  it("accepts a non-reserved key", () => {
    const result = EnvironmentVariableSchema.safeParse({ id: "user-1", key: "FOO", value: "bar" });

    expect(result.success).toBe(true);
  });
});

describe("SdlBuilderFormValuesSchema", () => {
  it("rejects a service whose placementId does not exist in placements[]", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-MISSING",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "placementId"], message: "Service references a placement that does not exist." })
    );
  });

  it("rejects duplicate placement names", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [
        { id: "p-1", name: "dcloud" },
        { id: "p-2", name: "dcloud" }
      ],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["placements", 0, "name"], message: "Placement name must be unique." }));
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["placements", 1, "name"], message: "Placement name must be unique." }));
  });

  it("rejects duplicate service titles", () => {
    const service = {
      id: "svc-1",
      title: "web",
      image: "nginx:latest",
      profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
      expose: [{ port: 80, as: 80, global: true }],
      placementId: "p-1",
      pricing: { amount: 1000, denom: "uakt" },
      count: 1
    };
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [service, { ...service, id: "svc-2" }]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 0, "title"], message: "Service name must be unique." }));
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 1, "title"], message: "Service name must be unique." }));
  });

  it("accepts a valid endpoints array", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ],
      endpoints: [{ id: "e-1", name: "endpoint-1" }]
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate endpoint names", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ],
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-1" }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 0, "name"], message: "Endpoint name must be unique." }));
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 1, "name"], message: "Endpoint name must be unique." }));
  });

  it("accepts a vm service with its single managed SSH expose", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          ...vmService(),
          expose: [
            { port: 22, as: 22, proto: "tcp", global: true },
            { port: 80, as: 80, global: true }
          ]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects a second row exposed as port 22 on a vm service", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          ...vmService(),
          expose: [
            { port: 22, as: 22, proto: "tcp", global: true },
            { port: 8080, as: 22, global: true }
          ]
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "expose", 1, "port"], message: "Port 22 is reserved for SSH." })
    );
  });

  it("rejects a second row using container port 22 on a vm service", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          ...vmService(),
          expose: [
            { port: 22, as: 22, proto: "tcp", global: true },
            { port: 22, as: 2222, global: true }
          ]
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "expose", 1, "port"], message: "Port 22 is reserved for SSH." })
    );
  });

  it("does not reserve port 22 on non-vm services", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          ...vmService(),
          image: "nginx:latest",
          expose: [
            { port: 22, as: 22, proto: "tcp", global: true },
            { port: 8080, as: 22, global: true }
          ]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("exempts only the exact 22-to-22 row: a squatter exposed as 22 gets the error", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          ...vmService(),
          expose: [
            { port: 8080, as: 22, global: true },
            { port: 22, as: 22, proto: "tcp", global: true }
          ]
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "expose", 0, "port"], message: "Port 22 is reserved for SSH." })
    );
  });

  it("requires an ssh key on a vm service even when the deployment-wide flag is off", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [{ ...vmService(), sshPubKey: "" }]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 0, "sshPubKey"], message: "SSH Public key is required." }));
  });

  it("rejects a whitespace-only ssh key on a vm service", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [{ ...vmService(), sshPubKey: "   " }]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 0, "sshPubKey"], message: "SSH Public key is required." }));
  });

  it("flags every storage entry that shares a name, including the first occurrence", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: {
            cpu: 0.1,
            ram: 256,
            ramUnit: "Mi",
            storage: [
              { size: 512, unit: "Mi" },
              { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/a" },
              { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/b" }
            ]
          },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "profile", "storage", 1, "name"], message: "Storage name must be unique" })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "profile", "storage", 2, "name"], message: "Storage name must be unique" })
    );
  });

  it("flags a duplicate name shared by a persistent and a RAM volume", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: {
            cpu: 0.1,
            ram: 256,
            ramUnit: "Mi",
            storage: [
              { size: 512, unit: "Mi" },
              { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "shared", mount: "/mnt/data" },
              { size: 1, unit: "Gi", isPersistent: false, type: "ram", name: "shared", mount: "/dev/shm" }
            ]
          },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "profile", "storage", 1, "name"], message: "Storage name must be unique" })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "profile", "storage", 2, "name"], message: "Storage name must be unique" })
    );
  });

  it("accepts distinct storage names", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "nginx:latest",
          profile: {
            cpu: 0.1,
            ram: 256,
            ramUnit: "Mi",
            storage: [
              { size: 512, unit: "Mi" },
              { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data" },
              { size: 1, unit: "Gi", isPersistent: false, type: "ram", name: "shm", mount: "/dev/shm" }
            ]
          },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("flags duplicate endpoint names even when a service image is invalid", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          id: "svc-1",
          title: "web",
          image: "",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ],
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-1" }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 1, "name"], message: "Endpoint name must be unique." }));
  });

  function vmService() {
    return {
      id: "svc-1",
      title: "vm",
      image: "ghcr.io/akash-network/ubuntu-2404-ssh:2",
      profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
      expose: [{ port: 22, as: 22, proto: "tcp", global: true }],
      placementId: "p-1",
      pricing: { amount: 1000, denom: "uakt" },
      count: 1,
      sshPubKey: "ssh-ed25519 AAAATESTKEY user@host"
    };
  }
});

describe("CredentialsSchema", () => {
  it("rejects a registry password shorter than 6 characters", () => {
    const result = CredentialsSchema.safeParse({ host: "docker.io", username: "alice", password: "12345" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["password"], message: "Password must be at least 6 characters." }));
  });

  it("accepts a registry password of at least 6 characters", () => {
    const result = CredentialsSchema.safeParse({ host: "docker.io", username: "alice", password: "123456" });

    expect(result.success).toBe(true);
  });
});

describe("EndpointSchema", () => {
  it("rejects a name with invalid characters", () => {
    const result = EndpointSchema.safeParse({ id: "e-1", name: "Endpoint_1!" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid lowercase-dashed name", () => {
    const result = EndpointSchema.safeParse({ id: "e-1", name: "endpoint-1" });
    expect(result.success).toBe(true);
  });
});
