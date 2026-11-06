"use client";
import type { FC } from "react";
import Link from "next/link";

import { useFavoriteProviders } from "@src/hooks/useFavoriteProviders/useFavoriteProviders";
import { UrlService } from "@src/utils/urlUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useFavoriteProviders, ActionCardChrome };

export const FavoriteProviderCard: FC<ActionCardProps<"favorite_provider"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { favoriteProviders, addFavorite } = d.useFavoriteProviders();
  const isAlreadyFavorite = decision.status === "pending" && favoriteProviders.includes(action.provider);

  return (
    <d.ActionCardChrome
      title="Add to favorite providers"
      tier={action.tier}
      decision={decision}
      rows={[
        {
          label: "Provider",
          value: (
            <Link href={UrlService.providerDetail(action.provider)} className="font-mono text-xs underline underline-offset-[3px]">
              {action.provider}
            </Link>
          )
        }
      ]}
      costNote="Saved to your account. The providers list can show only your favorites."
      confirmLabel="Add to favorites"
      successMessage="Added to your favorites."
      isConfirmDisabled={isAlreadyFavorite}
      onConfirm={() => addFavorite(action.provider)}
    >
      {isAlreadyFavorite && <p className="text-sm text-muted-foreground">This provider is already one of your favorites.</p>}
    </d.ActionCardChrome>
  );
};
