import { describe, expect, it } from "vitest";

import { buildHardwareRequestSlackMessage } from "./hardware-request-slack-message";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const AMPLITUDE_PROJECT_URL = "https://app.amplitude.com/analytics/example-org/project/100001";
const ADMIN_URL = "https://console-admin.example.com";
const AMPLITUDE_LINK = `<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${USER_ID}|Amplitude sessions>`;
const ADMIN_LINK = `<${ADMIN_URL}/users/${USER_ID}?tab=hardware-requests|Admin>`;

describe(buildHardwareRequestSlackMessage.name, () => {
  it("posts the request title, the requester, the details, the configuration and links to the user", () => {
    const message = setup({
      hardwareRequest: {
        category: "gpu_model",
        gpuModel: "B200",
        quantity: 8,
        details: "Training run for 3 months",
        contactEmail: "jane@example.com",
        configuration: { summary: "1 vCPU · 2 GB memory · 0 MB storage · Any region", cpu: 1, memoryBytes: 2e9, storageBytes: 0, region: null }
      },
      requesterEmail: "jane@example.com"
    });

    expect(lines(message)).toEqual([
      ":inbox_tray: *GPU request: 8× B200*",
      "jane@example.com",
      "> Training run for 3 months",
      "Current configuration: 1 vCPU · 2 GB memory · 0 MB storage · Any region",
      `${AMPLITUDE_LINK} · ${ADMIN_LINK}`
    ]);
  });

  it("names the requester by account email alone when the contact email matches it in any case", () => {
    const message = setup({ hardwareRequest: { contactEmail: "Jane@Example.com" }, requesterEmail: "jane@example.com" });

    expect(lines(message)[1]).toBe("jane@example.com");
  });

  it("adds the contact email when the requester asked to be answered elsewhere", () => {
    const message = setup({ hardwareRequest: { contactEmail: "ops@example.com" }, requesterEmail: "jane@example.com" });

    expect(lines(message)[1]).toBe("jane@example.com · reply to ops@example.com");
  });

  it.each([null, undefined, ""])("names the requester by user id when the account email is %j", requesterEmail => {
    const message = setup({ hardwareRequest: { contactEmail: "ops@example.com" }, requesterEmail });

    expect(lines(message)[1]).toBe(`${USER_ID} · reply to ops@example.com`);
  });

  it("quotes every line of multi-line details", () => {
    const message = setup({ hardwareRequest: { details: "First line\nSecond line\r\nThird line" } });

    expect(lines(message).slice(2, 5)).toEqual(["> First line", "> Second line", "> Third line"]);
  });

  it("leaves out the details and configuration when the request has neither", () => {
    const message = setup({ hardwareRequest: { details: null, configuration: null } });

    expect(lines(message)).toEqual([":inbox_tray: *GPU request: 8× B200*", "jane@example.com", `${AMPLITUDE_LINK} · ${ADMIN_LINK}`]);
  });

  it("escapes the characters Slack reads as markup in everything the user typed", () => {
    const message = setup({
      hardwareRequest: {
        category: "region",
        gpuModel: null,
        quantity: null,
        region: "<!channel> & co",
        details: "<https://phish.example|click>",
        configuration: { summary: "a<b>c", cpu: 1, memoryBytes: 0, storageBytes: 0, region: null }
      }
    });

    expect(lines(message).slice(0, 4)).toEqual([
      ":inbox_tray: *Region request: &lt;!channel&gt; &amp; co*",
      "jane@example.com",
      "> &lt;https://phish.example|click&gt;",
      "Current configuration: a&lt;b&gt;c"
    ]);
  });

  it("escapes the account and contact emails", () => {
    const message = setup({ hardwareRequest: { contactEmail: "o<p>s@example.com" }, requesterEmail: "a&b@example.com" });

    expect(lines(message)[1]).toBe("a&amp;b@example.com · reply to o&lt;p&gt;s@example.com");
  });

  it("links only to Amplitude when no admin URL is configured", () => {
    const message = setup({ adminUrl: undefined });

    expect(lines(message).at(-1)).toBe(AMPLITUDE_LINK);
  });

  it("links only to the admin page when no Amplitude URL is configured", () => {
    const message = setup({ amplitudeProjectUrl: undefined });

    expect(lines(message).at(-1)).toBe(ADMIN_LINK);
  });

  it("ends on the configuration when no link is configured", () => {
    const message = setup({
      hardwareRequest: { configuration: { summary: "1 vCPU", cpu: 1, memoryBytes: 0, storageBytes: 0, region: null } },
      amplitudeProjectUrl: undefined,
      adminUrl: undefined
    });

    expect(lines(message).at(-1)).toBe("Current configuration: 1 vCPU");
  });

  function lines(message: { text: string }) {
    return message.text.split("\n");
  }

  function setup(
    input: {
      hardwareRequest?: Partial<ReturnType<typeof createHardwareRequest>>;
      requesterEmail?: string | null;
      amplitudeProjectUrl?: string;
      adminUrl?: string;
    } = {}
  ) {
    return buildHardwareRequestSlackMessage({
      hardwareRequest: createHardwareRequest({
        userId: USER_ID,
        category: "gpu_model",
        gpuModel: "B200",
        quantity: 8,
        details: null,
        contactEmail: "jane@example.com",
        configuration: null,
        ...input.hardwareRequest
      }),
      requesterEmail: "requesterEmail" in input ? input.requesterEmail : "jane@example.com",
      amplitudeProjectUrl: "amplitudeProjectUrl" in input ? input.amplitudeProjectUrl : AMPLITUDE_PROJECT_URL,
      adminUrl: "adminUrl" in input ? input.adminUrl : ADMIN_URL
    });
  }
});
