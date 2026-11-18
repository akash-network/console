import { describe, expect, it } from "vitest";

import { gpuAvailableNotification } from "./gpu-available-notification";

describe(gpuAvailableNotification.name, () => {
  it("announces the setup with its price and both links", () => {
    const notification = setup({});

    expect(notification).toEqual({
      notificationId: "gpuAvailable.entry-1.2",
      payload: {
        summary: "8× H100 80Gi SXM5 is available on Akash",
        description: expect.stringContaining("from $2.50/hr"),
        actions: [
          { label: "Deploy now", url: "https://console.example.com/deploy" },
          { label: "Stop these alerts", url: "https://console.example.com/leave" }
        ]
      },
      user: { id: "user-1", email: "jane@example.com" }
    });
  });

  it("says the first to deploy gets it", () => {
    expect(setup({}).payload.description).toContain("The first to deploy gets it");
  });

  it("tells trial users how to unlock gpus", () => {
    expect(setup({ isTrial: true }).payload.description).toContain("Add a payment method to deploy GPUs");
    expect(setup({ isTrial: false }).payload.description).not.toContain("Add a payment method");
  });

  it("rounds the price to cents", () => {
    expect(setup({ priceUsdPerHour: 1.4166666 }).payload.description).toContain("from $1.42/hr");
  });

  it("escapes the setup label in the email body", () => {
    expect(setup({ setupLabel: "<b>8× H100</b>" }).payload.description).toContain("&lt;b&gt;8× H100&lt;/b&gt; is available");
  });

  it("is keyed on the entry and wave", () => {
    expect(setup({ waveNumber: 1 }).notificationId).not.toBe(setup({ waveNumber: 2 }).notificationId);
    expect(setup({ waveNumber: 1 }).notificationId).toBe(setup({ waveNumber: 1 }).notificationId);
  });

  function setup(input: { isTrial?: boolean; waveNumber?: number; priceUsdPerHour?: number; setupLabel?: string }) {
    return gpuAvailableNotification(
      { id: "user-1", email: "jane@example.com" },
      {
        entryId: "entry-1",
        setupLabel: input.setupLabel ?? "8× H100 80Gi SXM5",
        priceUsdPerHour: input.priceUsdPerHour ?? 2.5,
        isTrial: input.isTrial ?? false,
        deployUrl: "https://console.example.com/deploy",
        leaveUrl: "https://console.example.com/leave",
        waveNumber: input.waveNumber ?? 2
      }
    );
  }
});
