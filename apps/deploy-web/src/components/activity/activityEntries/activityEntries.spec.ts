import { describe, expect, it } from "vitest";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { activityEntriesOf } from "./activityEntries";

import { buildActivity } from "@tests/seeders/activity";

describe(activityEntriesOf.name, () => {
  it("describes a close still running as closing its deployment, linking to it", () => {
    const activity = buildActivity({ status: "pending", meta: { dseq: "1234" } });

    expect(entriesOf([activity])).toEqual([
      { id: activity.id, status: "pending", title: "Closing “web-1234”", href: "/deployments/1234", createdAt: activity.createdAt }
    ]);
  });

  it("describes a finished close as closed", () => {
    const [entry] = entriesOf([buildActivity({ status: "succeeded", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status: "succeeded", title: "Closed “web-1234”", href: "/deployments/1234" });
  });

  it("describes a failed close with its reason, linking to the settings where the deployment can be closed again", () => {
    const [entry] = entriesOf([
      buildActivity({ status: "failed", meta: { dseq: "1234", error: { code: "close_incomplete", message: "The deployment is still open." } } })
    ]);

    expect(entry).toMatchObject({
      status: "failed",
      title: "Couldn't close “web-1234”",
      detail: "The deployment is still open.",
      href: "/deployments/1234?tab=SETTINGS"
    });
  });

  it("asks for another try when a failed close gives no reason", () => {
    const [entry] = entriesOf([buildActivity({ status: "failed", meta: { dseq: "1234" } })]);

    expect(entry.detail).toBe("Try closing it again.");
  });

  it("links an activity about no particular deployment to the deployments list", () => {
    const [entry] = entriesOf([buildActivity({ status: "succeeded", meta: {} })]);

    expect(entry.href).toBe("/deployments");
  });

  it("groups a bulk close into one entry, closing while any of it still runs", () => {
    const newest = buildActivity({ status: "pending", meta: { dseq: "1", batchId: "batch-1" } });
    const batch = [newest, buildActivity({ status: "succeeded", meta: { dseq: "2", batchId: "batch-1" } })];

    expect(entriesOf(batch)).toEqual([
      { id: "batch:batch-1", status: "pending", title: "Closing 2 deployments", href: "/deployments", createdAt: newest.createdAt }
    ]);
  });

  it("reports a bulk close as closed once every deployment in it closed", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded"), batchMember("2", "succeeded"), batchMember("3", "succeeded")]);

    expect(entry).toMatchObject({ status: "succeeded", title: "Closed 3 deployments" });
    expect(entry).not.toHaveProperty("detail");
  });

  it("reports a bulk close that closed none as failed, naming the deployments to close again", () => {
    const [entry] = entriesOf([batchMember("1", "failed"), batchMember("2", "failed")]);

    expect(entry).toMatchObject({ status: "failed", title: "Couldn't close 2 deployments", detail: "Try closing “web-1” and “web-2” again." });
  });

  it("reports a bulk close that closed some as partly done, naming the ones still open", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded"), batchMember("2", "failed"), batchMember("3", "succeeded")]);

    expect(entry).toMatchObject({ status: "partial", title: "Closed 2 of 3 deployments", detail: "Couldn't close “web-2”." });
  });

  it("keeps a bulk close of a single deployment as that deployment's entry", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded")]);

    expect(entry).toMatchObject({ title: "Closed “web-1”", href: "/deployments/1" });
  });

  it("keeps the newest first and stops at the limit, counting a bulk close once", () => {
    const first = buildActivity({ meta: { dseq: "10" } });
    const third = buildActivity({ meta: { dseq: "30" } });
    const activities = [first, batchMember("1", "succeeded"), batchMember("2", "succeeded"), third, buildActivity({ meta: { dseq: "40" } })];

    const entries = entriesOf(activities, 3);

    expect(entries.map(entry => entry.id)).toEqual([first.id, "batch:batch-1", third.id]);
    expect(entries[1].title).toBe("Closed 2 deployments");
  });

  function batchMember(dseq: string, status: Activity["status"]) {
    return buildActivity({ status, meta: { dseq, batchId: "batch-1" } });
  }

  function entriesOf(activities: Activity[], limit = 10) {
    return activityEntriesOf(activities, dseq => `“web-${dseq}”`, limit);
  }
});
