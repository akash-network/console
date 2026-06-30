"use client";
import type { ComponentProps, FC } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";
import { ArrowRight, Rocket } from "iconoir-react";

import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import type { PlacementType } from "@src/types";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import type { ReviewRow } from "./useReviewRows";
import { useReviewRows } from "./useReviewRows";

export const DEPENDENCIES = { useReviewRows, PricePerTimeUnit };

interface Props {
  open: boolean;
  dseq: string | null;
  placements: PlacementType[];
  selections: Record<string, string>;
  onConfirm: () => void;
  onBack: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Built on DialogV2 (the bordered header/body/footer chrome) so it reads as a sibling of the
 * other configure-flow modals (LogsCard, ExposePortsCard, …) rather than a one-off.
 */
export const ReviewAndDeployModal: FC<Props> = ({ open, dseq, placements, selections, onConfirm, onBack, dependencies: d = DEPENDENCIES }) => {
  const { rows, pricedCount, totalCount } = d.useReviewRows({ dseq, placements, selections });
  /** Only deployable once every placement is selected and still has a live (priced) bid — a closed/stale bid leaves a row unpriced and would fail at create-lease. */
  const canConfirm = totalCount > 0 && rows.length === totalCount && pricedCount === totalCount;

  return (
    <DialogV2 open={open} onOpenChange={isOpen => (!isOpen ? onBack() : undefined)}>
      <DialogV2Content className="max-w-2xl">
        <DialogV2Header>
          <DialogV2Title>Review and deploy</DialogV2Title>
          <DialogV2Description>Review your provider selections for each placement before deploying.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="space-y-4">
          <ul className="divide-y">
            {rows.map((row, index) => (
              <li key={row.placementId} className="flex items-center gap-4 py-4 first:pt-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Placement</p>
                  <p className="truncate text-sm">{row.region ? `${row.placementName} · ${row.region}` : row.placementName}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Provider</p>
                  <p className="truncate text-sm">{row.providerName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                  {row.price ? (
                    <d.PricePerTimeUnit
                      denom={row.price.denom}
                      perBlockValue={udenomToDenom(row.price.amount, PRICE_DISPLAY_PRECISION)}
                      showAsHourly
                      abbreviated
                    />
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-lg border bg-muted p-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Total deployment cost</p>
              <p className="text-xs text-muted-foreground">
                {pricedCount} of {totalCount} {totalCount === 1 ? "placement" : "placements"} priced
              </p>
            </div>
            <TotalPrice rows={rows} PricePerTimeUnit={d.PricePerTimeUnit} />
          </div>
        </DialogV2Body>

        <DialogV2Footer>
          <Button variant="ghost" onClick={onBack}>
            Back to marketplace
          </Button>
          <Button onClick={onConfirm} className="gap-2" disabled={!canConfirm}>
            Confirm and deploy
            <Rocket className="h-4 w-4" />
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

/**
 * Sums the selected offers' per-block prices and renders the hourly USD total through the shared price
 * component. Assumes a single denom across placements (one deployment shares a deposit denom), so it labels
 * the sum with the first priced row's denom; mixed denoms are not expected in this flow.
 */
function TotalPrice({ rows, PricePerTimeUnit: Price }: { rows: ReviewRow[]; PricePerTimeUnit: FC<ComponentProps<typeof PricePerTimeUnit>> }) {
  const priced = rows.filter((r): r is ReviewRow & { price: { amount: string; denom: string } } => !!r.price);
  if (priced.length === 0) return <span className="text-2xl font-bold">—</span>;
  const denom = priced[0].price.denom;
  const perBlockTotal = priced.reduce((sum, r) => sum + udenomToDenom(r.price.amount, PRICE_DISPLAY_PRECISION), 0);
  return <Price denom={denom} perBlockValue={perBlockTotal} showAsHourly abbreviated className="text-2xl font-bold" />;
}
