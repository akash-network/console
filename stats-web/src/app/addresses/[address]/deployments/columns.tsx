"use client";

import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { UrlService } from "@/lib/urlUtils";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

// import { Badge } from "@/registry/new-york/ui/badge";
// import { Checkbox } from "@/registry/new-york/ui/checkbox";

// import { labels, priorities, statuses } from "../data/data";
// import { Task } from "../data/schema";
// import { DataTableColumnHeader } from "./data-table-column-header";
// import { DataTableRowActions } from "./data-table-row-actions";

import { z } from "zod";
import { getStatusColor, statuses } from "./data";
import { Badge } from "@/components/ui/badge";
import { LeaseSpecDetail } from "@/components/LeaseSpecDetail";
import { roundDecimal } from "@/lib/mathHelpers";
import { bytesToShrink } from "@/lib/unitUtils";
import { cn } from "@/lib/utils";

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const transactionRowSchema = z.object({
  // id: z.string(),
  // title: z.string(),
  // status: z.string(),
  // label: z.string(),
  // priority: z.string(),
  dseq: z.string(),
  owner: z.string(),
  status: z.string(),
  createdHeight: z.number(),
  cpuUnits: z.number(),
  gpuUnits: z.number(),
  memoryQuantity: z.number(),
  storageQuantity: z.number()
});
export type TransactionRowType = z.infer<typeof transactionRowSchema>;

export const columns: ColumnDef<TransactionRowType>[] = [
  {
    accessorKey: "dseq",
    header: ({ column }) => <DataTableColumnHeader column={column} title="DSEQ" />,
    cell: ({ row }) => (
      <Link href={UrlService.publicDeploymentDetails(row.original.owner, row.getValue("dseq"))} target="_blank">
        {row.getValue("dseq")}
      </Link>
    ),
    enableSorting: true,
    enableHiding: false
  },
  {
    accessorKey: "status",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = statuses.find(status => status.value === row.getValue("status"));

      if (!status) {
        return null;
      }

      return (
        <Badge
          className={cn("h-4 max-w-[120px]", { ["bg-red-400"]: row.getValue("status") === "active", ["bg-green-600"]: row.getValue("status") === "active" })}
          variant="default"
        >
          {row.getValue("status")}
        </Badge>
      );
    }
  },
  {
    accessorKey: "createdHeight",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created Height" />,
    cell: ({ row }) => {
      return (
        <Link href={UrlService.block(row.getValue("createdHeight"))} target="_blank">
          {row.getValue("createdHeight")}
        </Link>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    }
  },
  {
    id: "specs",
    // accessorFn: row => {
    //   return {
    //     ...row
    //   };
    // },
    enableSorting: false,
    enableGlobalFilter: false,
    enableColumnFilter: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Specs" />,
    cell: ({ row }) => {
      const _ram = bytesToShrink(row.original.memoryQuantity);
      const _storage = bytesToShrink(row.original.storageQuantity);

      return (
        <div>
          <LeaseSpecDetail
            className="min-w[120px] mr-4 inline-flex"
            // sx={{ display: "inline-flex", minWidth: "120px", marginRight: 1 }}
            iconSize="small"
            type="cpu"
            value={row.original.cpuUnits / 1_000}
          />
          {!!row.original.gpuUnits && <LeaseSpecDetail className="min-w[120px] mr-4 inline-flex" iconSize="small" type="gpu" value={row.original.gpuUnits} />}
          <LeaseSpecDetail className="min-w[120px] mr-4 inline-flex" iconSize="small" type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
          <LeaseSpecDetail
            className="min-w[120px] mr-4 inline-flex"
            iconSize="small"
            type="storage"
            value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`}
          />
        </div>
      );
    }
  }
];
