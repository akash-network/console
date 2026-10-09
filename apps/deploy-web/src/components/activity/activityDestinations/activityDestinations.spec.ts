import { describe, expect, it } from "vitest";

import { activityDestinationOf, SUMMARY_DESTINATION } from "./activityDestinations";

import { buildActivity } from "@tests/seeders/activity";

describe("activityDestinations", () => {
  describe(activityDestinationOf.name, () => {
    it("leads a close still running to its deployment", () => {
      const activity = buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a finished close to its deployment", () => {
      const activity = buildActivity({ type: "deployment_close", status: "succeeded", meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a failed close to the settings where the user can close the deployment again", () => {
      const activity = buildActivity({
        type: "deployment_close",
        status: "failed",
        meta: { dseq: "1234", error: { code: "close_incomplete", message: "The deployment is still open." } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234?tab=SETTINGS", label: "Open settings" });
    });

    it("leads a close of one deployment in a bulk close to that deployment", () => {
      const activity = buildActivity({ type: "deployment_close", status: "succeeded", meta: { dseq: "1234", batchId: "batch-1" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a close about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "deployment_close", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });
  });

  describe("SUMMARY_DESTINATION", () => {
    it("leads a summary of several deployments to the deployments list", () => {
      expect(SUMMARY_DESTINATION).toEqual({ href: "/deployments", label: "View deployments" });
    });
  });
});
