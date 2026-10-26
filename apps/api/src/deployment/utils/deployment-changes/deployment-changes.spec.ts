import type { SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import { deploymentChangesOf } from "./deployment-changes";

type SdlServices = SDLInput["services"];

describe(deploymentChangesOf.name, () => {
  const UNNAMED = { from: null, to: undefined };

  it("names the image a service now runs", () => {
    const changes = changesOf({ web: { image: "nginx" } }, { web: { image: "nginx:1.27" } });

    expect(changes).toEqual({ services: [{ service: "web", image: "nginx:1.27" }] });
  });

  it("names the variables a service gained, lost and got a new value for, by name alone", () => {
    const changes = changesOf(
      { web: { image: "nginx", env: ["API_URL=https://old", "DEBUG=1", "KEEP=same"] } },
      { web: { image: "nginx", env: ["KEEP=same", "API_URL=https://new", "LOG_LEVEL=info"] } }
    );

    expect(changes).toEqual({ services: [{ service: "web", addedEnv: ["LOG_LEVEL"], changedEnv: ["API_URL"], removedEnv: ["DEBUG"] }] });
  });

  it("counts a variable that only moved in the list as unchanged", () => {
    const changes = changesOf({ web: { image: "nginx", env: ["A=1", "B=2"] } }, { web: { image: "nginx", env: ["B=2", "A=1"] } });

    expect(changes).toBeUndefined();
  });

  it("names a variable inherited from the host by its bare name", () => {
    const changes = changesOf({ web: { image: "nginx", env: ["HOME"] } }, { web: { image: "nginx", env: ["HOME=/root"] } });

    expect(changes).toEqual({ services: [{ service: "web", changedEnv: ["HOME"] }] });
  });

  it("reads a service declaring no env list as declaring no variable", () => {
    const changes = changesOf({ web: { image: "nginx", env: null } }, { web: { image: "nginx", env: ["A=1"] } });

    expect(changes).toEqual({ services: [{ service: "web", addedEnv: ["A"] }] });
  });

  it("skips an env entry that is not a string, as a hand-written SDL can hold", () => {
    const changes = changesOf({ web: { image: "nginx", env: [42 as unknown as string] } }, { web: { image: "nginx", env: [42 as unknown as string, "A=1"] } });

    expect(changes).toEqual({ services: [{ service: "web", addedEnv: ["A"] }] });
  });

  it("names the command, args, credentials and endpoints a service changed", () => {
    const changes = changesOf(
      {
        web: {
          image: "nginx",
          command: ["sh"],
          args: ["-c", "old"],
          credentials: { host: "ghcr.io", username: "ac-secret://u", password: "ac-secret://p" },
          expose: [{ port: 80, as: 80, to: [{ global: true }] }]
        }
      },
      {
        web: {
          image: "nginx",
          command: ["bash"],
          args: ["-c", "new"],
          credentials: { host: "ghcr.io", username: "user", password: "password" },
          expose: [{ port: 8080, as: 80, to: [{ global: true }] }]
        }
      }
    );

    expect(changes).toEqual({ services: [{ service: "web", settings: ["command", "args", "credentials", "expose"] }] });
  });

  it("names the storage a service mounts differently", () => {
    const changes = changesOf(
      { web: { image: "nginx", params: { storage: { data: { mount: "/data", readOnly: false } } } } },
      { web: { image: "nginx", params: { storage: { data: { mount: "/var/data", readOnly: false } } } } }
    );

    expect(changes).toEqual({ services: [{ service: "web", settings: ["storage"] }] });
  });

  it("names a cleared command", () => {
    const changes = changesOf({ web: { image: "nginx", command: ["sh"] } }, { web: { image: "nginx" } });

    expect(changes).toEqual({ services: [{ service: "web", settings: ["command"] }] });
  });

  it("reads only the services the patch named", () => {
    const changes = deploymentChangesOf({
      name: UNNAMED,
      services: {
        before: { web: { image: "nginx" }, api: { image: "node:20" } },
        after: { web: { image: "nginx:1.27" }, api: { image: "node:22" } },
        patched: ["web"]
      }
    });

    expect(changes).toEqual({ services: [{ service: "web", image: "nginx:1.27" }] });
  });

  it("leaves out a patched service whose fields all stayed as they were", () => {
    const changes = deploymentChangesOf({
      name: UNNAMED,
      services: {
        before: { web: { image: "nginx" }, api: { image: "node:20" } },
        after: { web: { image: "nginx:1.27" }, api: { image: "node:20" } },
        patched: ["web", "api"]
      }
    });

    expect(changes).toEqual({ services: [{ service: "web", image: "nginx:1.27" }] });
  });

  it("names nothing for a patched service neither side declares", () => {
    const changes = deploymentChangesOf({ name: UNNAMED, services: { before: {}, after: {}, patched: ["web"] } });

    expect(changes).toBeUndefined();
  });

  it("names the deployment's name before and after a rename", () => {
    const changes = deploymentChangesOf({ name: { from: "web", to: "web-update" }, services: noServiceChange() });

    expect(changes).toEqual({ name: { from: "web", to: "web-update" } });
  });

  it("names a deployment the console held no name for as renamed from none", () => {
    const changes = deploymentChangesOf({ name: { from: null, to: "web-update" }, services: noServiceChange() });

    expect(changes).toEqual({ name: { from: null, to: "web-update" } });
  });

  it("names no rename for a name the patch left out or repeated", () => {
    expect(deploymentChangesOf({ name: { from: "web", to: undefined }, services: noServiceChange() })).toBeUndefined();
    expect(deploymentChangesOf({ name: { from: "web", to: "web" }, services: noServiceChange() })).toBeUndefined();
  });

  it("names a rename beside the services it changed", () => {
    const changes = deploymentChangesOf({
      name: { from: "web", to: "web-update" },
      services: { before: { web: { image: "nginx" } }, after: { web: { image: "nginx:1.27" } }, patched: ["web"] }
    });

    expect(changes).toEqual({ name: { from: "web", to: "web-update" }, services: [{ service: "web", image: "nginx:1.27" }] });
  });

  function changesOf(before: SdlServices, after: SdlServices) {
    return deploymentChangesOf({ name: UNNAMED, services: { before, after, patched: Object.keys(after) } });
  }

  function noServiceChange() {
    return { before: { web: { image: "nginx" } }, after: { web: { image: "nginx" } }, patched: ["web"] };
  }
});
