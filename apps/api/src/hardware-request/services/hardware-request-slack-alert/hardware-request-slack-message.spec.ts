import { describe, expect, it } from "vitest";

import type { HardwareRequestAlertContext } from "@src/hardware-request/lib/hardware-request-alert-summary/hardware-request-alert-summary";
import { buildHardwareRequestSlackMessage } from "./hardware-request-slack-message";

import { createHardwareRequest, createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

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
      "*Automated lane (below sales thresholds) · est. $11,680/month*",
      "Acme · Trial · via the request form",
      "jane@example.com",
      "> Training run for 3 months",
      "Sent while configuring: 1 vCPU · 2 GB memory · 0 MB storage · Any region",
      `${AMPLITUDE_LINK} · ${ADMIN_LINK}`
    ]);
  });

  it("lists each answer of a quote request as a bullet under the requester", () => {
    const spec = createHardwareRequestSpec({ gpu: { model: "A100", count: 1, interconnect: "none" }, region: { mode: "only", areas: ["apac"] } });
    const message = setup({ hardwareRequest: { category: "quote", spec, details: null }, requesterEmail: "jane@example.com" });

    expect(lines(message).slice(3, 6)).toEqual([expect.any(String), "• 1× A100", "• Asia Pacific"]);
  });

  it("escapes markup in the answers of a quote request", () => {
    const spec = createHardwareRequestSpec({ company: "<Acme & Co>" });
    const message = setup({ hardwareRequest: { category: "quote", spec }, requesterEmail: "jane@example.com" });

    expect(lines(message)).toContain("• Company: &lt;Acme &amp; Co&gt;");
  });

  it("names the requester by account email alone when the contact email matches it in any case", () => {
    const message = setup({ hardwareRequest: { contactEmail: "Jane@Example.com" }, requesterEmail: "jane@example.com" });

    expect(lines(message)[3]).toBe("jane@example.com");
  });

  it("adds the contact email when the requester asked to be answered elsewhere", () => {
    const message = setup({ hardwareRequest: { contactEmail: "ops@example.com" }, requesterEmail: "jane@example.com" });

    expect(lines(message)[3]).toBe("jane@example.com · reply to ops@example.com");
  });

  it.each([null, undefined, ""])("names the requester by user id when the account email is %j", requesterEmail => {
    const message = setup({ hardwareRequest: { contactEmail: "ops@example.com" }, requesterEmail });

    expect(lines(message)[3]).toBe(`${USER_ID} · reply to ops@example.com`);
  });

  it("quotes every line of multi-line details", () => {
    const message = setup({ hardwareRequest: { details: "First line\nSecond line\r\nThird line" } });

    expect(lines(message).slice(4, 7)).toEqual(["> First line", "> Second line", "> Third line"]);
  });

  it("leaves out the details and configuration when the request has neither", () => {
    const message = setup({ hardwareRequest: { details: null, configuration: null } });

    expect(lines(message)).toEqual([
      ":inbox_tray: *GPU request: 8× B200*",
      expect.any(String),
      expect.any(String),
      "jane@example.com",
      `${AMPLITUDE_LINK} · ${ADMIN_LINK}`
    ]);
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

    expect(lines(message).slice(0, 6)).toEqual([
      ":inbox_tray: *Region request: &lt;!channel&gt; &amp; co*",
      expect.any(String),
      expect.any(String),
      "jane@example.com",
      "> &lt;https://phish.example|click&gt;",
      "Sent while configuring: a&lt;b&gt;c"
    ]);
  });

  it("escapes the account and contact emails", () => {
    const message = setup({ hardwareRequest: { contactEmail: "o<p>s@example.com" }, requesterEmail: "a&b@example.com" });

    expect(lines(message)[3]).toBe("a&amp;b@example.com · reply to o&lt;p&gt;s@example.com");
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

    expect(lines(message).at(-1)).toBe("Sent while configuring: 1 vCPU");
  });

  describe("routing", () => {
    it("mentions the owner of a sales-lane request by Slack user and shows its value", () => {
      const message = setup({
        hardwareRequest: { lane: "sales", laneReason: "monthly_value", estimatedMonthlyUsd: 35_040 },
        context: { owner: { name: "Remington", slackUserId: "U0123" } }
      });

      expect(lines(message)[1]).toBe("*Sales lane (monthly value) · est. $35,040/month* · <@U0123>");
    });

    it("names an owner without a Slack user", () => {
      const message = setup({
        hardwareRequest: { lane: "sales", laneReason: "could_grow", estimatedMonthlyUsd: null },
        context: { owner: { name: "<Sales>" } }
      });

      expect(lines(message)[1]).toBe("*Sales lane (could grow) · value unknown* · &lt;Sales&gt;");
    });

    it("mentions nobody on an automated-lane request even when it carries an owner", () => {
      const message = setup({
        hardwareRequest: { lane: "automated", laneReason: "no_payment_method", estimatedMonthlyUsd: 949 },
        context: { owner: { name: "Remington", slackUserId: "U0123" } }
      });

      expect(lines(message)[1]).toBe("*Automated lane (no card on file) · est. $949/month*");
    });

    it("shows the organization, its account type and where the request came from", () => {
      const message = setup({ hardwareRequest: { source: "reserve_capacity" }, context: { organizationName: "<Acme>", accountType: "paying" } });

      expect(lines(message)[2]).toBe("&lt;Acme&gt; · Paying · via Reserve capacity");
    });
  });

  function lines(message: { text: string }) {
    return message.text.split("\n");
  }

  function setup(
    input: {
      hardwareRequest?: Partial<ReturnType<typeof createHardwareRequest>>;
      requesterEmail?: string | null;
      context?: Partial<HardwareRequestAlertContext>;
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
        lane: "automated",
        laneReason: "below_thresholds",
        estimatedMonthlyUsd: 11_680,
        ...input.hardwareRequest
      }),
      context: { organizationName: "Acme", accountType: "trial", owner: undefined, ...input.context },
      requesterEmail: "requesterEmail" in input ? input.requesterEmail : "jane@example.com",
      amplitudeProjectUrl: "amplitudeProjectUrl" in input ? input.amplitudeProjectUrl : AMPLITUDE_PROJECT_URL,
      adminUrl: "adminUrl" in input ? input.adminUrl : ADMIN_URL
    });
  }
});
