import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES, TemplateSuggestionCardProps } from "./TemplateSuggestionCard";
import { TemplateSuggestionCard } from "./TemplateSuggestionCard";
import type { ReadableSuggestedTemplate, SuggestedTemplate } from "./useSuggestedTemplate";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const TEMPLATE_ID = "5f0c7f0e-6a51-4a53-9a50-0c1f3f1d2b11";
const COMMUNITY: ReadableSuggestedTemplate = {
  status: "ready",
  title: "Open WebUI + vLLM",
  summary: "Private ChatGPT-style chat on your own GPU.",
  icon: "message-square",
  publisher: { name: "Lambda Garage", verified: false },
  facts: ["v4", "1.3K deploys"],
  hardware: { cpu: 8, memoryBytes: 48 * 1024 ** 3, storageBytes: 100 * 1024 ** 3, gpu: { units: 1, models: ["a100"] } },
  isOfficial: false,
  viewUrl: `/template/${TEMPLATE_ID}`,
  configureUrl: `/deployments/configure?userTemplateId=${TEMPLATE_ID}`
};
const OFFICIAL: ReadableSuggestedTemplate = {
  ...COMMUNITY,
  title: "Ollama + Open WebUI",
  summary: "Run open models with Ollama behind a ChatGPT-style web UI.",
  publisher: { name: "Akash Network", verified: true },
  facts: ["awesome-akash"],
  hardware: null,
  isOfficial: true,
  viewUrl: "/templates/akash-network-awesome-akash-ollama",
  configureUrl: "/deployments/configure?templateId=akash-network-awesome-akash-ollama"
};

describe(TemplateSuggestionCard.name, () => {
  it("labels a community template as not reviewed by Akash and quotes its publisher's description", () => {
    const { useSuggestedTemplate } = setup({ suggested: COMMUNITY, template: { source: "console", reviewedByAkash: false } });

    const card = screen.getByRole("region", { name: "Suggested template: Open WebUI + vLLM" });
    expect(useSuggestedTemplate).toHaveBeenCalledWith("console", TEMPLATE_ID);
    expect(within(card).getByText("Community · not reviewed by Akash")).toBeInTheDocument();
    expect(within(card).queryByText("Official template")).not.toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Open WebUI + vLLM" })).toBeInTheDocument();
    expect(within(card).getByText("Lambda Garage")).toBeInTheDocument();
    expect(within(card).getByText("· v4")).toBeInTheDocument();
    expect(within(card).getByText("· 1.3K deploys")).toBeInTheDocument();
    expect(within(card).getByText("Publisher's description, quoted as written")).toBeInTheDocument();
    expect(within(card).getByText("“Private ChatGPT-style chat on your own GPU.”")).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: "Hardware" })).toHaveTextContent("1× A100");
  });

  it("links a community template to its page and to Configure for its id", () => {
    setup({ suggested: COMMUNITY, template: { source: "console", reviewedByAkash: false } });

    expect(screen.getByRole("link", { name: "View template" })).toHaveAttribute("href", `/template/${TEMPLATE_ID}`);
    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute("href", `/deployments/configure?userTemplateId=${TEMPLATE_ID}`);
  });

  it("reads an awesome-akash template as Official, with its summary in plain words", () => {
    const { useSuggestedTemplate } = setup({
      templateId: "akash-network-awesome-akash-ollama",
      suggested: OFFICIAL,
      template: { source: "awesome_akash", reviewedByAkash: true }
    });

    const card = screen.getByRole("region", { name: "Suggested template: Ollama + Open WebUI" });
    expect(useSuggestedTemplate).toHaveBeenCalledWith("awesome_akash", "akash-network-awesome-akash-ollama");
    expect(within(card).getByText("Official template")).toBeInTheDocument();
    expect(within(card).queryByText("Community · not reviewed by Akash")).not.toBeInTheDocument();
    expect(within(card).queryByText("Publisher's description, quoted as written")).not.toBeInTheDocument();
    expect(within(card).getByText("Run open models with Ollama behind a ChatGPT-style web UI.")).toBeInTheDocument();
    expect(within(card).queryByRole("list", { name: "Hardware" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute("href", "/deployments/configure?templateId=akash-network-awesome-akash-ollama");
  });

  it("reads a Console template staff promoted as Official", () => {
    setup({ suggested: { ...COMMUNITY, isOfficial: true }, template: { source: "console", reviewedByAkash: true } });

    expect(screen.getByText("Official template")).toBeInTheDocument();
    expect(screen.queryByText("Community · not reviewed by Akash")).not.toBeInTheDocument();
  });

  it("does not take the assistant's word that a template was reviewed when the template itself is not Official", () => {
    setup({ suggested: { ...COMMUNITY, isOfficial: false }, template: { source: "console", reviewedByAkash: true } });

    expect(screen.getByText("Community · not reviewed by Akash")).toBeInTheDocument();
    expect(screen.queryByText("Official template")).not.toBeInTheDocument();
  });

  it("keeps the not-reviewed label when the assistant says so, even for a template that reads as Official", () => {
    setup({ suggested: { ...COMMUNITY, isOfficial: true }, template: { source: "console", reviewedByAkash: false } });

    expect(screen.getByText("Community · not reviewed by Akash")).toBeInTheDocument();
  });

  it("offers no page link for a template that has no page, and no summary block for one without a summary", () => {
    setup({ suggested: { ...OFFICIAL, viewUrl: null, summary: null, publisher: null }, template: { source: "awesome_akash", reviewedByAkash: true } });

    expect(screen.queryByRole("link", { name: "View template" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deploy" })).toBeInTheDocument();
    expect(screen.queryByText("Akash Network")).not.toBeInTheDocument();
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  it("shows a plain notice without any link for a template that can no longer be read", () => {
    setup({ suggested: { status: "unavailable" } });

    expect(screen.getByText("This template is no longer available.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Community · not reviewed by Akash")).not.toBeInTheDocument();
  });

  it("shows nothing to follow while the template loads", () => {
    setup({ suggested: { status: "loading" } });

    expect(screen.getByRole("region", { name: "Suggested template" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers a retry and no link when the template could not be loaded", async () => {
    const retry = vi.fn();
    const { user } = setup({ suggested: { status: "failed", retry } });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this template.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("records that Configure was opened when Deploy is followed, and not when the template page is", async () => {
    const { user, decision } = setup({ suggested: COMMUNITY });
    screen.getAllByRole("link").forEach(link => link.addEventListener("click", event => event.preventDefault()));

    await user.click(screen.getByRole("link", { name: "View template" }));
    expect(decision.markOpened).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "Deploy" }));
    expect(decision.markOpened).toHaveBeenCalledTimes(1);
  });

  it("says the template was opened once it has been", () => {
    setup({ suggested: COMMUNITY, decisionStatus: "succeeded" });

    expect(screen.getByRole("status")).toHaveTextContent("Opened.");
  });

  it("says nothing about opening before Deploy is followed", () => {
    setup({ suggested: COMMUNITY });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders markup in a title, a summary, a publisher name and a fact as inert text", () => {
    const { container } = setup({
      suggested: {
        ...COMMUNITY,
        title: '<img src=x onerror="window.__xssTitle=1">',
        summary: "<script>window.__xssSummary=1</script><a href='javascript:alert(1)'>click</a>",
        publisher: { name: "<b onmouseover=alert(1)>Evil</b>", verified: false },
        facts: ["<i>v1</i>"]
      }
    });

    expect(screen.getByRole("heading")).toHaveTextContent('<img src=x onerror="window.__xssTitle=1">');
    expect(screen.getByRole("blockquote")).toHaveTextContent("<script>window.__xssSummary=1</script>");
    expect(screen.getByText("<b onmouseover=alert(1)>Evil</b>")).toBeInTheDocument();
    expect(container.querySelector("img, script, b, i, a[href^='javascript']")).toBeNull();
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([COMMUNITY.viewUrl, COMMUNITY.configureUrl]);
  });

  function setup(input: {
    templateId?: string;
    suggested: SuggestedTemplate;
    template?: TemplateSuggestionCardProps["template"];
    decisionStatus?: ActionCardDecision["status"];
  }) {
    const useSuggestedTemplate = vi.fn<typeof DEPENDENCIES.useSuggestedTemplate>(() => input.suggested);
    const decision = mock<ActionCardDecision>({ status: input.decisionStatus ?? "pending" });
    const user = userEvent.setup();
    const { container } = render(
      <TemplateSuggestionCard
        templateId={input.templateId ?? TEMPLATE_ID}
        template={input.template ?? { source: "console", reviewedByAkash: false }}
        decision={decision}
        dependencies={{ useSuggestedTemplate }}
      />
    );

    return { useSuggestedTemplate, decision, user, container };
  }
});
