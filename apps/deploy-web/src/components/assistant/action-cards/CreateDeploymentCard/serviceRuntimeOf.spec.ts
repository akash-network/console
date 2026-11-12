import { describe, expect, it } from "vitest";

import { serviceRuntimeOf } from "./serviceRuntimeOf";

describe(serviceRuntimeOf.name, () => {
  it("reads the command, args and env of the named service", () => {
    const sdl = [
      "services:",
      "  web:",
      "    image: node:22",
      "    command:",
      "      - sh",
      "      - -c",
      "    args:",
      '      - "npm start"',
      "      - 8080",
      "    env:",
      "      - PORT=8080",
      "      - MODE=production",
      "  worker:",
      "    command: [python]",
      ""
    ].join("\n");

    expect(serviceRuntimeOf(sdl, "web")).toEqual({ command: ["sh", "-c"], args: ["npm start", "8080"], env: ["PORT=8080", "MODE=production"] });
    expect(serviceRuntimeOf(sdl, "worker")).toEqual({ command: ["python"], args: [], env: [] });
  });

  it("answers nothing for a service that is missing, empty or not written as lists", () => {
    const sdl = "services:\n  web:\n    command: npm start\n    env: PORT=8080\n  empty:\n";

    expect(serviceRuntimeOf(sdl, "web")).toEqual({ command: [], args: [], env: [] });
    expect(serviceRuntimeOf(sdl, "empty")).toEqual({ command: [], args: [], env: [] });
    expect(serviceRuntimeOf(sdl, "worker")).toEqual({ command: [], args: [], env: [] });
  });

  it("answers nothing for an SDL that does not parse", () => {
    expect(serviceRuntimeOf("services: [", "web")).toEqual({ command: [], args: [], env: [] });
    expect(serviceRuntimeOf("", "web")).toEqual({ command: [], args: [], env: [] });
  });
});
