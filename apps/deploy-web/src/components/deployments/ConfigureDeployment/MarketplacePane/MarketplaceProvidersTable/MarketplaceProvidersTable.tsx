import type { FC } from "react";
import { useMemo, useState } from "react";
import { Badge, Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { Column, Row, SortingState } from "@tanstack/react-table";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { ShortenedValue } from "@src/components/shared/ShortenedValue";
import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { providerDisplayName } from "@src/utils/providerUtils";
import type { ProviderUptime } from "./ProviderUptimeCell/deriveProviderUptime";
import { useProvidersUptime } from "./ProviderUptimeCell/deriveProviderUptime";
import { ProviderUptimeCell } from "./ProviderUptimeCell/ProviderUptimeCell";

const columnHelper = createColumnHelper<PlacementOffer>();

/** Shown when a provider has no region attribute, and as the cost placeholder for a row with no price. */
const NO_REGION = "—";

/** Fallback uptime for a provider missing from the derived map; treated as fully healthy. */
const HEALTHY_UPTIME: ProviderUptime = { percent: 1, buckets: [] };

interface Props {
  providers: PlacementOffer[];
  isLoading?: boolean;
  isSearchActive?: boolean;
  onClearSearch?: () => void;
  selectedBidId?: string;
  onSelect?: (bidId: string) => void;
  /** When true the cost column renders an hourly rate (GPU specs); otherwise a monthly rate, so inexpensive CPU-only deployments don't round to `$0.00/hr`. */
  showCostAsHourly?: boolean;
}

export const MarketplaceProvidersTable: FC<Props> = ({ providers, isLoading, isSearchActive, onClearSearch, selectedBidId, onSelect, showCostAsHourly = false }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const uptimeByOwner = useProvidersUptime(providers);
  /** The status column and the "didn't bid" split appear once real bid outcomes exist; before that the marketplace lists screened candidates as `searching`. */
  const isMerged = providers.some(provider => provider.offerState !== "searching");
  /** Cost only makes sense once bids arrive: a submitted bid is priced and a closed/expired one keeps its last price, but a screened-only candidate has none. */
  const showCost = providers.some(provider => !!provider.price);
  const columns = useMemo(
    () => buildColumns(uptimeByOwner, { selectedBidId, onSelect, showCost, showStatus: isMerged, showCostAsHourly }),
    [uptimeByOwner, selectedBidId, onSelect, showCost, isMerged, showCostAsHourly]
  );

  const table = useReactTable({
    data: providers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="large" />
      </div>
    );
  }

  if (providers.length === 0) {
    if (isSearchActive) {
      return (
        <div className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm text-muted-foreground">No providers match your search.</p>
          {onClearSearch && (
            <Button variant="outline" size="sm" onClick={onClearSearch}>
              Clear search
            </Button>
          )}
        </div>
      );
    }
    return <p className="p-4 text-sm text-muted-foreground">No providers found.</p>;
  }

  const sortedRows = table.getRowModel().rows;
  /**
   * Sorting applies across the whole table, but screened providers that never bid are pinned into a group at
   * the bottom: partitioning the already-sorted rows keeps the active column sort inside each group. Bidders
   * and closed/expired bids stay together up top (they did bid); only never-bid providers drop below.
   */
  const biddableRows = sortedRows.filter(row => !isPinnedBelow(row.original.offerState));
  const noBidRows = sortedRows.filter(row => isPinnedBelow(row.original.offerState));
  const columnCount = table.getVisibleFlatColumns().length;

  return (
    <div className="overflow-hidden rounded-[14px] border shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="h-10 pl-4 pr-2">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {biddableRows.map(row => (
            <OfferRow key={row.id} row={row} />
          ))}
          {noBidRows.length > 0 && biddableRows.length > 0 && (
            <TableRow key="didnt-bid-divider" className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="h-8 bg-muted/30 py-1 pl-4 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                didn&apos;t bid
              </TableCell>
            </TableRow>
          )}
          {noBidRows.map(row => (
            <OfferRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/** Only never-bid providers are pinned into the bottom group; a closed/expired bid stays up with the bidders (it did bid) — just muted and unselectable. */
function isPinnedBelow(state: PlacementOffer["offerState"]): boolean {
  return state === "unavailable";
}

/** Neither a closed/expired bid nor a never-bid provider can be picked, so both read muted with a status badge in place of a Select button. */
function isNonSelectable(state: PlacementOffer["offerState"]): boolean {
  return state === "closed" || state === "unavailable";
}

/** One marketplace row. Selectable rows read normally; closed/expired and never-bid rows are muted (which also greys their price). Cell content (price vs "—", Select vs status badge) comes from the column defs. */
function OfferRow({ row }: { row: Row<PlacementOffer> }) {
  const isDisabled = isNonSelectable(row.original.offerState);
  return (
    <TableRow className={cn("h-[52px]", isDisabled && "text-muted-foreground hover:bg-transparent")}>
      {row.getVisibleCells().map(cell => (
        <TableCell key={cell.id} className={cn("py-2 pl-4 pr-2 text-sm", !isDisabled && "font-medium text-foreground")}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

/** Design-system column header: an uppercase mono label that toggles sort on click. */
function SortableHeader({ column, title }: { column: Column<PlacementOffer, unknown>; title: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="group flex items-center gap-1 font-mono text-sm font-normal uppercase text-muted-foreground"
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </button>
  );
}

/** Builds the columns, closing over the per-provider uptime derived once in the component. Every column is an accessor so it sorts; the trailing status column is display-only. */
function buildColumns(
  uptimeByOwner: Map<string, ProviderUptime>,
  selection: { selectedBidId?: string; onSelect?: (bidId: string) => void; showCost: boolean; showStatus: boolean; showCostAsHourly: boolean }
) {
  return [
    columnHelper.accessor(providerDisplayName, {
      id: "hostUri",
      header: ({ column }) => <SortableHeader column={column} title="Provider" />,
      cell: info => <ShortenedValue value={info.getValue()} maxLength={40} headLength={14} />
    }),
    columnHelper.accessor("location", {
      header: ({ column }) => <SortableHeader column={column} title="Region" />,
      cell: info => info.getValue() ?? NO_REGION
    }),
    columnHelper.accessor(provider => (uptimeByOwner.get(provider.owner) ?? HEALTHY_UPTIME).percent, {
      id: "uptime",
      header: ({ column }) => <SortableHeader column={column} title="Uptime (7D)" />,
      cell: info => <ProviderUptimeCell uptime={uptimeByOwner.get(info.row.original.owner) ?? HEALTHY_UPTIME} />
    }),
    ...(selection.showCost
      ? [
          columnHelper.accessor(provider => (provider.price ? Number(provider.price.amount) : 0), {
            id: "cost",
            header: ({ column }) => <SortableHeader column={column} title="Cost" />,
            cell: ({ row }) => {
              const { price } = row.original;
              if (!price) return <span className="text-muted-foreground">{NO_REGION}</span>;
              return <PricePerTimeUnit denom={price.denom} perBlockValue={udenomToDenom(price.amount, PRICE_DISPLAY_PRECISION)} showAsHourly={selection.showCostAsHourly} abbreviated />;
            }
          })
        ]
      : []),
    ...(selection.showStatus
      ? [
          columnHelper.display({
            id: "status",
            header: () => null,
            cell: ({ row }) => {
              const offer = row.original;
              if (offer.offerState === "closed") return <Badge variant="secondary">Expired</Badge>;
              if (offer.offerState === "unavailable") return <Badge variant="outline">No bid</Badge>;
              if (offer.offerState !== "submitted" || !offer.bidId) return null;
              const isSelected = offer.bidId === selection.selectedBidId;
              return (
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  disabled={isSelected}
                  aria-label={isSelected ? `Selected ${providerDisplayName(offer)}` : `Select ${providerDisplayName(offer)}`}
                  onClick={() => selection.onSelect?.(offer.bidId!)}
                >
                  {isSelected ? "Selected" : "Select"}
                </Button>
              );
            }
          })
        ]
      : [])
  ];
}
