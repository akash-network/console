import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { ITemplate } from "@src/types";
import { loadTemplateRouteProps } from "./loadTemplateRouteProps";
import { DEPENDENCIES, TemplateRoute } from "./TemplateRoute";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const TEMPLATE_ID = "tpl-webui";
const API_URL = "https://console-api.akash.network";

describe(TemplateRoute.name, () => {
  it("renders the legacy page when template_marketplace is off", async () => {
    const { context, get, legacyTemplate } = setupContext({ flag: "off", accessToken: "token-1" });

    const result = await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(result).toEqual({ props: { id: TEMPLATE_ID, template: legacyTemplate } });
    expect(get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, { headers: { Authorization: "Bearer token-1" } });

    const { UserTemplate, TemplatePage } = setup(result.props);

    expect(UserTemplate).toHaveBeenCalledWith({ id: TEMPLATE_ID, template: legacyTemplate }, expect.anything());
    expect(TemplatePage).not.toHaveBeenCalled();
  });

  it("fetches the legacy template without credentials for a request without a session", async () => {
    const { context, get } = setupContext({ flag: "off", accessToken: null });

    await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, {});
  });

  it("serves the legacy page and warns when the flag service fails", async () => {
    const { context, get, legacyTemplate, logger } = setupContext({ flag: "failing", accessToken: "token-1" });

    const result = await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(result).toEqual({ props: { id: TEMPLATE_ID, template: legacyTemplate } });
    expect(get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, { headers: { Authorization: "Bearer token-1" } });
    expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_MARKETPLACE_FLAG_CHECK_FAILED", error: expect.objectContaining({ message: "unleash down" }) });
  });

  it("renders the template page and fetches nothing when template_marketplace is on", async () => {
    const { context, get, featureFlagService, logger } = setupContext({ flag: "on", accessToken: "token-1" });

    const result = await loadTemplateRouteProps(TEMPLATE_ID, context);

    expect(result).toEqual({ props: { id: TEMPLATE_ID, isMarketplace: true } });
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("template_marketplace", context, { userId: "user-1" });
    expect(get).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();

    const { UserTemplate, TemplatePage } = setup(result.props);

    expect(TemplatePage).toHaveBeenCalledWith({ id: TEMPLATE_ID }, expect.anything());
    expect(UserTemplate).not.toHaveBeenCalled();
  });

  it("starts the template page afresh when the route moves to another template", () => {
    const mountPage = vi.fn();
    const TemplatePage = vi.fn<typeof DEPENDENCIES.TemplatePage>(({ id }) => {
      useEffect(() => mountPage(id), []);
      return null;
    });
    const { rerender } = setup({ id: "tpl-a", isMarketplace: true }, { TemplatePage });

    rerender({ id: "tpl-b", isMarketplace: true });

    expect(mountPage.mock.calls).toEqual([["tpl-a"], ["tpl-b"]]);
  });

  function setupContext(input: { flag: "on" | "off" | "failing"; accessToken: string | null }) {
    const legacyTemplate = mock<ITemplate>({ id: TEMPLATE_ID, title: "Open WebUI + vLLM" });
    const featureFlagService = mock<FeatureFlagService>();
    featureFlagService.isEnabledForCtx.mockImplementation(async flag => {
      if (input.flag === "failing") throw new Error("unleash down");
      return flag === "template_marketplace" && input.flag === "on";
    });
    const consoleApiHttpClient = mock<AppTypedContext["services"]["consoleApiHttpClient"]>();
    consoleApiHttpClient.get.mockResolvedValue({ data: legacyTemplate });
    const logger = mock<AppTypedContext["services"]["logger"]>();
    const session = input.accessToken ? mock<Session>({ user: { id: "user-1" }, accessToken: input.accessToken }) : null;
    const services = mock<AppTypedContext["services"]>({
      featureFlagService,
      consoleApiHttpClient,
      logger,
      apiUrlService: mock<AppTypedContext["services"]["apiUrlService"]>({ getBaseApiUrlFor: vi.fn(() => API_URL) }),
      privateConfig: mock<AppTypedContext["services"]["privateConfig"]>({ NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet" })
    });
    const context = mock<AppTypedContext>({
      getCurrentSession: vi.fn<AppTypedContext["getCurrentSession"]>(async () => session),
      services
    });

    return { context, get: consoleApiHttpClient.get, featureFlagService, logger, legacyTemplate };
  }

  function setup(props: Parameters<typeof TemplateRoute>[0], overrides?: Partial<typeof DEPENDENCIES>) {
    const dependencies = MockComponents(DEPENDENCIES, overrides);

    const { rerender } = render(<TemplateRoute {...props} dependencies={dependencies} />);

    return {
      ...dependencies,
      rerender: (nextProps: Parameters<typeof TemplateRoute>[0]) => rerender(<TemplateRoute {...nextProps} dependencies={dependencies} />)
    };
  }
});
