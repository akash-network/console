import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useServices } from "@src/context/ServicesProvider";
import type { AssistantLiveHelpReason } from "@src/types/assistant";
import { DiscordHelpCard } from "./DiscordHelpCard";

import { render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof useServices>;

describe("DiscordHelpCard", () => {
  it("links to the support Discord in a new tab", () => {
    setup({});

    const link = screen.getByRole("link", { name: /Get live help on Discord/ });
    expect(link).toHaveAttribute("href", "https://discord.gg/akash");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("The Akash community and team are there");
  });

  it.each<[AssistantLiveHelpReason, string]>([
    ["provider_side_issue", "This needs someone who can look at the provider side"],
    ["not_supported_here", "The assistant can't do this from Console"],
    ["no_confident_answer", "The assistant isn't sure about this one"],
    ["user_asked_for_a_person", "Talk to the Akash team and community"]
  ])("says why live help fits when the assistant gave %s", (reason, message) => {
    setup({ reason });

    expect(screen.getByRole("link", { name: /Get live help on Discord/ })).toHaveTextContent(message);
  });

  function setup(input: { reason?: AssistantLiveHelpReason }) {
    const publicConfig = Object.assign(mock<Container["publicConfig"]>(), { NEXT_PUBLIC_CONTACT_SUPPORT_URL: "https://discord.gg/akash" });

    render(
      <TestContainerProvider services={{ publicConfig: () => publicConfig }}>
        <DiscordHelpCard reason={input.reason} />
      </TestContainerProvider>
    );
  }
});
