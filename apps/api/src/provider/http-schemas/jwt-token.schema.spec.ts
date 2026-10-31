import { describe, expect, it } from "vitest";

import { CreateJwtTokenRequestSchema } from "./jwt-token.schema";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const provider = createAkashAddress();
const deployment = { dseq: 123, scope: ["logs"], services: ["web"] };

describe("CreateJwtTokenRequestSchema", () => {
  it.each([
    { name: "full access", leases: { access: "full" } },
    { name: "actions across every lease", leases: { access: "scoped", scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"] } },
    { name: "full access to a provider", leases: { access: "granular", permissions: [{ provider, access: "full" }] } },
    { name: "actions on a provider", leases: { access: "granular", permissions: [{ provider, access: "scoped", scope: ["logs", "shell"] }] } },
    { name: "actions on a deployment", leases: { access: "granular", permissions: [{ provider, access: "granular", deployments: [deployment] }] } },
    {
      name: "actions on an order of a deployment",
      leases: { access: "granular", permissions: [{ provider, access: "granular", deployments: [{ ...deployment, gseq: 1, oseq: 1 }] }] }
    }
  ])("accepts $name", ({ leases }) => {
    const result = CreateJwtTokenRequestSchema.safeParse({ ttl: 60, leases });

    expect(result).toEqual({ success: true, data: { ttl: 60, leases } });
  });

  it.each([
    { name: "an unknown access level", leases: { access: "admin" } },
    { name: "actions on full access", leases: { access: "full", scope: ["shell"] } },
    { name: "a provider list on scoped access", leases: { access: "scoped", scope: ["logs"], permissions: [{ provider, access: "full" }] } },
    { name: "an unknown action", leases: { access: "scoped", scope: ["admin"] } },
    { name: "a repeated action", leases: { access: "scoped", scope: ["logs", "logs"] } },
    { name: "actions given as a string", leases: { access: "scoped", scope: "logs" } },
    { name: "no action", leases: { access: "scoped", scope: [] } },
    { name: "no provider", leases: { access: "granular", permissions: [] } },
    {
      name: "a provider named twice",
      leases: {
        access: "granular",
        permissions: [
          { provider, access: "full" },
          { provider, access: "scoped", scope: ["logs"] }
        ]
      }
    },
    { name: "a provider that is not an address", leases: { access: "granular", permissions: [{ provider: "akash1provider", access: "full" }] } },
    {
      name: "a deployment list on a scoped provider",
      leases: { access: "granular", permissions: [{ provider, access: "scoped", scope: ["logs"], deployments: [deployment] }] }
    },
    { name: "no deployment", leases: { access: "granular", permissions: [{ provider, access: "granular", deployments: [] }] } },
    { name: "a dseq given as a string", leases: granularOn({ ...deployment, dseq: "123" }) },
    { name: "a dseq of zero", leases: granularOn({ ...deployment, dseq: 0 }) },
    { name: "a deployment without services", leases: granularOn({ dseq: 123, scope: ["logs"] }) },
    { name: "a repeated service", leases: granularOn({ ...deployment, services: ["web", "web"] }) },
    { name: "an order without its group", leases: granularOn({ ...deployment, oseq: 1 }) },
    { name: "an unknown property on a deployment", leases: granularOn({ ...deployment, owner: provider }) }
  ])("rejects $name", ({ leases }) => {
    const result = CreateJwtTokenRequestSchema.safeParse({ ttl: 60, leases });

    expect(result.success).toBe(false);
  });

  function granularOn(deploymentPermission: Record<string, unknown>) {
    return { access: "granular", permissions: [{ provider, access: "granular", deployments: [deploymentPermission] }] };
  }
});
