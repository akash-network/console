import { describe, expect, it } from "vitest";

import { activityDestinationOf } from "./activityDestinations";

import { buildActivity } from "@tests/seeders/activity";

describe("activityDestinations", () => {
  describe(activityDestinationOf.name, () => {
    it("leads a finished close to its deployment", () => {
      const activity = buildActivity({ type: "deployment_close", status: "succeeded", meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a failed close to the settings where the user can close the deployment again", () => {
      const activity = buildActivity({ type: "deployment_close", status: "failed", meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234?tab=SETTINGS", label: "Open settings" });
    });

    it("leads a close about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "deployment_close", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });

    it.each(["pending", "succeeded"] as const)("leads a %s deploy to its deployment", status => {
      const activity = buildActivity({ type: "lease_create", status, meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a deploy that failed back to choosing a provider for its deployment", () => {
      const activity = buildActivity({
        type: "lease_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "lease_not_created", message: "No lease." } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/new-deployment/configure/1234", label: "Choose a provider" });
    });

    it("leads a deploy that failed with no reason back to choosing a provider", () => {
      const activity = buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity).label).toBe("Choose a provider");
    });

    it("leads a deploy whose provider never received it to its deployment, where it can be sent again", () => {
      const activity = buildActivity({
        type: "lease_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "manifest_not_delivered", message: "Not sent." } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a deploy about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "lease_create", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });
  });
});
