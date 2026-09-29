import { describe, expect, it } from "vitest";

import { hardwareRequestEmailNotification } from "./hardware-request-email-notification";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(hardwareRequestEmailNotification.name, () => {
  it("addresses the notification to the support mailbox", () => {
    const mailbox = { id: "f934d9e8-b4e3-8035-accb-cda9f04e97dc", email: "support@akash.network" };

    const notification = hardwareRequestEmailNotification({ hardwareRequest: createHardwareRequest(), requester: createUser(), mailbox });

    expect(notification.user).toEqual(mailbox);
  });

  it("keys the notification on the hardware request", () => {
    const hardwareRequest = createHardwareRequest();

    const notification = setup({ hardwareRequest });

    expect(notification.notificationId).toBe(`hardwareRequest.${hardwareRequest.id}`);
  });

  it.each([
    { hardwareRequest: createHardwareRequest({ category: "gpu_model", gpuModel: "B200", quantity: 8 }), subject: "GPU request: 8× B200" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: "H100", quantity: 64 }), subject: "Capacity request: 64× H100" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: null, quantity: 32 }), subject: "Capacity request: 32 GPUs" },
    {
      hardwareRequest: createHardwareRequest({ category: "region", gpuModel: null, quantity: null, region: "Frankfurt" }),
      subject: "Region request: Frankfurt"
    },
    { hardwareRequest: createHardwareRequest({ category: "other", gpuModel: null, quantity: null }), subject: "Hardware request" }
  ])("uses '$subject' as the subject of a $hardwareRequest.category request", ({ hardwareRequest, subject }) => {
    const notification = setup({ hardwareRequest });

    expect(notification.payload.summary).toBe(subject);
  });

  it("lists every field the request carries with its label", () => {
    const hardwareRequest = createHardwareRequest({
      category: "capacity",
      gpuModel: "B200",
      quantity: 8,
      region: "Frankfurt",
      details: "Training run for 3 months",
      configuration: { summary: "1 vCPU · 2 GB memory · 0 MB storage · Any region", cpu: 1, memoryBytes: 2e9, storageBytes: 0, region: null }
    });

    const { payload } = setup({ hardwareRequest });

    expect(payload.description).toContain("<p><strong>GPU model:</strong><br>B200</p>");
    expect(payload.description).toContain("<p><strong>Quantity:</strong><br>8</p>");
    expect(payload.description).toContain("<p><strong>Region:</strong><br>Frankfurt</p>");
    expect(payload.description).toContain("<p><strong>Details:</strong><br>Training run for 3 months</p>");
    expect(payload.description).toContain("<p><strong>Current configuration:</strong><br>1 vCPU · 2 GB memory · 0 MB storage · Any region</p>");
  });

  it("renders one paragraph per field the request carries, and nothing for the rest", () => {
    const hardwareRequest = createHardwareRequest({
      category: "region",
      gpuModel: null,
      quantity: null,
      region: "Frankfurt",
      details: null,
      contactEmail: "jane@example.com",
      configuration: null
    });
    const requester = createUser({ id: hardwareRequest.userId, email: "account@example.com", username: "jane" });

    const { payload } = setup({ hardwareRequest, requester });

    expect(payload.description).toBe(
      "<p><strong>Region:</strong><br>Frankfurt</p>" +
        '<p><strong>Reply to:</strong> <a href="mailto:jane@example.com">jane@example.com</a></p>' +
        "<p><strong>Account email:</strong><br>account@example.com</p>" +
        "<p><strong>Username:</strong><br>jane</p>" +
        `<p><strong>User ID:</strong><br>${hardwareRequest.userId}</p>`
    );
  });

  it("leaves out the fields the request does not carry", () => {
    const hardwareRequest = createHardwareRequest({ category: "other", gpuModel: null, quantity: null, region: null, configuration: null });

    const { payload } = setup({ hardwareRequest });

    expect(payload.description).not.toContain("GPU model:");
    expect(payload.description).not.toContain("Quantity:");
    expect(payload.description).not.toContain("Region:");
    expect(payload.description).not.toContain("Current configuration:");
  });

  it("links the contact email so support can reply to it", () => {
    const hardwareRequest = createHardwareRequest({ contactEmail: "jane@example.com" });

    const { payload } = setup({ hardwareRequest });

    expect(payload.description).toContain('<p><strong>Reply to:</strong> <a href="mailto:jane@example.com">jane@example.com</a></p>');
  });

  it("identifies the account the request came from", () => {
    const hardwareRequest = createHardwareRequest();
    const requester = createUser({ id: hardwareRequest.userId, email: "account@example.com", username: "jane" });

    const { payload } = setup({ hardwareRequest, requester });

    expect(payload.description).toContain("<p><strong>Account email:</strong><br>account@example.com</p>");
    expect(payload.description).toContain("<p><strong>Username:</strong><br>jane</p>");
    expect(payload.description).toContain(`<p><strong>User ID:</strong><br>${hardwareRequest.userId}</p>`);
  });

  it("still identifies the user id when the requester account is gone", () => {
    const hardwareRequest = createHardwareRequest();

    const { payload } = setup({ hardwareRequest, requester: undefined });

    expect(payload.description).not.toContain("Account email:");
    expect(payload.description).toContain(`<p><strong>User ID:</strong><br>${hardwareRequest.userId}</p>`);
  });

  it("escapes markup the user typed", () => {
    const hardwareRequest = createHardwareRequest({ details: '<a href="https://phish.example">click</a>', contactEmail: 'x"@example.com' });

    const { payload } = setup({ hardwareRequest });

    expect(payload.description).toContain("&lt;a href=&quot;https://phish.example&quot;&gt;click&lt;/a&gt;");
    expect(payload.description).toContain('href="mailto:x&quot;@example.com"');
    expect(payload.description).not.toContain('https://phish.example"');
  });

  it("keeps the line breaks of multi-line details", () => {
    const hardwareRequest = createHardwareRequest({ details: "First line\nSecond line\r\nThird line" });

    const { payload } = setup({ hardwareRequest });

    expect(payload.description).toContain("First line<br>Second line<br>Third line");
  });

  function setup(input: { hardwareRequest: ReturnType<typeof createHardwareRequest>; requester?: ReturnType<typeof createUser> }) {
    const requester = "requester" in input ? input.requester : createUser();

    return hardwareRequestEmailNotification({
      hardwareRequest: input.hardwareRequest,
      requester,
      mailbox: { id: "f934d9e8-b4e3-8035-accb-cda9f04e97dc", email: "support@akash.network" }
    });
  }
});
