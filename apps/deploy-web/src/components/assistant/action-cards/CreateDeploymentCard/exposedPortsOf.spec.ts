import { describe, expect, it } from "vitest";

import { exposedPortsOf } from "./exposedPortsOf";

describe(exposedPortsOf.name, () => {
  it("lists each exposed port with the port it is reached on", () => {
    const sdl = "services:\n  web:\n    expose:\n      - port: 8000\n        as: 80\n      - port: 9000\n        as: 9001\n      - port: 3000\n";

    expect(exposedPortsOf(sdl, "web")).toEqual(["8000 to 80 (HTTP)", "9000 to 9001", "3000 to 3000"]);
  });

  it("skips entries without a numeric port", () => {
    expect(exposedPortsOf("services:\n  web:\n    expose:\n      - as: 80\n", "web")).toEqual([]);
  });

  it("answers none for a service that is missing or exposes nothing", () => {
    expect(exposedPortsOf("services:\n  web:\n    image: nginx\n", "web")).toEqual([]);
    expect(exposedPortsOf("services:\n  web:\n    image: nginx\n", "worker")).toEqual([]);
  });

  it("answers none for an SDL that does not parse", () => {
    expect(exposedPortsOf("services: [", "web")).toEqual([]);
    expect(exposedPortsOf("", "web")).toEqual([]);
  });
});
