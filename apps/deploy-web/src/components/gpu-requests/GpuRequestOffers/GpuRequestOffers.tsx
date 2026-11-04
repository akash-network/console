import type { FC } from "react";
import { Spinner } from "@akashnetwork/ui/components";

import { useHardwareRequestOffersQuery } from "@src/queries/useHardwareRequestsQuery";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { GpuOffersTable } from "./GpuOffersTable";

export const DEPENDENCIES = { useHardwareRequestOffersQuery, GpuOffersTable };

type Props = {
  request: HardwareRequest;
  dependencies?: typeof DEPENDENCIES;
};

export const GpuRequestOffers: FC<Props> = ({ request, dependencies: d = DEPENDENCIES }) => {
  const { data: offers, isLoading, isError } = d.useHardwareRequestOffersQuery(request.id);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="small" />
        Loading offers…
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        Couldn&apos;t load the offers. Try again in a moment.
      </p>
    );
  }
  if (!offers?.length) return null;

  return <d.GpuOffersTable spec={request.spec} offers={offers} now={new Date()} />;
};
