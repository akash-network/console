import type { Types } from "@amplitude/analytics-browser";
import { describe, expect, it } from "vitest";

import { createMarketplacePageTitlePlugin, toTrackedPageTitle } from "./marketplace-page-title.plugin";

const PAGE_TITLE = "[Amplitude] Page Title";

describe(toTrackedPageTitle.name, () => {
  it.each([
    ["a template page", 'Llama <script>alert("x")</script> · Template | Akash Console', "Template | Akash Console"],
    ["a template whose title ends like a publisher page's", "Mine · Templates · Template | Akash Console", "Template | Akash Console"],
    ["a publisher page", "Northwind Labs · Templates | Akash Console", "Template publisher | Akash Console"],
    ["a publisher named like a template page", "Odd · Template · Templates | Akash Console", "Template publisher | Akash Console"],
    ["an awesome-akash template page", "Template detail Llama.cpp server | Akash Console", "Template detail | Akash Console"]
  ])("names %s by its kind instead of what its author wrote", (_, title, trackedTitle) => {
    expect(toTrackedPageTitle(title)).toBe(trackedTitle);
  });

  it.each([
    "Templates | Akash Console",
    "My templates | Akash Console",
    "Configure your deployment | Akash Console",
    "Deployment detail | Akash Console",
    "Template removed | Akash Console",
    "Something · Template",
    "Something · Templates",
    "Template detail Llama.cpp server",
    "Not a Template detail page | Akash Console",
    ""
  ])("leaves the title %j as it is", title => {
    expect(toTrackedPageTitle(title)).toBe(title);
  });
});

describe(createMarketplacePageTitlePlugin.name, () => {
  it("is an enrichment plugin with a name of its own", () => {
    const { plugin } = setup({ documentTitle: "" });

    expect(plugin).toMatchObject({ name: "marketplace-page-title", type: "enrichment" });
  });

  it("replaces the author's title on a page view Amplitude recorded with it, whatever page is on screen by then", async () => {
    const { execute } = setup({ documentTitle: "Configure your deployment | Akash Console" });

    const event = await execute({
      event_type: "[Amplitude] Page Viewed",
      event_properties: { [PAGE_TITLE]: "Secret title · Template | Akash Console", "[Amplitude] Page Path": "/deployments/configure" }
    });

    expect(event.event_properties).toEqual({ [PAGE_TITLE]: "Template | Akash Console", "[Amplitude] Page Path": "/deployments/configure" });
  });

  it("sets the title itself on an event tracked from a template page, so Amplitude's own enrichment does not add the author's", async () => {
    const { execute } = setup({ documentTitle: "Secret title · Template | Akash Console" });

    const event = await execute({ event_type: "template_page_viewed", event_properties: { source: "community", template_id: "tpl-1" } });

    expect(event.event_properties).toEqual({ source: "community", template_id: "tpl-1", [PAGE_TITLE]: "Template | Akash Console" });
  });

  it("sets the title on an event that came without properties", async () => {
    const { execute } = setup({ documentTitle: "Northwind Labs · Templates | Akash Console" });

    const event = await execute({ event_type: "session_start" });

    expect(event.event_properties).toEqual({ [PAGE_TITLE]: "Template publisher | Akash Console" });
  });

  it("leaves an event from any other page untouched, for Amplitude to add the title as before", async () => {
    const { execute } = setup({ documentTitle: "Deployments | Akash Console" });
    const sent = { event_type: "create_deployment", event_properties: { category: "deployments" } };

    const event = await execute(sent);

    expect(event).toBe(sent);
    expect(event.event_properties).toEqual({ category: "deployments" });
  });

  it("leaves an event without properties from any other page without any", async () => {
    const { execute } = setup({ documentTitle: "Deployments | Akash Console" });

    const event = await execute({ event_type: "session_start" });

    expect(event.event_properties).toBeUndefined();
  });

  it("keeps a title an event already carries when it is not an author's, even on a template page", async () => {
    const { execute } = setup({ documentTitle: "Secret title · Template | Akash Console" });

    const event = await execute({ event_type: "[Amplitude] Page Viewed", event_properties: { [PAGE_TITLE]: "Templates | Akash Console" } });

    expect(event.event_properties).toEqual({ [PAGE_TITLE]: "Templates | Akash Console" });
  });

  it("reads the document title when the event's title is not text", async () => {
    const { execute } = setup({ documentTitle: "Secret title · Template | Akash Console" });

    const event = await execute({ event_type: "[Amplitude] Page Viewed", event_properties: { [PAGE_TITLE]: 42 } });

    expect(event.event_properties).toEqual({ [PAGE_TITLE]: "Template | Akash Console" });
  });

  it.each(["$identify", "$groupidentify", "revenue_amount"])("gives a %s event no page title", async eventType => {
    const { execute } = setup({ documentTitle: "Secret title · Template | Akash Console" });
    const sent = { event_type: eventType };

    const event = await execute(sent);

    expect(event).toBe(sent);
    expect(event.event_properties).toBeUndefined();
  });

  function setup(input: { documentTitle: string }) {
    const plugin = createMarketplacePageTitlePlugin(() => input.documentTitle);
    const execute = async (event: Types.Event) => (await plugin.execute?.(event)) as Types.Event;

    return { plugin, execute };
  }
});
