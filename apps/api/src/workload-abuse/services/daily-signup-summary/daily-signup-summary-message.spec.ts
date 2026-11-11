import { describe, expect, it } from "vitest";

import type { CreatedAccount } from "@src/user/repositories";
import { buildDailySignupSummaryMessage, type DailySignupSummary } from "./daily-signup-summary-message";

const ADMIN_URL = "https://console-admin.example.com";
const HEADER = ":bar_chart: *Daily sign-up and trial summary* 2026-11-09 13:00 UTC to 2026-11-10 13:00 UTC";

describe(buildDailySignupSummaryMessage.name, () => {
  it("posts only the headline numbers on a quiet day", () => {
    const message = buildDailySignupSummaryMessage(summaryOf({ trialsStarted: 0 }), ADMIN_URL);

    expect(message.text).toBe([HEADER, "New accounts: 0", "Trials started: 0"].join("\n"));
  });

  it("splits new accounts by sign-in method, most used first", () => {
    const message = buildDailySignupSummaryMessage(
      summaryOf({
        accounts: [
          account({ userId: "github|1" }),
          account({ userId: "google-oauth2|2" }),
          account({ userId: "google-oauth2|3" }),
          account({ userId: "auth0|4" }),
          account({ userId: "auth0|5" }),
          account({ userId: "windowslive|6" }),
          account({ userId: null })
        ],
        trialsStarted: 4
      })
    );

    expect(lines(message).slice(1, 3)).toEqual(["New accounts: 7 (Email 2 · Google 2 · GitHub 1 · Unknown 1 · windowslive 1)", "Trials started: 4"]);
  });

  it("lists accounts that share a device fingerprint three or more times, largest group first", () => {
    const message = buildDailySignupSummaryMessage(
      summaryOf({
        accounts: [
          account({ id: "a1", email: "a1@gmail.com", lastFingerprint: "fp-a" }),
          account({ id: "b1", email: "b1@gmail.com", lastFingerprint: "fp-b" }),
          account({ id: "a2", email: "a2@gmail.com", lastFingerprint: "fp-a" }),
          account({ id: "b2", email: "b2@gmail.com", lastFingerprint: "fp-b" }),
          account({ id: "a3", email: null, lastFingerprint: "fp-a" }),
          account({ id: "b3", email: "b3@gmail.com", lastFingerprint: "fp-b" }),
          account({ id: "b4", email: "b4@gmail.com", lastFingerprint: "fp-b" }),
          account({ id: "c1", email: "c1@gmail.com", lastFingerprint: "fp-c" }),
          account({ id: "c2", email: "c2@gmail.com", lastFingerprint: "fp-c" }),
          account({ id: "d1", email: "d1@gmail.com", lastFingerprint: null })
        ]
      }),
      ADMIN_URL
    );

    expect(lines(message).slice(3)).toEqual([
      "*Shared device fingerprints (2)*",
      "• 4 accounts on one device",
      `    ◦ b1@gmail.com · <${ADMIN_URL}/users/b1|Admin>`,
      `    ◦ b2@gmail.com · <${ADMIN_URL}/users/b2|Admin>`,
      `    ◦ b3@gmail.com · <${ADMIN_URL}/users/b3|Admin>`,
      `    ◦ b4@gmail.com · <${ADMIN_URL}/users/b4|Admin>`,
      "• 3 accounts on one device",
      `    ◦ a1@gmail.com · <${ADMIN_URL}/users/a1|Admin>`,
      `    ◦ a2@gmail.com · <${ADMIN_URL}/users/a2|Admin>`,
      `    ◦ a3 · <${ADMIN_URL}/users/a3|Admin>`
    ]);
  });

  it("caps the fingerprint groups and the accounts listed in each", () => {
    const largeGroup = Array.from({ length: 12 }, (_, index) => account({ id: `big-${index}`, email: `big${index}@gmail.com`, lastFingerprint: "fp-big" }));
    const smallGroups = Array.from({ length: 10 }, (_, group) =>
      Array.from({ length: 3 }, (_, index) => account({ id: `g${group}-${index}`, email: `g${group}-${index}@gmail.com`, lastFingerprint: `fp-${group}` }))
    ).flat();

    const message = buildDailySignupSummaryMessage(summaryOf({ accounts: [...largeGroup, ...smallGroups] }));

    expect(lines(message)).toContain("*Shared device fingerprints (11)*");
    expect(lines(message).filter(line => line.startsWith("• "))).toHaveLength(10);
    expect(lines(message)).toContain("    ◦ big9@gmail.com");
    expect(lines(message)).not.toContain("    ◦ big10@gmail.com");
    expect(lines(message)).toContain("…and 2 more");
    expect(lines(message)).toContain("…and 1 more groups");
  });

  it("ranks the ten busiest email domains, leaving out public email providers", () => {
    const domainAccounts = Array.from({ length: 11 }, (_, rank) =>
      Array.from({ length: 12 - rank }, () => account({ email: `user@team${String(rank).padStart(2, "0")}.io` }))
    ).flat();

    const message = buildDailySignupSummaryMessage(
      summaryOf({ accounts: [...domainAccounts, ...Array.from({ length: 20 }, () => account({ email: "someone@gmail.com" })), account({ email: "broken" })] }),
      ADMIN_URL
    );

    const domainLines = lines(message).slice(lines(message).indexOf("*Top email domains*") + 1);
    expect(domainLines).toHaveLength(10);
    expect(domainLines[0]).toBe(`• <${ADMIN_URL}/users?q=%40team00.io|team00.io> 12`);
    expect(domainLines[9]).toBe(`• <${ADMIN_URL}/users?q=%40team09.io|team09.io> 3`);
  });

  it("orders domains with the same count by name", () => {
    const message = buildDailySignupSummaryMessage(summaryOf({ accounts: [account({ email: "x@zeta.io" }), account({ email: "y@alpha.io" })] }));

    expect(lines(message).slice(3)).toEqual(["*Top email domains*", "• alpha.io 1", "• zeta.io 1"]);
  });

  it("escapes Slack control characters in what users typed", () => {
    const sharedDevice = Array.from({ length: 3 }, () => account({ userId: "<x>|1", email: "<odd>&@gmail.com", lastFingerprint: "fp" }));

    const message = buildDailySignupSummaryMessage(summaryOf({ accounts: sharedDevice }));

    expect(lines(message)).toContain("New accounts: 3 (&lt;x&gt; 3)");
    expect(lines(message)).toContain("    ◦ &lt;odd&gt;&amp;@gmail.com");
  });

  function summaryOf(overrides: Partial<DailySignupSummary>): DailySignupSummary {
    return {
      windowStartsAt: new Date("2026-11-09T13:00:00.000Z"),
      windowEndsAt: new Date("2026-11-10T13:00:00.000Z"),
      accounts: [],
      trialsStarted: 0,
      ...overrides
    };
  }

  function account(overrides: Partial<CreatedAccount>): CreatedAccount {
    return { id: crypto.randomUUID(), email: "someone@gmail.com", userId: "auth0|1", lastFingerprint: null, ...overrides };
  }

  function lines(message: { text: string }): string[] {
    return message.text.split("\n");
  }
});
