import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { TemplateEventSubject } from "./templateEvents";
import type { DEPENDENCIES, TemplateEventName } from "./useTrackTemplateEvent";
import { useTrackTemplateEvent } from "./useTrackTemplateEvent";

import { renderHook } from "@testing-library/react";

const COMMUNITY: TemplateEventSubject = { source: "community", templateId: "tpl-1", templateVersion: 3 };

describe(useTrackTemplateEvent.name, () => {
  it("sends the event to Amplitude with exactly the source, the template id, its version and the network", () => {
    const { analyticsService } = setup({ subject: COMMUNITY, network: "sandbox" });

    expect(analyticsService.track.mock.calls).toEqual([
      ["template_page_viewed", { source: "community", template_id: "tpl-1", template_version: 3, network: "sandbox" }, "Amplitude"]
    ]);
  });

  it("sends a null version for a template without one", () => {
    const { analyticsService } = setup({
      eventName: "template_configure_opened",
      subject: { source: "official", templateId: "hello-world", templateVersion: null }
    });

    expect(analyticsService.track.mock.calls).toEqual([
      ["template_configure_opened", { source: "official", template_id: "hello-world", template_version: null, network: "mainnet" }, "Amplitude"]
    ]);
  });

  it("sends nothing while no template is named", () => {
    const { analyticsService } = setup({ subject: undefined });

    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("sends the event once the template is named", () => {
    const { analyticsService, rerender } = setup({ subject: undefined });

    rerender({ subject: COMMUNITY });

    expect(analyticsService.track).toHaveBeenCalledTimes(1);
  });

  it("sends the event once however often the page renders or the template's details change", () => {
    const { analyticsService, rerender } = setup({ subject: COMMUNITY });

    rerender({ subject: { ...COMMUNITY } });
    rerender({ subject: { ...COMMUNITY, templateVersion: 4 } });
    rerender({ subject: { ...COMMUNITY, source: "private" } });
    rerender({ subject: undefined });
    rerender({ subject: COMMUNITY });

    expect(analyticsService.track).toHaveBeenCalledTimes(1);
  });

  it("sends the event again for another template shown on the same page", () => {
    const { analyticsService, rerender } = setup({ subject: COMMUNITY });

    rerender({ subject: { source: "official", templateId: "tpl-2", templateVersion: 1 } });

    expect(analyticsService.track).toHaveBeenCalledTimes(2);
    expect(analyticsService.track).toHaveBeenLastCalledWith(
      "template_page_viewed",
      { source: "official", template_id: "tpl-2", template_version: 1, network: "mainnet" },
      "Amplitude"
    );
  });

  function setup(input: { eventName?: TemplateEventName; subject: TemplateEventSubject | undefined; network?: NetworkId }) {
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useServices: () =>
        mock<ReturnType<typeof DEPENDENCIES.useServices>>({
          analyticsService,
          networkStore: mock<ReturnType<typeof DEPENDENCIES.useServices>["networkStore"]>({ useSelectedNetworkId: () => input.network ?? "mainnet" })
        })
    };
    const { rerender } = renderHook(({ subject }) => useTrackTemplateEvent(input.eventName ?? "template_page_viewed", subject, dependencies), {
      initialProps: { subject: input.subject }
    });

    return { analyticsService, rerender };
  }
});
