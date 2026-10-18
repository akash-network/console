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

    it.each(["pending", "succeeded"] as const)("leads a %s create to choosing a provider for its deployment", status => {
      const activity = buildActivity({ type: "deployment_create", status, meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/new-deployment/configure/1234", label: "Choose a provider" });
    });

    it("leads a failed create back to configuring a new deployment, since it left none behind", () => {
      const activity = buildActivity({
        type: "deployment_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "create_incomplete", message: "The deployment was not created." } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/new-deployment/configure", label: "New deployment" });
    });

    it.each(["pending" as const, "succeeded" as const])("leads a %s update to its deployment", status => {
      const activity = buildActivity({ type: "deployment_update", status, meta: { dseq: "1234" } });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
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

      expect(activityDestinationOf(activity)).toEqual({ href: "/new-deployment/configure/1234", label: "Choose a provider" });
    });

    it("leads a deploy whose provider never received it to its deployment, where it can be sent again", () => {
      const activity = buildActivity({
        type: "lease_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "manifest_not_delivered", message: "Not sent." } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it("leads a create about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "deployment_create", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });

    it("leads a failed update to the tab where the user can update the deployment again", () => {
      const activity = buildActivity({
        type: "deployment_update",
        status: "failed",
        meta: { dseq: "1234", error: { code: "update_failed", message: "Deployment closed" } }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234?tab=UPDATE", label: "Open update" });
    });

    it("leads an update about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "deployment_update", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });

    it("leads a deploy about no particular deployment to the deployments list", () => {
      const activity = buildActivity({ type: "lease_create", status: "failed", meta: {} });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });

    it.each(["deployment_closed_alert", "deployment_reclaim_alert"] as const)("leads a %s to the deployment it is about", type => {
      const activity = buildActivity({
        type,
        status: "info",
        meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Deployment 1234 closed", dseq: "1234" }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234", label: "View deployment" });
    });

    it.each(["deployment_closed_alert", "deployment_reclaim_alert"] as const)(
      "leads a %s filed in an organization to the deployment in that organization",
      type => {
        const activity = buildActivity({
          type,
          status: "info",
          meta: {
            alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b",
            summary: "Deployment 1234 closed",
            dseq: "1234",
            organizationId: "9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f"
          }
        });

        expect(activityDestinationOf(activity)).toEqual({ href: "/deployments/1234?org=9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f", label: "View deployment" });
      }
    );

    it("leads an alert about no particular deployment to the deployments list", () => {
      const activity = buildActivity({
        type: "deployment_closed_alert",
        status: "info",
        meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "A deployment closed" }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/deployments", label: "View deployments" });
    });

    it("leads a wallet balance alert to billing in the organization it is filed in, where its wallet can be topped up", () => {
      const activity = buildActivity({
        type: "wallet_balance_alert",
        status: "info",
        meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Wallet balance is below 10 AKT", organizationId: "9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f" }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/billing?org=9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f", label: "View billing" });
    });

    it("leads a wallet balance alert filed in no organization to billing in the active one", () => {
      const activity = buildActivity({
        type: "wallet_balance_alert",
        status: "info",
        meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Wallet balance is below 10 AKT" }
      });

      expect(activityDestinationOf(activity)).toEqual({ href: "/billing", label: "View billing" });
    });
  });

  describe("SUMMARY_DESTINATION", () => {
    it("leads a summary of several deployments to the deployments list", () => {
      expect(SUMMARY_DESTINATION).toEqual({ href: "/deployments", label: "View deployments" });
    });
  });
});
