import { describe, expect, it } from "vitest";

import type { OrganizationActivity } from "@src/types/organization-activity";
import { describeActivity } from "./activityText";

describe(describeActivity.name, () => {
  it.each<[OrganizationActivity["type"], OrganizationActivity["payload"], string]>([
    ["organization_created", {}, "created the organization"],
    ["project_created", { projectName: "storefront" }, "created the project *storefront*"],
    ["member_invited", { email: "lena@acme.com", role: "member" }, "invited *lena@acme.com* as a Member"],
    ["member_invited", { email: "ops@acme.com", role: "admin" }, "invited *ops@acme.com* as an Admin"],
    ["member_joined", {}, "joined the organization"],
    ["deployment_created", { dseq: "1", name: "web" }, "deployed [web]"],
    ["deployment_closed", { dseq: "1", name: "web" }, "closed [web]"],
    ["deployment_moved", { dseq: "1", name: "web", toProjectName: "staging" }, "moved [web] to *staging*"],
    ["deployment_moved", { dseq: "1", name: "web" }, "moved [web] to *another project*"],
    ["member_granted", { userId: "u2", username: "lena", role: "viewer" }, "gave *lena* access as a Viewer"],
    ["member_granted", { userId: "u2", username: null, role: "admin" }, "gave *a member* access as an Admin"],
    ["member_revoked", { userId: "u2", username: "lena" }, "removed access for *lena*"],
    ["member_revoked", { userId: "u2", username: null }, "removed access for *a member*"]
  ])("reads a %s event by a member as %s", (type, payload, expected) => {
    expect(sentence(read({ type, payload }))).toBe(expected);
  });

  it.each<[OrganizationActivity["payload"], string, string]>([
    [{ dseq: "1", name: "cache", reason: "runtime_limit_reached" }, "[cache] was closed when its runtime limit ran out", "clock"],
    [{ dseq: "1", name: "cache", reason: "trial_ended" }, "[cache] was closed when the trial ended", "wallet"],
    [{ dseq: "1", name: "cache", reason: "provider_unreachable" }, "[cache] was closed when its provider stopped responding", "activity"],
    [{ dseq: "1", name: "cache", reason: "something_new" }, "[cache] was closed", "activity"],
    [{ dseq: "1", name: "cache", reason: null }, "[cache] was closed", "activity"]
  ])("reads a system close %o as %s with a %s icon", (payload, expected, icon) => {
    const described = read({ type: "deployment_closed", payload, actor: null });

    expect(sentence(described)).toBe(expected);
    expect(described.systemIcon).toBe(icon);
  });

  it("falls back to the dseq for an unnamed deployment", () => {
    expect(sentence(read({ type: "deployment_created", payload: { dseq: "3140", name: null } }))).toBe("deployed [#3140]");
  });

  it("reads an activity type it does not know yet neutrally", () => {
    const described = read({ type: "project_archived" as OrganizationActivity["type"] });

    expect(sentence(described)).toBe("made a change");
    expect(described.systemIcon).toBe("activity");
  });

  it("ignores payload values that are not text", () => {
    expect(sentence(read({ type: "project_created", payload: { projectName: 42 } }))).toBe("created the project *a project*");
  });

  it("names who joined when the record carries no actor", () => {
    expect(sentence(read({ type: "member_joined", payload: { email: "lena@acme.com" }, actor: null }))).toBe("*lena@acme.com* joined the organization");
  });

  function read(overrides: Partial<OrganizationActivity>) {
    return describeActivity({
      id: "a1",
      projectId: null,
      actor: { id: "u1", username: "marcus" },
      type: "organization_created",
      payload: {},
      createdAt: "",
      ...overrides
    });
  }

  function sentence(described: ReturnType<typeof describeActivity>): string {
    return described.segments
      .map(segment => (segment.kind === "strong" ? `*${segment.text}*` : segment.kind === "deployment" ? `[${segment.text}]` : segment.text))
      .join(" ");
  }
});
