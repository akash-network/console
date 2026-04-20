"use client";
import type { FC } from "react";
import { Card } from "@akashnetwork/ui/components";

import type { ActiveFilter } from "@src/hooks/useActiveFilters";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { ProviderListPanel } from "../ProviderListPanel";
import type { EnrichedProvider } from "../ProviderTable";

type Props = {
  providers: EnrichedProvider[];
  total: number;
  isLoading: boolean;
  placementFilters: PlacementFilters;
  activeFilters: ActiveFilter[];
  onDismissFilter: (key: string) => void;
  onClearAllFilters: () => void;
  onGetQuote: (provider: EnrichedProvider) => void;
  onToggleFavorite: (owner: string) => void;
};

export const ProvidersCard: FC<Props> = props => (
  <Card className="flex h-full flex-col overflow-hidden">
    <ProviderListPanel {...props} />
  </Card>
);
