import { describe, expect, it } from "vitest";

import { canWithdraw, describeOfferDecisions } from "./gpuRequestAccess";

import { buildGpuRequestOffer, buildHardwareRequest } from "@tests/seeders/hardwareRequest";

describe("gpuRequestAccess", () => {
  describe(canWithdraw.name, () => {
    it("lets the requester withdraw whatever their role", () => {
      const request = buildHardwareRequest({ userId: "requester", status: "sourcing" });

      expect(canWithdraw(request, { userId: "requester", role: "member" })).toBe(true);
      expect(canWithdraw(request, { userId: "requester", role: undefined })).toBe(true);
    });

    it("lets owners and admins withdraw a teammate's request", () => {
      const request = buildHardwareRequest({ userId: "requester" });

      expect(canWithdraw(request, { userId: "owner", role: "owner" })).toBe(true);
      expect(canWithdraw(request, { userId: "admin", role: "admin" })).toBe(true);
    });

    it.each(["member", "viewer", "billing"] as const)("keeps a %s from withdrawing a teammate's request", role => {
      expect(canWithdraw(buildHardwareRequest({ userId: "requester" }), { userId: "teammate", role })).toBe(false);
    });

    it("keeps a signed-out viewer from matching a request filed for no account", () => {
      expect(canWithdraw(buildHardwareRequest({ userId: null }), { userId: undefined, role: undefined })).toBe(false);
    });

    it.each(["submitted", "in_review", "sourcing", "offers"] as const)("allows withdrawing a %s request", status => {
      expect(canWithdraw(buildHardwareRequest({ status }), { userId: "owner", role: "owner" })).toBe(true);
    });

    it.each(["accepted", "fulfilled", "withdrawn", "closed"] as const)("refuses withdrawing a %s request", status => {
      expect(canWithdraw(buildHardwareRequest({ userId: "requester", status }), { userId: "requester", role: "owner" })).toBe(false);
    });
  });

  describe(describeOfferDecisions.name, () => {
    const request = buildHardwareRequest({ userId: "requester", status: "offers" });
    const openOffer = buildGpuRequestOffer({ status: "published", expired: false });

    it.each(["owner", "admin"] as const)("lets an %s accept or decline", role => {
      expect(describeOfferDecisions(request, openOffer, { userId: "someone", role })).toEqual({ canAccept: true, canDecline: true, canAskForApproval: false });
    });

    it("lets the requester decline and ask an admin to accept", () => {
      expect(describeOfferDecisions(request, openOffer, { userId: "requester", role: "member" })).toEqual({
        canAccept: false,
        canDecline: true,
        canAskForApproval: true
      });
    });

    it.each(["member", "viewer", "billing"] as const)("lets a %s only ask an admin to accept a teammate's request", role => {
      expect(describeOfferDecisions(request, openOffer, { userId: "teammate", role })).toEqual({
        canAccept: false,
        canDecline: false,
        canAskForApproval: true
      });
    });

    it("lets someone outside an organization ask for nothing", () => {
      expect(describeOfferDecisions(request, openOffer, { userId: "requester", role: undefined })).toEqual({
        canAccept: false,
        canDecline: true,
        canAskForApproval: false
      });
    });

    it("lets an expired offer be declined but not accepted", () => {
      const expired = buildGpuRequestOffer({ status: "published", expired: true });

      expect(describeOfferDecisions(request, expired, { userId: "owner", role: "owner" })).toEqual({
        canAccept: false,
        canDecline: true,
        canAskForApproval: false
      });
      expect(describeOfferDecisions(request, expired, { userId: "member", role: "member" }).canAskForApproval).toBe(false);
    });

    it.each(["accepted", "declined", "closed"] as const)("allows nothing on a %s offer", status => {
      expect(describeOfferDecisions(request, buildGpuRequestOffer({ status }), { userId: "owner", role: "owner" })).toEqual({
        canAccept: false,
        canDecline: false,
        canAskForApproval: false
      });
    });

    it.each(["sourcing", "accepted", "withdrawn", "closed"] as const)("allows nothing once the request is %s", status => {
      expect(describeOfferDecisions({ ...request, status }, openOffer, { userId: "owner", role: "owner" })).toEqual({
        canAccept: false,
        canDecline: false,
        canAskForApproval: false
      });
    });
  });
});
