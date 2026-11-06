import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { loginExistingUser } from "../actions/auth";
import { injectUIConfig, routeTestingClientToken, test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { WHATS_NEW_RELEASE_IDS } from "../fixture/whats-new-releases";
import { AssistantPanelPage } from "../pages/AssistantPanelPage";
import { closeDeployment, createFixtureDeployment, type FixtureDeployment, isUsableFixture, listActiveDseqs } from "./assistant-lab-fixtures";
import { scoreScenario, type TurnRecord, turnRecordOf } from "./assistant-lab-scoring";
import type { AssistantScenario, LabFixture, StartPage } from "./assistant-scenario.types";
import { ASSISTANT_SCENARIOS } from "./assistant-scenarios";
import { recordAssistantStreams, waitForTurnEnd } from "./assistant-turn-recorder";

const OUT_DIR = process.env.ASSISTANT_LAB_OUT ?? path.join("test-results", "assistant-lab");
const ONLY_IDS = process.env.ASSISTANT_LAB_ONLY?.split(",").filter(Boolean);
const ONLY_CATEGORIES = process.env.ASSISTANT_LAB_CATEGORIES?.split(",").filter(Boolean);
const TURN_TIMEOUT_MS = 150_000;
const PAUSE_BETWEEN_SCENARIOS_MS = Number(process.env.ASSISTANT_LAB_PAUSE_MS ?? 4_000);
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const INCLUDES_API_EVAL_MIRRORS = process.env.ASSISTANT_LAB_INCLUDE_MIRRORED === "1";

const selected = ASSISTANT_SCENARIOS.filter(
  scenario =>
    (!ONLY_IDS || ONLY_IDS.includes(scenario.id)) &&
    (!ONLY_CATEGORIES || ONLY_CATEGORIES.includes(scenario.category)) &&
    (INCLUDES_API_EVAL_MIRRORS || !!ONLY_IDS || !scenario.mirroredInApiEval)
).sort((left, right) => (ONLY_CATEGORIES ? ONLY_CATEGORIES.indexOf(left.category) - ONLY_CATEGORIES.indexOf(right.category) : 0));
const neededFixtures = [...new Set(selected.flatMap(fixturesOf))];

function fixturesOf(scenario: AssistantScenario): LabFixture[] {
  const starts = [scenario.start, ...scenario.steps.flatMap(step => ("navigateTo" in step ? [step.navigateTo] : []))];
  return starts.flatMap(start => (typeof start === "object" ? [start.fixture] : []));
}

let page: Page;
let hasReachedDailyLimit = false;
const createdByScenarios = new Set<string>();
const fixtures = new Map<LabFixture, FixtureDeployment>();

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  mkdirSync(OUT_DIR, { recursive: true });

  const context = await browser.newContext({ viewport: DESKTOP });
  await context.addInitScript(
    ({ appOrigin, releaseIds }) => {
      if (location.origin === appOrigin) localStorage.setItem("console.whatsNew.seen", JSON.stringify(releaseIds));
    },
    { appOrigin: new URL(testEnvConfig.BASE_URL).origin, releaseIds: WHATS_NEW_RELEASE_IDS }
  );
  await recordAssistantStreams(context);
  page = await context.newPage();
  await injectUIConfig(page);
  await routeTestingClientToken(page);
  await loginExistingUser(page);

  for (const fixture of neededFixtures) {
    const deployment = await createFixtureDeployment(page, testEnvConfig.BASE_URL, fixture);
    fixtures.set(fixture, deployment);
  }
  writeFileSync(path.join(OUT_DIR, "_fixtures.json"), JSON.stringify([...fixtures.values()], null, 2));
});

test.afterAll(async () => {
  test.setTimeout(10 * 60 * 1000);
  const fixtureDseqs = [...fixtures.values()].flatMap(({ dseq }) => (dseq ? [dseq] : []));
  const closed = await closeAll([...fixtureDseqs, ...createdByScenarios]);
  writeFileSync(path.join(OUT_DIR, "_closed.json"), JSON.stringify(closed, null, 2));
  await page.context().close();
});

async function closeAll(dseqs: Iterable<string>): Promise<string[]> {
  const closed: string[] = [];
  for (const dseq of new Set(dseqs)) {
    await closeDeployment(page, testEnvConfig.BASE_URL, dseq)
      .then(() => closed.push(dseq))
      .catch(() => undefined);
  }

  return closed;
}

async function closeWhatTheScenarioCreated(activeBefore: string[]): Promise<string[]> {
  const fixtureDseqs = new Set([...fixtures.values()].map(({ dseq }) => dseq));
  const created = (await listActiveDseqs(page, testEnvConfig.BASE_URL)).filter(dseq => !activeBefore.includes(dseq) && !fixtureDseqs.has(dseq));
  created.forEach(dseq => createdByScenarios.add(dseq));

  return closeAll(created);
}

async function ensureFixtureIsUsable(fixture: LabFixture, notes: string[]): Promise<void> {
  const current = fixtures.get(fixture);
  const usable = current?.dseq && (fixture === "closed" || (await isUsableFixture(page, testEnvConfig.BASE_URL, fixture, current.dseq).catch(() => false)));
  if (usable) return;

  const replacement = await createFixtureDeployment(page, testEnvConfig.BASE_URL, fixture);
  fixtures.set(fixture, replacement);
  if (replacement.dseq) createdByScenarios.add(replacement.dseq);
  notes.push(`recreated fixture ${fixture} as ${replacement.dseq ?? "nothing"}${replacement.error ? ` (${replacement.error})` : ""}`);
}

function urlOf(start: StartPage): string | null {
  if (typeof start === "object") {
    const dseq = fixtures.get(start.fixture)?.dseq;
    return dseq ? `/deployments/${dseq}` : null;
  }

  const paths: Record<string, string> = {
    home: "/",
    deployments: "/deployments",
    billing: "/billing",
    templates: "/templates",
    new_deployment: "/new-deployment"
  };
  return paths[start];
}

for (const scenario of selected) {
  test(scenario.id, async () => {
    test.setTimeout(8 * 60 * 1000);
    const panel = new AssistantPanelPage(page);
    const turns: TurnRecord[] = [];
    const notes: string[] = [];
    const startedAt = Date.now();

    if (hasReachedDailyLimit) {
      writeResult(scenario, { skipped: "the test user reached the assistant's daily message limit" });
      return;
    }

    await page.setViewportSize(scenario.viewport === "mobile" ? MOBILE : DESKTOP);
    for (const fixture of fixturesOf(scenario)) await ensureFixtureIsUsable(fixture, notes);
    const startUrl = urlOf(scenario.start);
    if (!startUrl) {
      writeResult(scenario, { skipped: `fixture ${JSON.stringify(scenario.start)} is unavailable` });
      return;
    }

    const activeBefore = scenario.mayCreateDeployments ? await listActiveDseqs(page, testEnvConfig.BASE_URL) : [];
    await page.goto(`${testEnvConfig.BASE_URL}${startUrl}`);
    await page.waitForLoadState("domcontentloaded");
    const opensWithKeyboard = "press" in (scenario.steps[0] ?? {});
    if (!opensWithKeyboard) await panel.open();

    for (const [index, step] of scenario.steps.entries()) {
      if ("say" in step) {
        await panel.agreeToConsentIfAsked();
        const sentAt = Date.now();
        await panel.send(step.say);
        const { requests, timedOut } = await waitForTurnEnd(page, sentAt, TURN_TIMEOUT_MS);
        await page.waitForTimeout(600);
        turns.push(turnRecordOf(step.say, sentAt, requests, timedOut));
        await panel.screenshot(path.join(OUT_DIR, `${scenario.id}-turn${index + 1}.png`));
        if (await panel.showsDailyLimit()) {
          hasReachedDailyLimit = true;
          notes.push("daily message limit reached");
          break;
        }
      } else if ("followCard" in step) {
        const outcome = await panel.followLastCard(step.followCard);
        notes.push(`followCard ${step.followCard}: ${outcome}; url ${page.url()}`);
        if (step.expectUrl && !step.expectUrl.test(page.url())) notes.push(`expected url ${step.expectUrl} after the card`);
        await panel.screenshot(path.join(OUT_DIR, `${scenario.id}-card${index + 1}.png`));
      } else if ("navigateTo" in step) {
        const url = urlOf(step.navigateTo);
        if (url) await panel.navigateInApp(url);
        notes.push(`navigated to ${url}; panel open: ${await panel.isOpen()}`);
      } else {
        await panel.press(step.press);
        notes.push(`pressed ${step.press}; panel open: ${await panel.isOpen()}`);
      }
    }

    await page.screenshot({ path: path.join(OUT_DIR, `${scenario.id}-page.png`) });
    if (scenario.mayCreateDeployments) {
      const closed = await closeWhatTheScenarioCreated(activeBefore);
      if (closed.length) notes.push(`closed ${closed.join(", ")} created during the scenario`);
    }
    const isOpen = await panel.isOpen();
    const score = scoreScenario(scenario.expect, turns, { isOpen });
    writeResult(scenario, {
      startUrl,
      viewport: scenario.viewport ?? "desktop",
      turns,
      notes,
      transcript: isOpen ? await panel.transcriptText() : null,
      cards: isOpen ? await panel.cardTitles() : [],
      chips: isOpen ? await panel.chipLabels() : [],
      score,
      wallMs: Date.now() - startedAt
    });

    await page.waitForTimeout(PAUSE_BETWEEN_SCENARIOS_MS);
  });
}

function writeResult(scenario: AssistantScenario, result: Record<string, unknown>) {
  writeFileSync(
    path.join(OUT_DIR, `${scenario.id}.json`),
    JSON.stringify({ id: scenario.id, category: scenario.category, title: scenario.title, steps: scenario.steps, expect: scenario.expect, ...result }, null, 2)
  );
}
