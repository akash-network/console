import { describe, expect, it } from "vitest";

import { canWithdraw } from "./gpuRequestAccess";

import { buildHardwareRequest } from "@tests/seeders/hardwareRequest";

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
});
