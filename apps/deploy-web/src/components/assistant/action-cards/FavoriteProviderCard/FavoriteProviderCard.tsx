"use client";
import type { FC } from "react";
import Link from "next/link";

import { getProviderName } from "@src/components/providers/providerSummary/providerSummary";
import { useFavoriteProviders } from "@src/hooks/useFavoriteProviders/useFavoriteProviders";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import { UrlService } from "@src/utils/urlUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useFavoriteProviders, useProvidersByAddresses, ActionCardChrome };

export const FavoriteProviderCard: FC<ActionCardProps<"favorite_provider"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { favoriteProviders, addFavorite } = d.useFavoriteProviders();
  const {
    data: [provider]
  } = d.useProvidersByAddresses([action.provider]);
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
            <Link href={UrlService.providerDetail(action.provider)} className="underline underline-offset-[3px]">
              {provider ? getProviderName(provider) : "View provider"}
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
