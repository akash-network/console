import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./AssistantExamplePrompts";
import { AssistantExamplePrompts, EXAMPLE_PROMPTS } from "./AssistantExamplePrompts";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("AssistantExamplePrompts", () => {
  it.each([
    { case: "the configure page", page: "/new-deployment/configure", deploymentDseq: null, isTrialing: false, prompts: EXAMPLE_PROMPTS.configure },
    {
      case: "the configure page of a deployment waiting on bids",
      page: "/new-deployment/configure/42",
      deploymentDseq: "42",
      isTrialing: true,
      prompts: EXAMPLE_PROMPTS.configure
    },
    { case: "a deployment's page", page: "/deployments/42", deploymentDseq: "42", isTrialing: false, prompts: EXAMPLE_PROMPTS.deployment },
    { case: "a trial deployment's page", page: "/deployments/42", deploymentDseq: "42", isTrialing: true, prompts: EXAMPLE_PROMPTS.trialDeployment },
    { case: "any other page", page: "/templates", deploymentDseq: null, isTrialing: false, prompts: EXAMPLE_PROMPTS.general },
    { case: "any other page during a trial", page: "/templates", deploymentDseq: null, isTrialing: true, prompts: EXAMPLE_PROMPTS.trialGeneral },
    { case: "no known page", page: null, deploymentDseq: null, isTrialing: false, prompts: EXAMPLE_PROMPTS.general },
    {
      case: "a page that only starts like the configure page",
      page: "/new-deployment/configured",
      deploymentDseq: null,
      isTrialing: false,
      prompts: EXAMPLE_PROMPTS.general
    },
    {
      case: "a page that only mentions the configure page",
      page: "/docs/new-deployment/configure",
      deploymentDseq: null,
      isTrialing: false,
      prompts: EXAMPLE_PROMPTS.general
    }
  ])("offers the prompts that fit $case", ({ page, deploymentDseq, isTrialing, prompts }) => {
    setup({ page, deploymentDseq, isTrialing });

    const list = screen.getByRole("region", { name: "Try asking" });
    expect(
      within(list)
        .getAllByRole("button")
        .map(button => button.textContent)
    ).toEqual(prompts);
  });

  it("sends the prompt the user clicks", async () => {
    const { onSend } = setup({ page: "/deployments/42", deploymentDseq: "42", isTrialing: false });

    await userEvent.click(screen.getByRole("button", { name: "Show me the latest logs" }));

    expect(onSend).toHaveBeenCalledWith("Show me the latest logs");
  });

  it("sends a prompt picked with the keyboard", async () => {
    const { onSend } = setup({ page: "/templates", deploymentDseq: null, isTrialing: false });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith(EXAMPLE_PROMPTS.general[0]);
  });

  it("keeps every prompt short and free of chain jargon", () => {
    const prompts = Object.values(EXAMPLE_PROMPTS).flat();

    expect(prompts.filter(prompt => prompt.length > 40 || /dseq|denom|sdl|lease|\u2014/i.test(prompt))).toEqual([]);
    expect(Object.values(EXAMPLE_PROMPTS).every(group => group.length >= 3 && group.length <= 4)).toBe(true);
  });

  function setup(input: { page: string | null; deploymentDseq: string | null; isTrialing: boolean }) {
    const onSend = vi.fn();
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing });

    render(<AssistantExamplePrompts page={input.page} deploymentDseq={input.deploymentDseq} onSend={onSend} dependencies={{ useWallet }} />);

    return { onSend };
  }
});
