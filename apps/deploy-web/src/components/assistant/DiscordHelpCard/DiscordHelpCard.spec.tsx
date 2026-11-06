import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useServices } from "@src/context/ServicesProvider";
import { DiscordHelpCard } from "./DiscordHelpCard";

import { render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof useServices>;

describe("DiscordHelpCard", () => {
  it("links to the support Discord in a new tab", () => {
    const publicConfig = Object.assign(mock<Container["publicConfig"]>(), { NEXT_PUBLIC_CONTACT_SUPPORT_URL: "https://discord.gg/akash" });

    render(
      <TestContainerProvider services={{ publicConfig: () => publicConfig }}>
        <DiscordHelpCard />
      </TestContainerProvider>
    );

    const link = screen.getByRole("link", { name: /Get live help on Discord/ });
    expect(link).toHaveAttribute("href", "https://discord.gg/akash");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
