import { describe, expect, it } from "vitest";

import { describeDeploymentChanges, readDeploymentChanges, renameTitleOf } from "./deploymentChanges";

describe("deploymentChanges", () => {
  describe(describeDeploymentChanges.name, () => {
    it("names the variables a service gained, got a new value for and lost", () => {
      const detail = describeDeploymentChanges({
        services: [{ service: "web", addedEnv: ["LOG_LEVEL"], changedEnv: ["API_URL"], removedEnv: ["DEBUG"] }]
      });

      expect(detail).toBe("Added LOG_LEVEL, changed API_URL and removed DEBUG in web.");
    });

    it("names the image a service now runs", () => {
      expect(describeDeploymentChanges({ services: [{ service: "web", image: "nginx:1.27" }] })).toBe("Set the image to nginx:1.27 in web.");
    });

    it("names the settings a service changed in words", () => {
      const detail = describeDeploymentChanges({
        services: [{ service: "web", settings: ["command", "args", "credentials", "expose", "storage"] }]
      });

      expect(detail).toBe("Changed the command, the arguments, the registry credentials and 2 more in web.");
    });

    it("names the exposed ports and storage a service changed", () => {
      expect(describeDeploymentChanges({ services: [{ service: "web", settings: ["expose", "storage"] }] })).toBe(
        "Changed the exposed ports and the storage in web."
      );
    });

    it("leaves out a setting this app has no words for", () => {
      expect(describeDeploymentChanges({ services: [{ service: "web", settings: ["gpu", "command"] }] })).toBe("Changed the command in web.");
    });

    it("counts the variables past the third rather than naming them", () => {
      expect(describeDeploymentChanges({ services: [{ service: "web", changedEnv: ["A", "B", "C", "D", "E"] }] })).toBe("Changed A, B, C and 2 more in web.");
    });

    it("names every kind of change to a service in one sentence", () => {
      const detail = describeDeploymentChanges({
        services: [{ service: "web", image: "nginx:1.27", addedEnv: ["A"], changedEnv: ["B"], removedEnv: ["C"], settings: ["command"] }]
      });

      expect(detail).toBe("Set the image to nginx:1.27, added A, changed B, removed C and changed the command in web.");
    });

    it("gives each service its own sentence", () => {
      const detail = describeDeploymentChanges({
        services: [
          { service: "web", changedEnv: ["API_URL"] },
          { service: "api", image: "node:22" }
        ]
      });

      expect(detail).toBe("Changed API_URL in web. Set the image to node:22 in api.");
    });

    it("names a rename made beside the services it changed first", () => {
      const detail = describeDeploymentChanges({ name: { from: "web", to: "web-update" }, services: [{ service: "web", changedEnv: ["API_URL"] }] });

      expect(detail).toBe("Renamed from “web”. Changed API_URL in web.");
    });

    it("names a deployment that had no name before", () => {
      expect(describeDeploymentChanges({ name: { from: null, to: "web-update" } })).toBe("Named “web-update”.");
    });

    it("names nothing for a service whose changes name nothing", () => {
      expect(describeDeploymentChanges({ services: [{ service: "web" }] })).toBeUndefined();
    });

    it("names nothing when there are no changes", () => {
      expect(describeDeploymentChanges(undefined)).toBeUndefined();
      expect(describeDeploymentChanges({})).toBeUndefined();
    });
  });

  describe(renameTitleOf.name, () => {
    it("names the names before and after", () => {
      expect(renameTitleOf({ from: "web", to: "web-update" })).toBe("Renamed “web” to “web-update”");
    });

    it("names only the new name of a deployment that had none", () => {
      expect(renameTitleOf({ from: null, to: "web-update" })).toBe("Named a deployment “web-update”");
    });
  });

  describe(readDeploymentChanges.name, () => {
    it("reads changes in the shape the api writes", () => {
      const changes = { name: { from: "web", to: "web-update" }, services: [{ service: "web", changedEnv: ["API_URL"] }] };

      expect(readDeploymentChanges(changes)).toEqual(changes);
    });

    it("reads nothing from a value of another shape", () => {
      expect(readDeploymentChanges("API_URL")).toBeUndefined();
      expect(readDeploymentChanges({ services: [{ changedEnv: ["API_URL"] }] })).toBeUndefined();
      expect(readDeploymentChanges(undefined)).toBeUndefined();
    });
  });
});
