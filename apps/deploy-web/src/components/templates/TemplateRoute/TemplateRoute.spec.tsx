import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { ITemplate } from "@src/types";
import { loadTemplateRouteProps } from "./loadTemplateRouteProps";
import { DEPENDENCIES, TemplateRoute } from "./TemplateRoute";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const TEMPLATE_ID = "tpl-webui";
const API_URL = "https://console-api.akash.network";
const LEGACY_TEMPLATE = mock<ITemplate>({ id: TEMPLATE_ID, title: "Open WebUI + vLLM" });

describe(TemplateRoute.name, () => {
  it("renders the legacy page when template_marketplace is off", async () => {
    const { context, get } = setupContext({ isMarketplaceEnabled: false, accessToken: "token-1" });

    const result = await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(result).toEqual({ props: { id: TEMPLATE_ID, template: LEGACY_TEMPLATE } });
    expect(get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, { headers: { Authorization: "Bearer token-1" } });

    const { UserTemplate, TemplatePage } = setup(result.props);

    expect(UserTemplate).toHaveBeenCalledWith({ id: TEMPLATE_ID, template: LEGACY_TEMPLATE }, expect.anything());
    expect(TemplatePage).not.toHaveBeenCalled();
  });

  it("fetches the legacy template without credentials for a request without a session", async () => {
    const { context, get } = setupContext({ isMarketplaceEnabled: false, accessToken: null });

    await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, {});
  });

  it("renders the template page and fetches nothing when template_marketplace is on", async () => {
    const { context, get, featureFlagService } = setupContext({ isMarketplaceEnabled: true, accessToken: "token-1" });

    const result = await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(result).toEqual({ props: { id: TEMPLATE_ID, isMarketplace: true } });
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("template_marketplace", context, { userId: "user-1" });
    expect(get).not.toHaveBeenCalled();

    const { UserTemplate, TemplatePage } = setup(result.props);

    expect(TemplatePage).toHaveBeenCalledWith({ id: TEMPLATE_ID }, expect.anything());
    expect(UserTemplate).not.toHaveBeenCalled();
  });

  function setupContext(input: { isMarketplaceEnabled: boolean; accessToken: string | null }) {
    const featureFlagService = mock<FeatureFlagService>();
    featureFlagService.isEnabledForCtx.mockImplementation(async flag => flag === "template_marketplace" && input.isMarketplaceEnabled);
    const consoleApiHttpClient = mock<AppTypedContext["services"]["consoleApiHttpClient"]>();
    consoleApiHttpClient.get.mockResolvedValue({ data: LEGACY_TEMPLATE });
    const get = consoleApiHttpClient.get;
    const session = input.accessToken ? { user: { id: "user-1" }, accessToken: input.accessToken } : null;
    const services = mock<AppTypedContext["services"]>({
      featureFlagService,
      consoleApiHttpClient,
      apiUrlService: mock<AppTypedContext["services"]["apiUrlService"]>({ getBaseApiUrlFor: vi.fn(() => API_URL) }),
      privateConfig: mock<AppTypedContext["services"]["privateConfig"]>({ NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet" })
    });
    const context = mock<AppTypedContext>({
      getCurrentSession: vi.fn(async () => session) as AppTypedContext["getCurrentSession"],
      services
    });

    return { context, get, featureFlagService };
  }

  function setup(props: Parameters<typeof TemplateRoute>[0]) {
    const dependencies = MockComponents(DEPENDENCIES);

    render(<TemplateRoute {...props} dependencies={dependencies} />);

    return dependencies;
  }
});
