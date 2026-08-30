import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { providerUnreachableNotification } from "./provider-unreachable-notification";

import { createUser } from "@test/seeders/user.seeder";

const DEPLOYMENT_URL = "https://console.akash.network/deployments/654321";
const CLOSE_AFTER_DAYS = 14;

describe(providerUnreachableNotification.name, () => {
  it("returns a notification naming the deployment, the provider and how long it has been dark", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const downSince = subDays(new Date(), 5);

    const result = providerUnreachableNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      hostUri: "https://provider.akash.cmolls.de:8443",
      downSince: downSince.toISOString(),
      closeAfterDays: CLOSE_AFTER_DAYS,
      deploymentUrl: DEPLOYMENT_URL
    });

    expect(result.notificationId).toBe(`providerUnreachable.${downSince.toISOString()}.654321.akash1owner`);
    expect(result.payload.summary).toBe("Your Akash deployment's provider is unreachable");
    expect(result.payload.description).toContain("<strong>654321</strong>");
    expect(result.payload.description).toContain("<strong>provider.akash.cmolls.de</strong>");
    expect(result.payload.description).toContain("5 days");
    expect(result.payload.description).toContain(`<a href="${DEPLOYMENT_URL}">Close the deployment</a>`);
    expect(result.payload.description).toContain("we will close the deployment for you");
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("makes the closure promise conditional on every provider staying dark", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = providerUnreachableNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      hostUri: "https://dark:8443",
      downSince: subDays(new Date(), 5).toISOString(),
      closeAfterDays: CLOSE_AFTER_DAYS,
      deploymentUrl: DEPLOYMENT_URL
    });

    expect(result.payload.description).toContain("If every provider hosting this deployment is still unreachable");
  });

  it("escapes a host uri the provider declared with markup in it", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = providerUnreachableNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      hostUri: '<script>alert("xss")</script>',
      downSince: subDays(new Date(), 5).toISOString(),
      closeAfterDays: CLOSE_AFTER_DAYS,
      deploymentUrl: DEPLOYMENT_URL
    });

    expect(result.payload.description).not.toContain("<script>");
    expect(result.payload.description).toContain("&lt;script&gt;");
  });

  it("keys the notification id on the outage so a provider that recovers and fails again is reported anew", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const vars = { dseq: "654321", owner: "akash1owner", hostUri: "https://dark:8443", closeAfterDays: CLOSE_AFTER_DAYS, deploymentUrl: DEPLOYMENT_URL };

    const first = providerUnreachableNotification(user, { ...vars, downSince: subDays(new Date(), 9).toISOString() });
    const second = providerUnreachableNotification(user, { ...vars, downSince: subDays(new Date(), 3).toISOString() });

    expect(first.notificationId).not.toBe(second.notificationId);
  });
});
