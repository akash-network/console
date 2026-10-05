import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { listSdlImportChanges } from "./sdlImportChanges";

describe(listSdlImportChanges.name, () => {
  it("reports nothing for SDLs that deploy alike", () => {
    expect(listSdlImportChanges(sdlOf({}), sdlOf({}))).toEqual([]);
  });

  it("ignores the order services, placements, volumes and attributes are listed in", () => {
    const amounts = { web: 1000, api: 2000 };
    const listed = sdlOf({
      services: ["web", "api"],
      placements: ["east", "west"],
      storage: ["data", "logs"],
      placementAttributes: ["region: us", "tier: a"],
      amounts
    });
    const reordered = sdlOf({
      services: ["api", "web"],
      placements: ["west", "east"],
      storage: ["logs", "data"],
      placementAttributes: ["tier: a", "region: us"],
      amounts
    });

    expect(listSdlImportChanges(listed, reordered)).toEqual([]);
  });

  it("ignores the order ports are listed in", () => {
    const http = ["      - port: 80", "        as: 80", "        to:", "          - global: true"];
    const ssh = ["      - port: 22", "        as: 22", "        proto: tcp", "        to:", "          - global: true"];

    expect(listSdlImportChanges(sdlOf({ expose: [...http, ...ssh] }), sdlOf({ expose: [...ssh, ...http] }))).toEqual([]);
  });

  it("ignores a port written without `as` against the same port written with it", () => {
    expect(listSdlImportChanges(sdlOf({ expose: ["      - port: 80", "        to:", "          - global: true"] }), sdlOf({}))).toEqual([]);
  });

  it("ignores the service an expose names and a repeated internal port", () => {
    const named = sdlOf({ expose: ["      - port: 80", "        as: 80", "        to:", "          - global: true", "          - service: api"] });
    const repeated = sdlOf({
      expose: ["      - port: 80", "        as: 80", "        to:", "          - global: true", "          - global: false", "          - service: web"]
    });

    expect(listSdlImportChanges(named, repeated)).toEqual([]);
  });

  it("ignores a bare variable name against the same name set to empty", () => {
    expect(listSdlImportChanges(sdlOf({ env: ["      - DEBUG"] }), sdlOf({ env: ["      - DEBUG="] }))).toEqual([]);
  });

  it("ignores empty params against none", () => {
    expect(listSdlImportChanges(sdlOf({ serviceExtra: ["    params: {}"] }), sdlOf({}))).toEqual([]);
  });

  it("reports a placement left out with the services it runs", () => {
    const changes = listSdlImportChanges(
      sdlOf({ services: ["web", "api"], placements: ["east", "west"] }),
      sdlOf({ services: ["web", "api"], placements: ["east"] })
    );

    expect(changes).toEqual(['Placement "west" and the services it runs (api, web) are left out.']);
  });

  it("reports a placement added", () => {
    expect(listSdlImportChanges(sdlOf({ placements: ["east"] }), sdlOf({ placements: ["east", "west"] }))).toEqual(['Placement "west" is added.']);
  });

  it("reports a service left out of a placement it still shares", () => {
    const changes = listSdlImportChanges(sdlOf({ services: ["web", "api"] }), sdlOf({ services: ["web"] }));

    expect(changes).toEqual(['Service "api" is left out of placement "east".', 'Placement "east" gets different pricing.']);
  });

  it("reports a service added to a placement", () => {
    const changes = listSdlImportChanges(sdlOf({ services: ["web"] }), sdlOf({ services: ["web", "api"] }));

    expect(changes).toEqual(['Service "api" is added to placement "east".', 'Placement "east" gets different pricing.']);
  });

  it.each([
    { field: "image", changed: { image: "nginx:2" }, expected: "a different image" },
    { field: "command", changed: { serviceExtra: ["    command:", "      - sh"] }, expected: "a different command" },
    { field: "args", changed: { serviceExtra: ["    args:", "      - --verbose"] }, expected: "different arguments" },
    { field: "env", original: { env: ["      - DEBUG=1"] }, changed: { env: ["      - DEBUG=2"] }, expected: "different environment variables" },
    { field: "resources", changed: { memory: "1Gi" }, expected: "different resources" },
    { field: "count", changed: { count: 2 }, expected: "a different replica count" },
    {
      field: "expose",
      original: { expose: ["      - port: 3000", "        as: 8080", "        to:", "          - global: true"] },
      changed: { expose: ["      - port: 3000", "        as: 9090", "        to:", "          - global: true"] },
      expected: "different exposed ports"
    },
    {
      field: "params",
      changed: { serviceExtra: ["    params:", "      permissions:", "        read:", "          - logs"] },
      expected: "different storage mounts or permissions"
    },
    {
      field: "credentials",
      changed: {
        serviceExtra: ["    credentials:", "      host: ghcr.io", "      username: alice", `      password: ${JSON.stringify(faker.internet.password())}`]
      },
      expected: "different registry credentials"
    }
  ])("reports a service that gets $expected when its $field changes", ({ original, changed, expected }) => {
    expect(listSdlImportChanges(sdlOf(original ?? {}), sdlOf(changed))).toEqual([`Service "web" gets ${expected}.`]);
  });

  it("names every field a service gets differently in one sentence", () => {
    const changes = listSdlImportChanges(sdlOf({}), sdlOf({ image: "nginx:2", serviceExtra: ["    args:", "      - --verbose"], count: 2 }));

    expect(changes).toEqual(['Service "web" gets a different image, different arguments, and a different replica count.']);
  });

  it("reports a placement that gets different provider requirements and pricing", () => {
    const changes = listSdlImportChanges(sdlOf({}), sdlOf({ placementAttributes: ["region: us"], amount: 2000 }));

    expect(changes).toEqual(['Placement "east" gets different provider requirements and different pricing.']);
  });

  it("reports a different reclamation window", () => {
    expect(listSdlImportChanges(sdlOf({ rootExtra: ["reclamation:", "  min_window: 90m"] }), sdlOf({}))).toEqual([
      "The minimum reclamation window is different."
    ]);
  });

  it.each([
    ["is not YAML", "services: [unclosed"],
    ["fails the SDL schema", "version: '2.0'\nservices: {}"]
  ])("reports nothing when an SDL %s", (_reason, broken) => {
    expect(listSdlImportChanges(broken, sdlOf({}))).toEqual([]);
    expect(listSdlImportChanges(sdlOf({}), broken)).toEqual([]);
  });

  function sdlOf(input: {
    services?: string[];
    placements?: string[];
    storage?: string[];
    placementAttributes?: string[];
    image?: string;
    expose?: string[];
    env?: string[];
    serviceExtra?: string[];
    rootExtra?: string[];
    memory?: string;
    count?: number;
    amount?: number;
    amounts?: Record<string, number>;
  }): string {
    const services = input.services ?? ["web"];
    const placements = input.placements ?? ["east"];
    const storage = input.storage ?? [];
    const firstService = services.indexOf("web") === -1 ? services[0] : "web";
    return [
      'version: "2.0"',
      ...(input.rootExtra ?? []),
      "services:",
      ...services.flatMap(name => [
        `  ${name}:`,
        `    image: ${name === firstService ? input.image ?? "nginx:1" : "nginx:1"}`,
        "    expose:",
        ...(name === firstService && input.expose ? input.expose : ["      - port: 80", "        as: 80", "        to:", "          - global: true"]),
        ...(name === firstService && input.env ? ["    env:", ...input.env] : []),
        ...(storage.length > 0 ? ["    params:", "      storage:", ...storage.flatMap(volume => [`        ${volume}:`, `          mount: /${volume}`])] : []),
        ...(name === firstService ? input.serviceExtra ?? [] : [])
      ]),
      "profiles:",
      "  compute:",
      ...services.flatMap(name => [
        `    ${name}:`,
        "      resources:",
        "        cpu:",
        "          units: 0.5",
        "        memory:",
        `          size: ${name === firstService ? input.memory ?? "512Mi" : "512Mi"}`,
        "        storage:",
        "          - size: 512Mi",
        ...storage.flatMap(volume => [
          `          - name: ${volume}`,
          "            size: 1Gi",
          "            attributes:",
          "              persistent: true",
          "              class: beta3"
        ])
      ]),
      "  placement:",
      ...placements.flatMap(placement => [
        `    ${placement}:`,
        ...(input.placementAttributes ? ["      attributes:", ...input.placementAttributes.map(attribute => `        ${attribute}`)] : []),
        "      pricing:",
        ...services.flatMap(name => [`        ${name}:`, "          denom: uact", `          amount: ${input.amounts?.[name] ?? input.amount ?? 1000}`])
      ]),
      "deployment:",
      ...services.flatMap(name => [
        `  ${name}:`,
        ...placements.flatMap(placement => [`    ${placement}:`, `      profile: ${name}`, `      count: ${name === firstService ? input.count ?? 1 : 1}`])
      ])
    ].join("\n");
  }
});
