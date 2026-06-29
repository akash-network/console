import type { FC } from "react";
import { useMemo, useState } from "react";
import { Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import type { Column, SortingState } from "@tanstack/react-table";
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

/** Shown when a provider has no region attribute. */
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
}

export const MarketplaceProvidersTable: FC<Props> = ({ providers, isLoading, isSearchActive, onClearSearch, selectedBidId, onSelect }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const uptimeByOwner = useProvidersUptime(providers);
  /** Cost only makes sense once firm bids arrive; until then the marketplace lists screened candidates with no price. */
  const hasBids = providers.some(provider => provider.offerState === "submitted");
  /** The Select column is only useful when a visible offer can actually be picked; otherwise it's an empty trailing column. */
  const hasSelectableOffers = providers.some(provider => provider.offerState === "submitted" && !!provider.bidId);
  const columns = useMemo(
    () => buildColumns(uptimeByOwner, { selectedBidId, onSelect, showCost: hasBids, showSelect: hasSelectableOffers }),
    [uptimeByOwner, selectedBidId, onSelect, hasBids, hasSelectableOffers]
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
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id} className="h-[52px]">
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id} className="py-2 pl-4 pr-2 text-sm font-medium text-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

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

/** Builds the table columns, closing over the per-provider uptime derived once in the component. */
function buildColumns(
  uptimeByOwner: Map<string, ProviderUptime>,
  selection: { selectedBidId?: string; onSelect?: (bidId: string) => void; showCost: boolean; showSelect: boolean }
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
          columnHelper.display({
            id: "cost",
            header: () => <span className="font-mono text-sm font-normal uppercase text-muted-foreground">Cost</span>,
            cell: ({ row }) => {
              const { price } = row.original;
              if (!price) return <span className="text-muted-foreground">—</span>;
              return <PricePerTimeUnit denom={price.denom} perBlockValue={udenomToDenom(price.amount, PRICE_DISPLAY_PRECISION)} showAsHourly abbreviated />;
            }
          })
        ]
      : []),
    ...(selection.showSelect
      ? [
          columnHelper.display({
            id: "select",
            header: () => null,
            cell: ({ row }) => {
              const offer = row.original;
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
