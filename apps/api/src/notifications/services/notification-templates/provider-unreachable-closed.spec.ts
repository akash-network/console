import { describe, expect, it } from "vitest";

import { providerUnreachableClosedNotification } from "./provider-unreachable-closed";

import { createUser } from "@test/seeders/user.seeder";

const REDEPLOY_URL = "https://console.akash.network/new-deployment";

describe(providerUnreachableClosedNotification.name, () => {
  it("tells the owner which deployment was closed, why, and that the money came back", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = providerUnreachableClosedNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      hostUri: "https://provider.akash.cmolls.de:8443",
      downForDays: 14,
      redeployUrl: REDEPLOY_URL
    });

    expect(result.notificationId).toBe("providerUnreachableClosed.654321.akash1owner");
    expect(result.payload.summary).toBe("Your Akash deployment was closed: provider unreachable");
    expect(result.payload.description).toContain("<strong>654321</strong>");
    expect(result.payload.description).toContain("<strong>https://provider.akash.cmolls.de:8443</strong>");
    expect(result.payload.description).toContain("14 days ago");
    expect(result.payload.description).toContain("returned");
    expect(result.payload.description).toContain(`<a href="${REDEPLOY_URL}">Deploy it again</a>`);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("escapes a host uri the provider declared with markup in it", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = providerUnreachableClosedNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      hostUri: '<script>alert("xss")</script>',
      downForDays: 14,
      redeployUrl: REDEPLOY_URL
    });

    expect(result.payload.description).not.toContain("<script>");
    expect(result.payload.description).toContain("&lt;script&gt;");
  });
});
