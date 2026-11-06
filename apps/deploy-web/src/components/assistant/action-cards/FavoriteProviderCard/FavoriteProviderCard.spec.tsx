import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./FavoriteProviderCard";
import { FavoriteProviderCard } from "./FavoriteProviderCard";

import { render, screen } from "@testing-library/react";

const PROVIDER = "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf";

describe(FavoriteProviderCard.name, () => {
  it("names the provider with a link to its page", () => {
    const { chromeProps, decision } = setup({ favorites: [] });

    expect(chromeProps()).toEqual(
      expect.objectContaining({ title: "Add to favorite providers", tier: "confirm", decision, confirmLabel: "Add to favorites", isConfirmDisabled: false })
    );
    render(<>{chromeProps().rows![0].value}</>);
    expect(screen.getByRole("link", { name: PROVIDER })).toHaveAttribute("href", UrlService.providerDetail(PROVIDER));
  });

  it("adds the provider through the same favorites as the providers page", async () => {
    const { chromeProps, addFavorite } = setup({ favorites: [] });

    await chromeProps().onConfirm!("");

    expect(addFavorite).toHaveBeenCalledWith(PROVIDER);
  });

  it("says when the provider is already a favorite", () => {
    const { chromeProps } = setup({ favorites: [PROVIDER] });

    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByText("This provider is already one of your favorites.")).toBeInTheDocument();
  });

  it("does not call a provider it just added already a favorite", () => {
    const { chromeProps } = setup({ favorites: [PROVIDER], status: "succeeded" });

    expect(chromeProps().isConfirmDisabled).toBe(false);
    expect(screen.queryByText("This provider is already one of your favorites.")).not.toBeInTheDocument();
  });

  function setup(input: { favorites: string[]; status?: ActionCardDecision["status"] }) {
    const addFavorite = vi.fn(async (_owner: string) => {});
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending" });

    render(
      <FavoriteProviderCard
        action={{ type: "favorite_provider", tier: "confirm", provider: PROVIDER }}
        decision={decision}
        dependencies={{
          useFavoriteProviders: () => mock<ReturnType<typeof DEPENDENCIES.useFavoriteProviders>>({ favoriteProviders: input.favorites, addFavorite }),
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], addFavorite, decision };
  }
});
