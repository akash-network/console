import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

import {
  createApiKey,
  createNames,
  createProjects,
  deleteTeamsLeftBehind,
  DIRECT_API_URL,
  listOrganizations,
  openApiKeyClient,
  PROXY_API_URL
} from "../actions/organization";
import { buyMinimumCredits, createTeam, TEST_CARD_LAST4, TEST_CARD_NUMBER } from "../actions/team";
import { expect, test } from "../fixture/base-test";
import { AddCreditsSheetPage } from "../pages/AddCreditsSheetPage";
import { AddPaymentMethodPopupPage } from "../pages/AddPaymentMethodPopupPage";
import { AutoRechargePage } from "../pages/AutoRechargePage";
import { BillingPage } from "../pages/BillingPage";
import { ConfigureDeploymentPage } from "../pages/ConfigureDeploymentPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProjectBudgetPage } from "../pages/ProjectBudgetPage";
import { ProjectPage } from "../pages/ProjectPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { UsagePage } from "../pages/UsagePage";
import { createInboxClient } from "../services/email-verification";
import { waitForEmail } from "../services/inbox-email";

/** The smallest purchase the first-purchase bonus applies to, which then adds 10% of it (FirstPurchaseBonusService). */
const BONUS_QUALIFYING_PURCHASE_USD = 100;

const FIRST_PURCHASE_BONUS_USD = 10;

const STANDARD_TOP_UP_USD = 20;

/** The lowest amount auto recharge may charge (AUTO_RELOAD_AMOUNT_MIN_USD), kept low so each run spends little. */
const AUTO_RECHARGE_AMOUNT_USD = 25;

/** At or above a wallet that holds one standard top-up less a deployment's deposit, so saving the settings is due a charge at once. */
const AUTO_RECHARGE_THRESHOLD_USD = 20;

/** The smallest monthly budget a project accepts, which a couple of default deposits fill. */
const MONTHLY_BUDGET_USD = 1;

const BUDGET_ALERT_THRESHOLD_PERCENT = 50;

/** A team's first purchase reaches its wallet only after the payment confirms. */
const WALLET_FUNDING_DEADLINE_MS = 3 * 60_000;

/** The api answers 402 until a purchase has funded the wallet. */
const WALLET_NOT_READY_STATUSES = [409, 402];

/** Auto recharge charges from a queued job, and the active-deployment guard it applies reads the indexer, which trails the chain. */
const AUTO_RECHARGE_DEADLINE_MS = 4 * 60_000;

const BID_DEADLINE_MS = 2 * 60_000;

const POLL_INTERVALS_MS = [5_000];

/** A wallet reports its credit in micro units of the deployment denom, which is pegged to the dollar. */
const MICRO_UNITS_PER_USD = 1_000_000;

const ADDRESS = { name: "E2E Test User", line1: "123 Test Street", city: "San Francisco", state: "CA", zip: "94105" };

const CARD = { number: TEST_CARD_NUMBER, expiry: "12/30", cvc: "123" };

const SDL = `---
version: "2.0"
services:
  web:
    image: ghcr.io/akash-network/hello-akash-world:2.1.0
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

/** A session reaches the api through the app's proxy, which runs it in the organization its cookie names; a key reaches the api itself. */
type Api = { request: APIRequestContext; prefix: string };

type Me = { data: { id: string; email: string } };

type WalletList = { data: { address: string; creditAmount: number }[] };

type BonusEligibility = { data: { eligible: boolean } };

type PaymentMethodList = { data: { id: string; card?: { last4?: string | null } | null }[] };

type ConfirmedPayment = { data: { success: boolean; requiresAction?: boolean } };

type TransactionList = { data: { transactions: { amount: number; bonusAmount?: number; status: string; cardLast4?: string | null }[] } };

type WalletSettings = { data: { autoReloadEnabled: boolean; autoReloadMode: string; autoReloadThreshold: number; autoReloadAmount: number } };

type CreatedDeployment = { data: { dseq: string; manifest: string } };

type BidList = { data: { bid: { id: { dseq: string; gseq: number; oseq: number; provider: string } } }[] };

type IndexedDeployments = { results?: { dseq: string }[] };

type CreatedProject = { data: { id: string; name: string } };

type ProjectBudgetList = { data: { projectId: string; monthlyAmountUsd: number; currentPeriod: { committedUsd: number } }[] };

type SpendAmounts = { committedUsd: number; consumedUsd: number };

type ProjectSpendReport = {
  data: { projects: (SpendAmounts & { projectId: string; name: string })[]; unassigned: SpendAmounts | null; total: SpendAmounts | null };
};

type DeploymentSpendReport = {
  data: { days: { projectId: string | null; consumedUsd: number }[]; deployments: { dseq: string; projectId: string | null; consumedUsd: number }[] };
};

type BudgetRefusal = { code?: string; message?: string; data?: { projectIds?: string[] } };

test.describe("Team money", () => {
  test.use({ userType: "new" });
  test.setTimeout(15 * 60_000);

  test("an owner's card buys credits for a team, the first-purchase bonus comes once per person, and the personal wallet is left as it was", async ({
    page
  }) => {
    const { team } = createNames();
    const { team: secondTeam } = createNames();
    const billing = new BillingPage(page);
    const addCredits = new AddCreditsSheetPage(page);
    const addPaymentMethod = new AddPaymentMethodPopupPage(page);
    const switcher = new OrganizationSwitcher(page);
    const session = sessionApi(page);

    try {
      const { me, personalWallets } = await test.step("the owner's personal account has paid nothing and is offered the first-purchase bonus", async () => {
        const { data: me } = await getJson<Me>(session, "v1/user/me");
        expect(await isBonusOffered(session)).toBe(true);
        await billing.goto();
        await expect(billing.emptyPaymentHistoryNotice()).toBeVisible({ timeout: 30_000 });

        return { me, personalWallets: await waitForPersonalWallet(session, me.id) };
      });

      await test.step("the owner creates a team and adds a card to it from billing", async () => {
        await createTeam(page, team);
        await billing.goto();
        await addPaymentMethod.open();
        await addPaymentMethod.fillAddress(ADDRESS);
        await addPaymentMethod.fillCard(CARD);
        await addPaymentMethod.submit();
        await expect(addPaymentMethod.savedCard(TEST_CARD_LAST4)).toBeVisible({ timeout: 60_000 });
      });

      await test.step("adding credits offers the first-purchase bonus on a qualifying amount", async () => {
        await billing.openAddToBalance();
        await addCredits.waitForOpen();
        await addCredits.enterCustomAmount(String(BONUS_QUALIFYING_PURCHASE_USD));
        await expect(addCredits.getDialog()).toContainText(`${usd(BONUS_QUALIFYING_PURCHASE_USD + FIRST_PURCHASE_BONUS_USD)} in credits`);
        await expect(addCredits.getDialog().getByText("First-purchase bonus (10%)")).toBeVisible();
        await expect(addCredits.getDialog().getByText(`+${usd(FIRST_PURCHASE_BONUS_USD)}`, { exact: true })).toBeVisible();
      });

      await test.step("paying with the team's saved card credits the team with the bonus", async () => {
        await addCredits.submit();
        await expect(addCredits.getPurchaseConfirmation()).toContainText(`${usd(BONUS_QUALIFYING_PURCHASE_USD)} credits added`, { timeout: 90_000 });
        await expect.soft(addCredits.getPurchaseConfirmation()).toContainText(`Plus ${usd(FIRST_PURCHASE_BONUS_USD)} in bonus credits`);
        await addCredits.dismissPurchaseConfirmation();
        await expect.soft(billing.cardPayment(TEST_CARD_LAST4)).toContainText(`+${usd(FIRST_PURCHASE_BONUS_USD)} bonus`, { timeout: 30_000 });
        await expect
          .poll(() => readCredit(session, me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeCloseTo(BONUS_QUALIFYING_PURCHASE_USD + FIRST_PURCHASE_BONUS_USD, 2);
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toContainText(`+${usd(FIRST_PURCHASE_BONUS_USD)} bonus`, { timeout: 30_000 });
        await expect(billing.getAvailableBalance()).toHaveText(usd(BONUS_QUALIFYING_PURCHASE_USD + FIRST_PURCHASE_BONUS_USD), { timeout: 60_000 });
        expect(await isBonusOffered(session)).toBe(false);
      });

      await test.step("a second team of the same owner is not offered the bonus, and its first purchase earns none", async () => {
        await createTeam(page, secondTeam);
        expect(await isBonusOffered(session)).toBe(false);
        await billing.goto();
        await billing.openAddToBalance();
        await addCredits.waitForOpen();
        await addCredits.enterCustomAmount(String(BONUS_QUALIFYING_PURCHASE_USD));
        await addCredits.fillStripeAddress(ADDRESS);
        await addCredits.fillStripeCard(CARD);
        await expect(addCredits.getDialog()).not.toContainText("First-purchase bonus");
        await addCredits.submit();
        await expect(addCredits.getPurchaseConfirmation()).toContainText(`${usd(BONUS_QUALIFYING_PURCHASE_USD)} credits added`, { timeout: 90_000 });
        await expect(addCredits.getPurchaseConfirmation()).not.toContainText("bonus credits");
        await addCredits.dismissPurchaseConfirmation();
        await expect
          .poll(() => readCredit(session, me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeCloseTo(BONUS_QUALIFYING_PURCHASE_USD, 2);
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toBeVisible({ timeout: 30_000 });
        await expect(billing.cardPayment(TEST_CARD_LAST4)).not.toContainText("bonus");
      });

      await test.step("the owner's personal account still has no payment and its wallet is as it was", async () => {
        await switcher.switchToPersonal();
        await expect(switcher.trigger(secondTeam)).toBeHidden({ timeout: 30_000 });
        await billing.goto();
        await expect(billing.emptyPaymentHistoryNotice()).toBeVisible({ timeout: 30_000 });
        expect(await waitForPersonalWallet(session, me.id)).toEqual(personalWallets);
        expect(await isBonusOffered(session)).toBe(false);
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a team key buys credits with the team's saved card, the bonus comes with the first team's purchase only, and the personal wallet is left as it was", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const { team: secondTeam } = createNames();
    const clients: APIRequestContext[] = [];
    const openKey = async (name: string) => {
      const key = await createApiKey(page.request, { name: `e2e-money-${name}-${suffix}` });
      const client = await openApiKeyClient(playwright, key.apiKey);
      clients.push(client);

      return { ...key, api: keyApi(client) };
    };
    let personalKeyId: string | undefined;

    try {
      const personal = await test.step("a key of the owner's personal account sees its wallet and the bonus on offer", async () => {
        const key = await openKey("personal");
        personalKeyId = key.id;
        const { data: me } = await getJson<Me>(key.api, "v1/user/me");
        expect(await isBonusOffered(key.api)).toBe(true);

        return { api: key.api, me, wallets: await waitForPersonalWallet(key.api, me.id) };
      });

      const first = await test.step("the owner creates a team, adds a card in billing, and creates a key in the team", async () => {
        await createTeamWithSavedCard(page, team);
        const key = await openKey("team");
        expect(key.organizationId).toBe(await organizationIdOf(page, team));

        return key;
      });

      await test.step("the team key sees the saved card and the bonus on offer, then buys credits that land in the team's wallet with the bonus", async () => {
        expect(await isBonusOffered(first.api)).toBe(true);
        await buyWithSavedCard(first.api, { userId: personal.me.id, amountUsd: BONUS_QUALIFYING_PURCHASE_USD });
        await expect
          .poll(() => readCredit(first.api, personal.me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeCloseTo(BONUS_QUALIFYING_PURCHASE_USD + FIRST_PURCHASE_BONUS_USD, 2);

        const { data } = await getJson<TransactionList>(first.api, "v1/stripe/transactions");
        expect(data.transactions).toMatchObject([
          { amount: BONUS_QUALIFYING_PURCHASE_USD * 100, bonusAmount: FIRST_PURCHASE_BONUS_USD * 100, status: "succeeded", cardLast4: TEST_CARD_LAST4 }
        ]);
        expect(await isBonusOffered(first.api)).toBe(false);
      });

      await test.step("a second team's key is not offered the bonus, and its purchase lands without one", async () => {
        await createTeamWithSavedCard(page, secondTeam);
        const second = await openKey("second-team");
        expect(await isBonusOffered(second.api)).toBe(false);
        await buyWithSavedCard(second.api, { userId: personal.me.id, amountUsd: BONUS_QUALIFYING_PURCHASE_USD });
        await expect
          .poll(() => readCredit(second.api, personal.me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeCloseTo(BONUS_QUALIFYING_PURCHASE_USD, 2);

        const { data } = await getJson<TransactionList>(second.api, "v1/stripe/transactions");
        expect(data.transactions).toHaveLength(1);
        expect(data.transactions[0]).toMatchObject({ amount: BONUS_QUALIFYING_PURCHASE_USD * 100, status: "succeeded" });
        expect(data.transactions[0].bonusAmount ?? 0).toBe(0);
      });

      await test.step("the personal key still sees the wallet as it was, no longer offered the bonus", async () => {
        expect(await waitForPersonalWallet(personal.api, personal.me.id)).toEqual(personal.wallets);
        expect(await isBonusOffered(personal.api)).toBe(false);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      if (personalKeyId) await page.request.delete(`${PROXY_API_URL}/v1/api-keys/${personalKeyId}`, { failOnStatusCode: false }).catch(() => undefined);
    }
  });

  test("auto recharge turned on in a team's billing charges the team's card as soon as the balance is at its threshold", async ({ page }) => {
    const { team, deployment } = createNames();
    const billing = new BillingPage(page);
    const autoRecharge = new AutoRechargePage(page);
    const session = sessionApi(page);
    let dseq: string | undefined;

    try {
      const { me } = await test.step("the owner creates a team, pays for it with a card, and starts a deployment", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
        const { data: me } = await getJson<Me>(session, "v1/user/me");
        dseq = (await createDeployment(session, { name: deployment })).dseq;
        await waitUntilIndexedAsActive(page.request, await walletAddressOf(session, me.id), dseq);

        return { me };
      });

      await test.step("the owner turns on auto recharge with a threshold the balance is already at", async () => {
        await billing.goto();
        await autoRecharge.turnOnWithFixedThreshold({ thresholdUsd: String(AUTO_RECHARGE_THRESHOLD_USD), amountUsd: String(AUTO_RECHARGE_AMOUNT_USD) });
        await expect(page.getByText("Auto recharge enabled")).toBeVisible();
        await expect(autoRecharge.switch()).toBeChecked();
        await expect(page.getByText(`Adds ${usd(AUTO_RECHARGE_AMOUNT_USD)} when available drops to ${usd(AUTO_RECHARGE_THRESHOLD_USD)}`)).toBeVisible();
      });

      await test.step("the team's card is charged the recharge amount, which the team's balance and payment history show", async () => {
        await expect
          .poll(async () => (await listTransactions(session)).filter(isAutoRechargeOf(AUTO_RECHARGE_AMOUNT_USD)).length, {
            timeout: AUTO_RECHARGE_DEADLINE_MS,
            intervals: POLL_INTERVALS_MS
          })
          .toBe(1);
        await expect
          .poll(() => readCredit(session, me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeGreaterThan(STANDARD_TOP_UP_USD + AUTO_RECHARGE_AMOUNT_USD - 1);
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4).filter({ hasText: usd(AUTO_RECHARGE_AMOUNT_USD) })).toHaveCount(1);
      });

      await test.step("the owner turns auto recharge off", async () => {
        await autoRecharge.turnOff();
        await expect(autoRecharge.switch()).not.toBeChecked();
        await expect(page.getByText("Off · top up manually")).toBeVisible();
      });
    } finally {
      if (dseq) await closeDeploymentQuietly(session, dseq);
      await deleteTeamsLeftBehind(page);
    }
  });

  test("auto recharge saved with a team key charges the team's card, and with it off a drained balance meets the credits-low email's trigger", async ({
    page,
    playwright
  }) => {
    const { team, deployment, suffix } = createNames();
    let client: APIRequestContext | undefined;
    let dseq: string | undefined;

    try {
      const { api, me } = await test.step("the owner creates a team, pays for it with a card, and creates a team key", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
        const key = await createApiKey(page.request, { name: `e2e-money-reload-${suffix}` });
        client = await openApiKeyClient(playwright, key.apiKey);
        const keyApiClient = keyApi(client);

        return { api: keyApiClient, me: (await getJson<Me>(keyApiClient, "v1/user/me")).data };
      });

      await test.step("the key leases a deployment, which the indexer then lists as active", async () => {
        const created = await createDeployment(api, { name: deployment });
        dseq = created.dseq;
        await leaseFirstBid(api, created);
        await waitUntilIndexedAsActive(page.request, await walletAddressOf(api, me.id), dseq);
      });

      await test.step("the key saves auto recharge with a threshold the balance is already at", async () => {
        const settings = {
          autoReloadEnabled: true,
          autoReloadMode: "threshold",
          autoReloadThreshold: AUTO_RECHARGE_THRESHOLD_USD,
          autoReloadAmount: AUTO_RECHARGE_AMOUNT_USD
        };
        await readJson(await api.request.post(`${api.prefix}v1/wallet-settings`, { data: { data: settings } }));
        expect((await getJson<WalletSettings>(api, "v1/wallet-settings")).data).toMatchObject(settings);
      });

      await test.step("the team's card is charged the recharge amount, which lands in the team's wallet", async () => {
        await expect
          .poll(async () => (await listTransactions(api)).filter(isAutoRechargeOf(AUTO_RECHARGE_AMOUNT_USD)).length, {
            timeout: AUTO_RECHARGE_DEADLINE_MS,
            intervals: POLL_INTERVALS_MS
          })
          .toBe(1);
        await expect
          .poll(() => readCredit(api, me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS })
          .toBeGreaterThan(STANDARD_TOP_UP_USD + AUTO_RECHARGE_AMOUNT_USD - 1);
      });

      await test.step("the key turns auto recharge off", async () => {
        await readJson(await api.request.put(`${api.prefix}v1/wallet-settings`, { data: { data: { autoReloadEnabled: false } } }));
        expect((await getJson<WalletSettings>(api, "v1/wallet-settings")).data.autoReloadEnabled).toBe(false);
      });

      await test.step("moving the balance into the deployment's escrow leaves less than a week of its cost, the credits-low email's trigger", async () => {
        const { data: weekly } = await getJson<{ data: { weeklyCost: number } }>(api, "v1/weekly-cost");
        expect(weekly.weeklyCost).toBeGreaterThan(0);
        const balance = (await readCredit(api, me.id)) ?? 0;
        const deposit = Math.floor((balance - weekly.weeklyCost / 2) * 100) / 100;
        await readJson(await api.request.post(`${api.prefix}v1/deposit-deployment`, { data: { data: { dseq, deposit } } }));
        await expect.poll(() => readCredit(api, me.id), { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }).toBeLessThan(weekly.weeklyCost);
      });
    } finally {
      if (dseq) await closeDeploymentQuietly(sessionApi(page), dseq);
      await client?.dispose();
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a project budget set in the UI alerts before a deploy past it is refused, and the spend by project adds up to the team's total", async ({ page }) => {
    const { team, sharedProject: budgeted, hiddenProject: unbudgeted, suffix } = createNames();
    const inbox = createInboxClient();
    const projects = new ProjectsPage(page);
    const budget = new ProjectBudgetPage(page);
    const usage = new UsagePage(page);
    const session = sessionApi(page);
    const dseqs: string[] = [];

    try {
      const { me, projectIds } = await test.step("the owner creates a funded team with two projects", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
        await createProjects(page, [budgeted, unbudgeted]);

        return { me: (await getJson<Me>(session, "v1/user/me")).data, projectIds: await projectIdsByName(session) };
      });

      await test.step("the owner sets a monthly budget on one project", async () => {
        await projects.openProject(budgeted);
        await budget.setBudget({ monthlyAmountUsd: String(MONTHLY_BUDGET_USD), alertThresholdPercent: String(BUDGET_ALERT_THRESHOLD_PERCENT) });
        await expect(budget.panel()).toContainText(`committed of ${usd(MONTHLY_BUDGET_USD)} monthly budget`);
      });

      const deployedAtMs = Date.now();

      await test.step("the owner deploys into each project", async () => {
        dseqs.push(await deployThroughUi(page, { projectName: budgeted, deploymentName: `e2e-budgeted-${suffix}` }));
        dseqs.push(await deployThroughUi(page, { projectName: unbudgeted, deploymentName: `e2e-unbudgeted-${suffix}` }));
      });

      await test.step("the budget alert reaches the owner while the project is still within its budget", async () => {
        await waitForEmail(inbox, {
          email: me.email,
          subject: `Project ${budgeted} has committed ${BUDGET_ALERT_THRESHOLD_PERCENT}% of its monthly budget`,
          receivedAfterMs: deployedAtMs
        });
        await projects.goto();
        await projects.openProject(budgeted);
        await expect(budget.committedShare()).toHaveAccessibleName(/^\d+% of the monthly budget committed$/);
        await expect(budget.panel()).toContainText("Past the alert threshold.");
      });

      const committedAtLimit = await test.step("the owner deploys into the budgeted project until its budget is full", async () => {
        const created = await fillBudget(session, projectIds[budgeted]);
        dseqs.push(...created);

        return await committedIn(session, projectIds[budgeted]);
      });

      await test.step("one more deploy into the budgeted project is refused, saying the budget is why", async () => {
        await startDeploymentThroughUi(page, { projectName: budgeted, deploymentName: `e2e-refused-${suffix}` });
        await expect(page.getByText("Project budget reached")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(`Starting this deployment would take ${budgeted} past its monthly budget, so it wasn't started.`)).toBeVisible();
        await expect.soft(page.getByRole("link", { name: "Review the project's budget" })).toBeVisible();
        expect(await committedIn(session, projectIds[budgeted])).toBe(committedAtLimit);
      });

      await test.step("the spend by project shows each project's figures, which add up to the team's total", async () => {
        const report = await expectSpendAddsUp(session);
        await expectBudgetedSpendMatchesBudget(session, report, projectIds[budgeted]);
        await usage.goto();
        for (const name of [budgeted, unbudgeted]) {
          const projectSpend = report.projects.find(project => project.name === name);
          await expect.soft(usage.projectRow(name)).toContainText(`${usd(projectSpend?.committedUsd ?? -1)} committed`);
        }
      });
    } finally {
      await Promise.all(dseqs.map(dseq => closeDeploymentQuietly(session, dseq)));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a project budget set with a team key alerts before a deploy past it is refused, and the spend report adds up to the team's total", async ({
    page,
    playwright
  }) => {
    const { team, sharedProject: budgeted, hiddenProject: unbudgeted, suffix } = createNames();
    const inbox = createInboxClient();
    let client: APIRequestContext | undefined;
    const dseqs: string[] = [];

    try {
      const { me, keyClient } = await test.step("the owner creates a funded team and a team key", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
        const key = await createApiKey(page.request, { name: `e2e-money-budget-${suffix}` });
        client = await openApiKeyClient(playwright, key.apiKey);
        const api = keyApi(client);

        return { keyClient: api, me: (await getJson<Me>(api, "v1/user/me")).data };
      });

      const projectIds = await test.step("the key creates two projects and sets a monthly budget on one", async () => {
        const ids: Record<string, string> = {};
        for (const name of [budgeted, unbudgeted]) {
          ids[name] = (await readJson<CreatedProject>(await keyClient.request.post(`${keyClient.prefix}v1/projects`, { data: { data: { name } } }))).data.id;
        }
        const created = await keyClient.request.post(`${keyClient.prefix}v1/project-budgets`, {
          data: { data: { projectId: ids[budgeted], monthlyAmountUsd: MONTHLY_BUDGET_USD, alertThresholdPercent: BUDGET_ALERT_THRESHOLD_PERCENT } }
        });
        expect(created.status(), await created.text()).toBe(201);

        return ids;
      });

      const deployedAtMs = Date.now();

      await test.step("the key leases a deployment in each project", async () => {
        for (const name of [budgeted, unbudgeted]) {
          const created = await createDeployment(keyClient, { name: `e2e-${name}`, projectId: projectIds[name] });
          dseqs.push(created.dseq);
          await leaseFirstBid(keyClient, created);
        }
      });

      await test.step("the budget alert reaches the owner while the project is still within its budget", async () => {
        await waitForEmail(inbox, {
          email: me.email,
          subject: `Project ${budgeted} has committed ${BUDGET_ALERT_THRESHOLD_PERCENT}% of its monthly budget`,
          receivedAfterMs: deployedAtMs
        });
        expect(await committedIn(keyClient, projectIds[budgeted])).toBeLessThanOrEqual(MONTHLY_BUDGET_USD);
      });

      await test.step("the key deploys into the budgeted project until a deploy past its budget is refused with the reason", async () => {
        dseqs.push(...(await fillBudget(keyClient, projectIds[budgeted])));
        const committedAtLimit = await committedIn(keyClient, projectIds[budgeted]);

        const refused = await postDeployment(keyClient, { name: `e2e-refused-${suffix}`, projectId: projectIds[budgeted] });
        const body = (await refused.json()) as BudgetRefusal;
        expect(refused.status()).toBe(403);
        expect(body).toMatchObject({
          code: "project_budget_exceeded",
          message: "This would take the project past its monthly budget, so it was not signed. An owner or admin can raise the budget.",
          data: { projectIds: [projectIds[budgeted]] }
        });
        expect(await committedIn(keyClient, projectIds[budgeted])).toBe(committedAtLimit);
      });

      await test.step("the key's spend report per project adds up to the team's total", async () => {
        const report = await expectSpendAddsUp(keyClient);
        expect(report.projects.map(project => project.name)).toEqual(expect.arrayContaining([budgeted, unbudgeted]));
        await expectBudgetedSpendMatchesBudget(keyClient, report, projectIds[budgeted]);
      });
    } finally {
      await Promise.all(dseqs.map(dseq => closeDeploymentQuietly(sessionApi(page), dseq)));
      await client?.dispose();
      await deleteTeamsLeftBehind(page);
    }
  });
});

function sessionApi(page: Page): Api {
  return { request: page.request, prefix: `${PROXY_API_URL}/` };
}

function keyApi(client: APIRequestContext): Api {
  return { request: client, prefix: "" };
}

async function readJson<T>(response: APIResponse): Promise<T> {
  expect(response.status(), `${response.url()}: ${await response.text()}`).toBeLessThan(300);

  return (await response.json()) as T;
}

async function getJson<T>(api: Api, path: string, params?: Record<string, string>): Promise<T> {
  return await readJson<T>(await api.request.get(`${api.prefix}${path}`, { params }));
}

function usd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

async function isBonusOffered(api: Api): Promise<boolean> {
  return (await getJson<BonusEligibility>(api, "v1/stripe/first-purchase-bonus")).data.eligible;
}

async function listWallets(api: Api, userId: string) {
  return (await getJson<WalletList>(api, "v1/wallets", { userId })).data;
}

/** A new account's trial wallet is listed only once a queued job activates it, a little after sign-up and whatever the account does meanwhile. */
async function waitForPersonalWallet(api: Api, userId: string) {
  let wallets: WalletList["data"] = [];
  await expect
    .poll(
      async () => {
        wallets = await listWallets(api, userId);
        return wallets.length;
      },
      { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(1);

  return wallets.map(({ address, creditAmount }) => ({ address, creditAmount }));
}

async function readCredit(api: Api, userId: string): Promise<number | undefined> {
  const credit = (await listWallets(api, userId))[0]?.creditAmount;

  return credit === undefined ? undefined : credit / MICRO_UNITS_PER_USD;
}

async function walletAddressOf(api: Api, userId: string): Promise<string> {
  const [wallet] = await listWallets(api, userId);
  expect(wallet?.address).toBeTruthy();

  return wallet.address;
}

async function listTransactions(api: Api) {
  return (await getJson<TransactionList>(api, "v1/stripe/transactions")).data.transactions;
}

function isAutoRechargeOf(amountUsd: number) {
  return (transaction: TransactionList["data"]["transactions"][number]) => transaction.amount === amountUsd * 100 && transaction.status === "succeeded";
}

/** A card saved in billing is charged without Stripe's form, which only a browser can fill. */
async function createTeamWithSavedCard(page: Page, team: string) {
  const addPaymentMethod = new AddPaymentMethodPopupPage(page);
  await createTeam(page, team);
  await new BillingPage(page).goto();
  await addPaymentMethod.open();
  await addPaymentMethod.fillAddress(ADDRESS);
  await addPaymentMethod.fillCard(CARD);
  await addPaymentMethod.submit();
  await expect(addPaymentMethod.savedCard(TEST_CARD_LAST4)).toBeVisible({ timeout: 60_000 });
}

async function organizationIdOf(page: Page, name: string) {
  return (await listOrganizations(page.request)).data.find(organization => organization.name === name)?.id;
}

async function buyWithSavedCard(api: Api, input: { userId: string; amountUsd: number }) {
  const { data: paymentMethods } = await getJson<PaymentMethodList>(api, "v1/stripe/payment-methods");
  const card = paymentMethods.find(paymentMethod => paymentMethod.card?.last4 === TEST_CARD_LAST4);
  expect(card, "the team's saved card").toBeDefined();

  const response = await api.request.post(`${api.prefix}v1/stripe/transactions/confirm`, {
    data: { data: { userId: input.userId, paymentMethodId: card?.id, amount: input.amountUsd, awaitResolved: true, idempotencyKey: crypto.randomUUID() } }
  });
  const { data } = await readJson<ConfirmedPayment>(response);
  expect(response.status()).toBe(200);
  expect(data.success).toBe(true);
}

async function postDeployment(api: Api, input: { name?: string; projectId?: string }): Promise<APIResponse> {
  let response: APIResponse | undefined;
  await expect
    .poll(
      async () => {
        response = await api.request.post(`${api.prefix}v1/deployments`, { data: { data: { sdl: SDL, ...input } } });
        return WALLET_NOT_READY_STATUSES.includes(response.status());
      },
      { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(false);

  return response as APIResponse;
}

async function createDeployment(api: Api, input: { name?: string; projectId?: string }) {
  const response = await postDeployment(api, input);
  expect(response.status(), await response.text()).toBe(201);

  return ((await response.json()) as CreatedDeployment).data;
}

async function leaseFirstBid(api: Api, deployment: { dseq: string; manifest: string }) {
  let bid: BidList["data"][number] | undefined;
  await expect
    .poll(
      async () => {
        bid = (await getJson<BidList>(api, "v1/bids", { dseq: deployment.dseq })).data[0];
        return !!bid;
      },
      { timeout: BID_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(true);

  const { dseq, gseq, oseq, provider } = (bid as BidList["data"][number]).bid.id;
  const response = await api.request.post(`${api.prefix}v1/leases`, { data: { leases: [{ dseq, gseq, oseq, provider }], manifest: deployment.manifest } });
  expect(response.status(), await response.text()).toBe(200);
}

/** Auto recharge skips a wallet with no active deployment, which it counts from the indexer rather than the chain. */
async function waitUntilIndexedAsActive(request: APIRequestContext, address: string, dseq: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${DIRECT_API_URL}/v1/addresses/${address}/deployments/0/10`, { params: { status: "active" } });
        return ((await response.json()) as IndexedDeployments).results?.map(indexed => indexed.dseq) ?? [];
      },
      { timeout: AUTO_RECHARGE_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toContain(dseq);
}

async function closeDeploymentQuietly(api: Api, dseq: string) {
  await api.request.delete(`${api.prefix}v1/deployments/${dseq}`, { failOnStatusCode: false, timeout: 60_000 }).catch(() => undefined);
}

async function projectIdsByName(api: Api): Promise<Record<string, string>> {
  const { data } = await getJson<{ data: { id: string; name: string }[] }>(api, "v1/projects");

  return Object.fromEntries(data.map(project => [project.name, project.id]));
}

async function committedIn(api: Api, projectId: string): Promise<number> {
  const { data } = await getJson<ProjectBudgetList>(api, "v1/project-budgets", { projectId });

  return data[0].currentPeriod.committedUsd;
}

/** Creates as many deployments as the budget still has room for at the default deposit, closing each, since a closed deployment's deposit stays committed. */
async function fillBudget(api: Api, projectId: string): Promise<string[]> {
  const { data: funding } = await readJson<{ data: { defaultDepositUsd: number } }>(await api.request.get(`${DIRECT_API_URL}/v1/deployment-funding-config`));
  const room = MONTHLY_BUDGET_USD - (await committedIn(api, projectId));
  const created: string[] = [];

  for (let index = 0; index < Math.floor(room / funding.defaultDepositUsd + 1e-9); index++) {
    const { dseq } = await createDeployment(api, { projectId });
    created.push(dseq);
    await closeDeploymentQuietly(api, dseq);
  }

  return created;
}

/** Each report is summed within one answer, since what is consumed keeps accruing between two requests. */
async function expectSpendAddsUp(api: Api) {
  const { data: report } = await getJson<ProjectSpendReport>(api, "v1/project-spend");
  const parts = [...report.projects, ...(report.unassigned ? [report.unassigned] : [])];
  expect(report.total).not.toBeNull();
  expect(sum(parts.map(part => part.committedUsd))).toBeCloseTo(report.total?.committedUsd ?? -1, 6);
  expect(sum(parts.map(part => part.consumedUsd))).toBeCloseTo(report.total?.consumedUsd ?? -1, 6);
  expect(report.total?.committedUsd).toBeGreaterThan(0);

  const { data: deploymentSpend } = await getJson<DeploymentSpendReport>(api, "v1/deployment-spend");
  for (const project of report.projects) {
    const deployments = deploymentSpend.deployments.filter(deployment => deployment.projectId === project.projectId);
    const days = deploymentSpend.days.filter(day => day.projectId === project.projectId);
    expect(sum(days.map(day => day.consumedUsd))).toBeCloseTo(sum(deployments.map(deployment => deployment.consumedUsd)), 6);
    expect(sum(deployments.map(deployment => deployment.consumedUsd))).toBeCloseTo(project.consumedUsd, 2);
  }

  return report;
}

/** A team made after the deposit ledger started has every deposit in it, so its spend report commits exactly what its budget counts. */
async function expectBudgetedSpendMatchesBudget(api: Api, report: ProjectSpendReport["data"], projectId: string) {
  const committedInReport = report.projects.find(project => project.projectId === projectId)?.committedUsd;
  expect.soft(committedInReport, "the spend report commits what the project's budget counts").toBe(await committedIn(api, projectId));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

async function startDeploymentThroughUi(page: Page, input: { projectName: string; deploymentName: string }) {
  const projects = new ProjectsPage(page);
  const configure = new ConfigureDeploymentPage(page);
  await projects.goto();
  await projects.openProject(input.projectName);
  await new ProjectPage(page).startNewDeployment();
  await configure.continueWithOwnContainer();
  await expect(configure.deployTarget()).toContainText(input.projectName);
  await configure.fillDeploymentName(input.deploymentName);
  await configure.fillImageName("nginx:latest");
  await configure.requestQuotes();
}

async function deployThroughUi(page: Page, input: { projectName: string; deploymentName: string }): Promise<string> {
  const configure = new ConfigureDeploymentPage(page);
  await startDeploymentThroughUi(page, input);
  await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });
  const dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1] ?? "";
  expect(dseq).toBeTruthy();
  await configure.selectFirstAvailableProvider();
  await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
  await configure.confirmAndOpenDeployment(dseq);

  return dseq;
}
