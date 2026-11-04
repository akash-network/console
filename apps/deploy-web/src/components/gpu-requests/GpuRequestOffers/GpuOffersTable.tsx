import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { format } from "date-fns";
import { TriangleAlertIcon } from "lucide-react";

import type { GpuRequestOffer, OfferSort, OfferValue } from "../gpuOfferComparison/gpuOfferComparison";
import { describeOfferAttributes, describeOfferState, labelOffers, listShownOffers, OFFER_SORTS, sortOffers } from "../gpuOfferComparison/gpuOfferComparison";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";

type Props = {
  spec: HardwareRequest["spec"];
  offers: GpuRequestOffer[];
  now: Date;
  renderActions?: (offer: GpuRequestOffer, label: string) => ReactNode;
};

export const GpuOffersTable: FC<Props> = ({ spec, offers, now, renderActions }) => {
  const [sort, setSort] = useState<OfferSort>("price");
  const attributes = describeOfferAttributes(spec, format(now, "yyyy-MM-dd"));
  const labels = labelOffers(offers);
  const shown = sortOffers(listShownOffers(offers), sort);
  const hasMismatch = shown.some(offer => attributes.some(attribute => attribute.offer(offer).mismatch));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 empty:hidden">
        {hasMismatch && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TriangleAlertIcon className="h-3 w-3 text-warning" aria-hidden="true" />
            Doesn&apos;t match your request
          </span>
        )}
        {shown.length > 1 && (
          <div role="group" aria-label="Sort offers" className="ml-auto flex items-center gap-1">
            {OFFER_SORTS.map(option => (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant="ghost"
                className="aria-pressed:bg-muted aria-pressed:font-medium"
                aria-pressed={sort === option.value}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
          <caption className="sr-only">Offers compared with your request</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">
                Offer
              </th>
              {attributes.map(attribute => (
                <th key={attribute.id} scope="col" className="px-3 py-2 font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {attribute.label}
                </th>
              ))}
              {renderActions && (
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th scope="row" className="px-3 py-2.5 align-top font-semibold">
                Your request
              </th>
              {attributes.map(attribute => (
                <td key={attribute.id} className="px-3 py-2.5 align-top">
                  <OfferCell value={attribute.request} />
                </td>
              ))}
              {renderActions && <td />}
            </tr>
            {shown.map(offer => (
              <tr key={offer.id} className="border-b last:border-b-0">
                <th scope="row" className="px-3 py-2.5 align-top">
                  <span className="block font-semibold">{labels.get(offer.id)}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{describeOfferState(offer, now)}</span>
                </th>
                {attributes.map(attribute => (
                  <td key={attribute.id} className="px-3 py-2.5 align-top">
                    <OfferCell value={attribute.offer(offer)} />
                  </td>
                ))}
                {renderActions && <td className="px-3 py-2.5 align-top">{renderActions(offer, labels.get(offer.id)!)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function OfferCell({ value }: { value: OfferValue }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span>{value.main}</span>
      {value.sub && <span className="font-mono text-xs text-muted-foreground">{value.sub}</span>}
      {value.mismatch && (
        <span className="flex items-center gap-1 text-xs text-warning">
          <TriangleAlertIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {value.mismatch}
        </span>
      )}
    </div>
  );
}
