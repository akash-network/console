import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import {
  BidScreeningRequestSchema,
  MAX_PLACEMENT_ATTRIBUTES,
  MAX_REPLICA_COUNT,
  MAX_RESOURCE_UNITS,
  MAX_SIGNED_BY_AUDITORS,
  MAX_STORAGE_VOLUMES
} from "./bid-screening.schema";

const CONSOLE_AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

const DART_TEMPLATE_SDL = `
version: "2.0"
services:
  dart:
    image: google/dart-hello
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
profiles:
  compute:
    dart:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    akash:
      attributes:
        host: akash
      signedBy:
        anyOf:
          - "${CONSOLE_AUDITOR}"
      pricing:
        dart:
          denom: uact
          amount: 10000
deployment:
  dart:
    akash:
      profile: dart
      count: 1
`;

const LEASED_IP_SDL = `
version: "2.0"
endpoints:
  myip:
    kind: ip
services:
  web:
    image: nginx
    expose:
      - port: 80
        to:
          - global: true
            ip: myip
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dc:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dc:
      profile: web
      count: 1
`;

describe("BidScreeningRequestSchema", () => {
  it("accepts a request that declares no CPU attributes", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest());

    expect(result.success).toBe(true);
  });

  it.each(["amd64", "arm64"])("accepts %s as a requested CPU architecture", value => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "arch", value }]));

    expect(result.success).toBe(true);
  });

  it("rejects an architecture outside the SDL enum", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "arch", value: "sparc64" }]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Unsupported CPU architecture "sparc64": expected amd64 or arm64' })
    );
  });

  it("rejects a CPU attribute key other than arch", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "vendor", value: "intel" }]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Unsupported CPU attribute "vendor": "arch" is the only one' })
    );
  });

  it("rejects a request asking for two architectures at once", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequest([
        { key: "arch", value: "amd64" },
        { key: "arch", value: "arm64" }
      ])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Duplicate CPU attribute "arch": a resource asks for one architecture' })
    );
  });

  it.each(["allOf", "anyOf"] as const)("accepts %s auditors up to the cap", list => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS) }, attributes: [] })
    );

    expect(result.success).toBe(true);
  });

  it.each(["allOf", "anyOf"] as const)("rejects %s auditors beyond the cap", list => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS + 1) }, attributes: [] })
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "signedBy", list] })
    );
  });

  it("accepts placement attributes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES) })
    );

    expect(result.success).toBe(true);
  });

  it("rejects placement attributes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES + 1) })
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "attributes"] })
    );
  });

  it("accepts a replica count up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ count: MAX_REPLICA_COUNT })]));

    expect(result.success).toBe(true);
  });

  it("rejects a replica count beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ count: MAX_REPLICA_COUNT + 1 })]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "count"] })
    );
  });

  it("accepts resource units up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits(Array.from({ length: MAX_RESOURCE_UNITS }, () => buildResourceUnit())));

    expect(result.success).toBe(true);
  });

  it("rejects resource units beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits(Array.from({ length: MAX_RESOURCE_UNITS + 1 }, () => buildResourceUnit())));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["resources"] }));
  });

  it("accepts storage volumes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES, "1") })]));

    expect(result.success).toBe(true);
  });

  it("rejects storage volumes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithUnits([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES + 1, "1") })])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "resource", "storage"] })
    );
  });

  it("rejects a resource unit that requests no CPU, memory, GPU or storage", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithUnits([buildResourceUnit({ cpu: "0", memory: "0", gpu: "0", storage: buildStorageVolumes(2, "0") })])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: "A resource unit must request some CPU, memory, GPU or storage", path: ["resources", 0, "resource"] })
    );
  });

  it.each([
    { requested: "CPU", unit: { cpu: "1", memory: "0", gpu: "0", storage: [] } },
    { requested: "memory", unit: { cpu: "0", memory: "1", gpu: "0", storage: [] } },
    { requested: "GPU", unit: { cpu: "0", memory: "0", gpu: "1", storage: [] } },
    { requested: "storage", unit: { cpu: "0", memory: "0", gpu: "0", storage: [...buildStorageVolumes(1, "0"), ...buildStorageVolumes(1, "1")] } }
  ])("accepts a resource unit that requests only $requested", ({ unit }) => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit(unit)]));

    expect(result.success).toBe(true);
  });

  it.each(["1000", "100000.000000000000000000", "0.5"])("accepts %s as a price amount, as the chain spells DecCoin amounts", amount => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ priceAmount: amount })]));

    expect(result.success).toBe(true);
  });

  it.each(["-1", "1.", ".5", "1e3", "1,000", ""])("rejects %j as a price amount", amount => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ priceAmount: amount })]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: "Must be a non-negative decimal string", path: ["resources", 0, "price", "amount"] })
    );
  });

  describe("when the request uses chain-sdk proto JSON field names", () => {
    it("keeps the signer list of a group spec serialized by GroupSpec.toJSON", () => {
      const result = BidScreeningRequestSchema.parse(buildGroupSpecRequest(DART_TEMPLATE_SDL));

      expect(result.requirements).toEqual({
        signedBy: { allOf: [], anyOf: [CONSOLE_AUDITOR] },
        attributes: [{ key: "host", value: "akash" }]
      });
    });

    it("keeps the sequence number of a leased IP serialized by GroupSpec.toJSON", () => {
      const result = BidScreeningRequestSchema.parse(buildGroupSpecRequest(LEASED_IP_SDL));

      expect(result.resources[0].resource.endpoints).toEqual([{}, { kind: "LEASED_IP", sequenceNumber: 1 }]);
    });

    it("reads both signer lists from snake_case names", () => {
      const result = BidScreeningRequestSchema.parse(
        buildRequestWithRequirements({ signed_by: { all_of: ["akash1allof"], any_of: ["akash1anyof"] }, attributes: [] })
      );

      expect(result.requirements.signedBy).toEqual({ allOf: ["akash1allof"], anyOf: ["akash1anyof"] });
    });

    it("prefers the camelCase field when a request spells it both ways", () => {
      const result = BidScreeningRequestSchema.parse(
        buildRequestWithRequirements({ signedBy: { allOf: ["akash1camel"] }, signed_by: { all_of: ["akash1snake"] }, attributes: [] })
      );

      expect(result.requirements.signedBy).toEqual({ allOf: ["akash1camel"], anyOf: [] });
    });

    it("applies the auditor cap to a snake_case signer list", () => {
      const result = BidScreeningRequestSchema.safeParse(
        buildRequestWithRequirements({ signed_by: { any_of: buildAuditors(MAX_SIGNED_BY_AUDITORS + 1) }, attributes: [] })
      );

      expect(result.success).toBe(false);
      expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
        expect.objectContaining({ code: "too_big", path: ["requirements", "signedBy", "anyOf"] })
      );
    });

    it.each([
      { shape: "a string", requirements: "signed" },
      { shape: "null", requirements: null },
      { shape: "an array", requirements: [{ signedBy: { allOf: [] } }] }
    ])("rejects requirements given as $shape", ({ requirements }) => {
      const result = BidScreeningRequestSchema.safeParse({ ...buildRequest(), requirements });

      expect(result.success).toBe(false);
    });

    it("rejects an endpoint given as an array", () => {
      const unit = buildResourceUnit();
      const result = BidScreeningRequestSchema.safeParse(
        buildRequestWithUnits([{ ...unit, resource: { ...unit.resource, endpoints: [["LEASED_IP", 1]] as unknown as never[] } }])
      );

      expect(result.success).toBe(false);
    });
  });

  function buildGroupSpecRequest(sdl: string) {
    const manifest = generateManifest(yaml.raw(sdl) as SDLInput);
    const [groupSpec] = (manifest as Extract<typeof manifest, { ok: true }>).value.groupSpecs;

    return { ...(GroupSpec.toJSON(groupSpec) as object), timezone: "UTC" };
  }

  function buildRequestWithUnits(resources: ReturnType<typeof buildResourceUnit>[]) {
    return { ...buildRequest(), resources };
  }

  function buildResourceUnit(input?: {
    count?: number;
    cpu?: string;
    memory?: string;
    gpu?: string;
    storage?: ReturnType<typeof buildStorageVolumes>;
    priceAmount?: string;
  }) {
    return {
      resource: {
        id: 1,
        cpu: { units: { val: input?.cpu ?? "1000" } },
        memory: { quantity: { val: input?.memory ?? "1073741824" } },
        gpu: { units: { val: input?.gpu ?? "0" } },
        storage: input?.storage ?? buildStorageVolumes(1, "5368709120"),
        endpoints: []
      },
      count: input?.count ?? 1,
      price: { denom: "uakt", amount: input?.priceAmount ?? "1000" }
    };
  }

  function buildStorageVolumes(count: number, quantity: string) {
    return Array.from({ length: count }, (_, index) => ({ name: `volume${index}`, quantity: { val: quantity } }));
  }

  function buildAuditors(count: number) {
    return Array.from({ length: count }, (_, index) => `akash1auditor${index}`);
  }

  function buildPlacementAttributes(count: number) {
    return Array.from({ length: count }, (_, index) => ({ key: `region${index}`, value: "us-west" }));
  }

  function buildRequestWithRequirements(requirements: {
    signedBy?: { allOf?: string[]; anyOf?: string[] };
    signed_by?: { all_of?: string[]; any_of?: string[] };
    attributes: { key: string; value: string }[];
  }) {
    return { ...buildRequest(), requirements };
  }

  function buildRequest(cpuAttributes?: { key: string; value: string }[]) {
    return {
      timezone: "America/Chicago",
      requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
      resources: [
        {
          resource: {
            id: 1,
            cpu: { units: { val: "1000" }, attributes: cpuAttributes },
            memory: { quantity: { val: "1073741824" } },
            gpu: { units: { val: "0" } },
            storage: [{ name: "default", quantity: { val: "5368709120" }, attributes: [{ key: "persistent", value: "false" }] }],
            endpoints: []
          },
          count: 1,
          price: { denom: "uakt", amount: "1000" }
        }
      ]
    };
  }
});
