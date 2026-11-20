import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { MarketplaceTemplate } from "@src/types/marketplace-template";
import type { IUserSetting } from "@src/types/user";
import { loadUserProfileRouteProps } from "./loadUserProfileRouteProps";

const API_URL = "https://console-api.akash.network";
const USER_URL = `${API_URL}/v1/user/byUsername/alice`;
const TEMPLATES_URL = `${API_URL}/v1/user/templates/alice`;

type Publisher = NonNullable<MarketplaceTemplate["publisher"]>;
type TemplateAnswer = Partial<Pick<Publisher, "type" | "handle">> | "no publisher" | Error;

describe(loadUserProfileRouteProps.name, () => {
  it("serves the profile page and looks nothing else up while template_marketplace is off", async () => {
    const { context, get, user, featureFlagService } = setup({ flag: "off", templates: { "tpl-1": { type: "personal", handle: "alice" } } });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ props: { username: "alice", user } });
    expect(get.mock.calls).toEqual([[USER_URL]]);
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("template_marketplace", context, expect.anything());
  });

  it("leads to the publisher page named by one of the user's public templates", async () => {
    const { context, get } = setup({ flag: "on", templates: { "tpl-1": { type: "personal", handle: "alice-2" } } });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ redirect: { destination: "/template-publishers/alice-2", permanent: false } });
    expect(get.mock.calls).toEqual([[TEMPLATES_URL], [`${API_URL}/v1/user-templates/tpl-1`]]);
  });

  it("keeps the profile page for a user with no public template", async () => {
    const { context, get, user } = setup({ flag: "on", templates: {} });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ props: { username: "alice", user } });
    expect(get.mock.calls).toEqual([[TEMPLATES_URL], [USER_URL]]);
  });

  it("skips a template that is hidden, belongs to a team or has no publisher page yet, and takes the next", async () => {
    const { context, get, logger } = setup({
      flag: "on",
      templates: {
        "tpl-hidden": new Error("404"),
        "tpl-team": { type: "team", handle: "lambda-garage" },
        "tpl-own": { type: "personal", handle: "alice" }
      }
    });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ redirect: { destination: "/template-publishers/alice", permanent: false } });
    expect(get).toHaveBeenCalledTimes(4);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("keeps the profile page when no template names a personal publisher page", async () => {
    const { context, user } = setup({
      flag: "on",
      templates: { "tpl-unpublished": { type: "personal", handle: null }, "tpl-orphan": "no publisher", "tpl-team": { type: "team", handle: "lambda-garage" } }
    });

    expect(await loadUserProfileRouteProps("alice", context)).toEqual({ props: { username: "alice", user } });
  });

  it("asks about three templates at most", async () => {
    const { context, get, user } = setup({
      flag: "on",
      templates: {
        "tpl-1": { type: "team", handle: "t" },
        "tpl-2": { type: "team", handle: "t" },
        "tpl-3": { type: "team", handle: "t" },
        "tpl-4": { type: "personal", handle: "alice" }
      }
    });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ props: { username: "alice", user } });
    expect(get.mock.calls.map(call => call[0])).toEqual([
      TEMPLATES_URL,
      `${API_URL}/v1/user-templates/tpl-1`,
      `${API_URL}/v1/user-templates/tpl-2`,
      `${API_URL}/v1/user-templates/tpl-3`,
      USER_URL
    ]);
  });

  it("keeps the profile page and warns when the templates cannot be listed", async () => {
    const listError = new Error("503");
    const { context, user, logger } = setup({ flag: "on", templates: listError });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ props: { username: "alice", user } });
    expect(logger.warn).toHaveBeenCalledWith({ event: "PUBLISHER_HANDLE_LOOKUP_FAILED", error: listError });
  });

  it("keeps the profile page while the flag service is down", async () => {
    const { context, get, user } = setup({ flag: "failing", templates: { "tpl-1": { type: "personal", handle: "alice" } } });

    const result = await loadUserProfileRouteProps("alice", context);

    expect(result).toEqual({ props: { username: "alice", user } });
    expect(get.mock.calls).toEqual([[USER_URL]]);
  });

  it("lets an unknown user fail the way the profile page always did", async () => {
    const userError = new Error("404");
    const { context } = setup({ flag: "on", templates: {}, userError });

    await expect(loadUserProfileRouteProps("alice", context)).rejects.toBe(userError);
  });

  it("keeps a username and a template id inside their path segments of the lookups", async () => {
    const { context, get } = setup({ flag: "on", username: "a/b", templates: { "x/../y": { type: "personal", handle: "a-b" } } });

    await loadUserProfileRouteProps("a/b", context);

    expect(get.mock.calls).toEqual([[`${API_URL}/v1/user/templates/a%2Fb`], [`${API_URL}/v1/user-templates/x%2F..%2Fy`]]);
  });

  function setup(input: { flag: "on" | "off" | "failing"; username?: string; templates: Record<string, TemplateAnswer> | Error; userError?: Error }) {
    const username = input.username ?? "alice";
    const user = mock<IUserSetting>({ username });
    const featureFlagService = mock<FeatureFlagService>();
    featureFlagService.isEnabledForCtx.mockImplementation(async flag => {
      if (input.flag === "failing") throw new Error("unleash down");
      return flag === "template_marketplace" && input.flag === "on";
    });
    const get = vi.fn(async (url: string): Promise<{ data: unknown }> => {
      if (url === `${API_URL}/v1/user/byUsername/${username}`) {
        if (input.userError) throw input.userError;
        return { data: user };
      }
      if (url === `${API_URL}/v1/user/templates/${encodeURIComponent(username)}`) {
        if (input.templates instanceof Error) throw input.templates;
        return { data: Object.keys(input.templates).map(id => ({ id })) };
      }

      const answer = Object.entries(input.templates).find(([id]) => url === `${API_URL}/v1/user-templates/${encodeURIComponent(id)}`)?.[1];
      if (answer === undefined || answer instanceof Error) throw answer ?? new Error(`unexpected request: ${url}`);
      return { data: { data: { publisher: answer === "no publisher" ? null : answer } } };
    });
    const consoleApiHttpClient = Object.assign(mock<AppTypedContext["services"]["consoleApiHttpClient"]>(), { get });
    const logger = mock<AppTypedContext["services"]["logger"]>();
    const services = mock<AppTypedContext["services"]>({
      featureFlagService,
      consoleApiHttpClient,
      logger,
      apiUrlService: mock<AppTypedContext["services"]["apiUrlService"]>({ getBaseApiUrlFor: vi.fn(() => API_URL) }),
      privateConfig: mock<AppTypedContext["services"]["privateConfig"]>({ NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet" })
    });
    const context = mock<AppTypedContext>({
      getCurrentSession: vi.fn<AppTypedContext["getCurrentSession"]>(async () => null),
      services
    });

    return { context, get, user, featureFlagService, logger };
  }
});
