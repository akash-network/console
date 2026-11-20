import { describe, expect, it } from "vitest";

import { decayOf, scoreLookbackDays, scoreTemplate, scoreTemplates, type ScoringSettings, type StillRunningUserDays } from "./template-scores";

const SETTINGS: ScoringSettings = { trialWeight: 0.25, popularHalfLifeDays: 30, popularWindowDays: 180, trendingWindowDays: 7, trendingMinVolume: 5 };

function paidUsers(ageDays: number, paid: number): StillRunningUserDays {
  return { ageDays, paid, trial: 0 };
}

function trialUsers(ageDays: number, trial: number): StillRunningUserDays {
  return { ageDays, paid: 0, trial };
}

describe(decayOf.name, () => {
  it.each([
    { ageDays: 0, halfLifeDays: 30, decay: 1 },
    { ageDays: 30, halfLifeDays: 30, decay: 0.5 },
    { ageDays: 60, halfLifeDays: 30, decay: 0.25 },
    { ageDays: 7, halfLifeDays: 14, decay: Math.SQRT1_2 },
    { ageDays: 14, halfLifeDays: 7, decay: 0.25 }
  ])("weighs a day $ageDays days old at $decay with a half-life of $halfLifeDays days", ({ ageDays, halfLifeDays, decay }) => {
    expect(decayOf(ageDays, halfLifeDays)).toBeCloseTo(decay, 12);
  });
});

describe(scoreLookbackDays.name, () => {
  it("reads as far back as the popular window when it covers both trending windows", () => {
    expect(scoreLookbackDays({ popularWindowDays: 180, trendingWindowDays: 7 })).toBe(180);
  });

  it("reads both trending windows when the popular window is shorter than the two", () => {
    expect(scoreLookbackDays({ popularWindowDays: 10, trendingWindowDays: 7 })).toBe(14);
  });
});

describe(scoreTemplate.name, () => {
  describe("popular score", () => {
    it("counts today's users in full and halves them for every half-life of age", () => {
      const { popularScore, breakdown } = scoreTemplate([paidUsers(0, 2), paidUsers(30, 4), paidUsers(60, 8)], 0, SETTINGS);

      expect(popularScore).toBe(6);
      expect(breakdown.popular).toEqual({ windowDays: 180, halfLifeDays: 30, trialWeight: 0.25, paid: 14, trial: 0, decayedPaid: 6, decayedTrial: 0 });
    });

    it("counts a trial user at the trial weight", () => {
      const { popularScore, breakdown } = scoreTemplate([{ ageDays: 0, paid: 1, trial: 8 }, trialUsers(30, 8)], 0, SETTINGS);

      expect(popularScore).toBe(4);
      expect(breakdown.popular).toMatchObject({ paid: 1, trial: 16, decayedPaid: 1, decayedTrial: 12 });
    });

    it("ignores trial users entirely at a trial weight of zero", () => {
      expect(scoreTemplate([{ ageDays: 0, paid: 3, trial: 50 }], 0, { ...SETTINGS, trialWeight: 0 }).popularScore).toBe(3);
    });

    it("counts the last day of the popular window and nothing older", () => {
      const settings = { ...SETTINGS, popularWindowDays: 60 };

      const { popularScore, breakdown } = scoreTemplate([paidUsers(59, 100), paidUsers(60, 100), paidUsers(90, 100)], 0, settings);

      expect(popularScore).toBe(25.5843);
      expect(breakdown.popular).toMatchObject({ windowDays: 60, paid: 100, decayedPaid: 25.5843 });
    });

    it("rounds to four decimals", () => {
      expect(scoreTemplate([paidUsers(10, 1)], 0, SETTINGS).popularScore).toBe(0.7937);
    });

    it("scores a template nobody kept running at zero", () => {
      expect(scoreTemplate([], 3, SETTINGS)).toEqual({
        popularScore: 0,
        trendingScore: 0,
        isTrending: false,
        weeklyDeployers: 3,
        breakdown: {
          version: 1,
          popular: { windowDays: 180, halfLifeDays: 30, trialWeight: 0.25, paid: 0, trial: 0, decayedPaid: 0, decayedTrial: 0 },
          trending: {
            windowDays: 7,
            minVolume: 5,
            trialWeight: 0.25,
            current: { paid: 0, trial: 0, weighted: 0 },
            previous: { paid: 0, trial: 0, weighted: 0 },
            meetsMinVolume: false
          },
          weeklyDeployers: 3
        }
      });
    });
  });

  describe("trending score", () => {
    it("is the growth of the last window over the one before it", () => {
      const { trendingScore, isTrending, breakdown } = scoreTemplate([paidUsers(0, 6), paidUsers(6, 4), paidUsers(7, 3), paidUsers(13, 2)], 0, SETTINGS);

      expect(trendingScore).toBe(1);
      expect(isTrending).toBe(true);
      expect(breakdown.trending).toEqual({
        windowDays: 7,
        minVolume: 5,
        trialWeight: 0.25,
        current: { paid: 10, trial: 0, weighted: 10 },
        previous: { paid: 5, trial: 0, weighted: 5 },
        meetsMinVolume: true
      });
    });

    it("leaves out what is older than both windows", () => {
      const { trendingScore, breakdown } = scoreTemplate([paidUsers(3, 10), paidUsers(14, 100)], 0, SETTINGS);

      expect(trendingScore).toBe(2);
      expect(breakdown.trending.previous).toEqual({ paid: 0, trial: 0, weighted: 0 });
    });

    it("follows the configured window", () => {
      const { trendingScore, breakdown } = scoreTemplate([paidUsers(2, 12), paidUsers(3, 6), paidUsers(5, 6), paidUsers(6, 100)], 0, {
        ...SETTINGS,
        trendingWindowDays: 3
      });

      expect(breakdown.trending).toMatchObject({ windowDays: 3, current: { weighted: 12 }, previous: { weighted: 12 } });
      expect(trendingScore).toBe(0);
    });

    it("is zero and not trending when both windows tie", () => {
      const { trendingScore, isTrending, breakdown } = scoreTemplate([paidUsers(1, 6), paidUsers(8, 6)], 0, SETTINGS);

      expect(trendingScore).toBe(0);
      expect(isTrending).toBe(false);
      expect(breakdown.trending.meetsMinVolume).toBe(true);
    });

    it("is negative and not trending when usage fell, however large it still is", () => {
      const { trendingScore, isTrending } = scoreTemplate([paidUsers(1, 5), paidUsers(8, 10)], 0, SETTINGS);

      expect(trendingScore).toBe(-0.5);
      expect(isTrending).toBe(false);
    });

    it("stays negative when the last window fell under the minimum volume from above it", () => {
      const { trendingScore, isTrending, breakdown } = scoreTemplate([paidUsers(1, 2), paidUsers(8, 8)], 0, SETTINGS);

      expect(trendingScore).toBe(-0.75);
      expect(isTrending).toBe(false);
      expect(breakdown.trending.meetsMinVolume).toBe(true);
    });

    it("measures a template with no previous window against the minimum volume", () => {
      const { trendingScore, isTrending } = scoreTemplate([paidUsers(0, 10)], 0, SETTINGS);

      expect(trendingScore).toBe(2);
      expect(isTrending).toBe(true);
    });

    it("measures growth from under the minimum volume against the minimum volume", () => {
      const { trendingScore, isTrending } = scoreTemplate([paidUsers(0, 6), paidUsers(7, 2)], 0, SETTINGS);

      expect(trendingScore).toBe(0.8);
      expect(isTrending).toBe(true);
    });

    it("trends from exactly the minimum volume", () => {
      const { trendingScore, isTrending, breakdown } = scoreTemplate([paidUsers(0, 5)], 0, SETTINGS);

      expect(trendingScore).toBe(1);
      expect(isTrending).toBe(true);
      expect(breakdown.trending.meetsMinVolume).toBe(true);
    });

    it("reads as flat under the minimum volume, whatever the growth", () => {
      const { trendingScore, isTrending, breakdown } = scoreTemplate([paidUsers(0, 4), paidUsers(7, 1)], 0, SETTINGS);

      expect(trendingScore).toBe(0);
      expect(isTrending).toBe(false);
      expect(breakdown.trending).toMatchObject({ current: { weighted: 4 }, previous: { weighted: 1 }, meetsMinVolume: false });
    });

    it("counts trial users toward the minimum volume at the trial weight", () => {
      const atTheFloor = scoreTemplate([{ ageDays: 0, paid: 4, trial: 4 }], 0, SETTINGS);
      const underTheFloor = scoreTemplate([trialUsers(0, 16)], 0, SETTINGS);

      expect(atTheFloor).toMatchObject({ trendingScore: 1, isTrending: true });
      expect(atTheFloor.breakdown.trending.current).toEqual({ paid: 4, trial: 4, weighted: 5 });
      expect(underTheFloor).toMatchObject({ trendingScore: 0, isTrending: false });
      expect(underTheFloor.breakdown.trending.current).toEqual({ paid: 0, trial: 16, weighted: 4 });
    });

    it("rounds the weighted counts and the growth to four decimals", () => {
      const { trendingScore, breakdown } = scoreTemplate([{ ageDays: 0, paid: 7, trial: 3 }, paidUsers(7, 6)], 0, { ...SETTINGS, trialWeight: 0.1 });

      expect(breakdown.trending.current.weighted).toBe(7.3);
      expect(trendingScore).toBe(0.2167);
    });

    it("does not decay within a window", () => {
      expect(scoreTemplate([paidUsers(6, 10), paidUsers(13, 5)], 0, SETTINGS).trendingScore).toBe(1);
    });
  });
});

describe(scoreTemplates.name, () => {
  it("scores each template from its own user days and weekly deployers", () => {
    const scores = scoreTemplates(
      [
        { source: "console", templateRef: "a", ...paidUsers(0, 10) },
        { source: "console", templateRef: "b", ...paidUsers(30, 2) },
        { source: "console", templateRef: "a", ...paidUsers(7, 5) }
      ],
      [{ source: "console", templateRef: "a", weeklyDeployers: 12 }],
      SETTINGS
    );

    expect(scores).toMatchObject([
      { source: "console", templateRef: "a", popularScore: 14.2533, trendingScore: 1, isTrending: true, weeklyDeployers: 12 },
      { source: "console", templateRef: "b", popularScore: 1, trendingScore: 0, isTrending: false, weeklyDeployers: 0 }
    ]);
    expect(scores[0].breakdown).toMatchObject({ version: 1, popular: { paid: 15 }, weeklyDeployers: 12 });
  });

  it("keeps a Console template apart from an awesome-akash one of the same name", () => {
    const scores = scoreTemplates(
      [
        { source: "console", templateRef: "ollama", ...paidUsers(0, 1) },
        { source: "awesome_akash", templateRef: "ollama", ...paidUsers(0, 3) }
      ],
      [{ source: "awesome_akash", templateRef: "ollama", weeklyDeployers: 4 }],
      SETTINGS
    );

    expect(scores).toMatchObject([
      { source: "console", templateRef: "ollama", popularScore: 1, weeklyDeployers: 0 },
      { source: "awesome_akash", templateRef: "ollama", popularScore: 3, weeklyDeployers: 4 }
    ]);
  });

  it("scores a template deployed this week with nothing still running yet", () => {
    expect(scoreTemplates([], [{ source: "awesome_akash", templateRef: "comfyui", weeklyDeployers: 2 }], SETTINGS)).toMatchObject([
      { source: "awesome_akash", templateRef: "comfyui", popularScore: 0, trendingScore: 0, isTrending: false, weeklyDeployers: 2 }
    ]);
  });

  it("gives templates with the same usage the same scores", () => {
    const [first, second] = scoreTemplates(
      [
        { source: "console", templateRef: "first", ...paidUsers(2, 7) },
        { source: "console", templateRef: "second", ...paidUsers(2, 7) }
      ],
      [],
      SETTINGS
    );

    expect({ popular: first.popularScore, trending: first.trendingScore, isTrending: first.isTrending }).toEqual({
      popular: second.popularScore,
      trending: second.trendingScore,
      isTrending: second.isTrending
    });
    expect(first.popularScore).toBe(6.6839);
  });

  it("scores nothing when nothing was used", () => {
    expect(scoreTemplates([], [], SETTINGS)).toEqual([]);
  });
});
