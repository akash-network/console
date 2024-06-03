"use client";

import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { UrlService } from "@/lib/urlUtils";
import { AccessorColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { getSplitText } from "@/hooks/useShortText";
import { AKTAmount } from "@/components/AKTAmount";
import { FormattedRelativeTime } from "react-intl";
import { TransactionRowType } from "@/lib/zod/transactionRow";
import { TransactionTypeCell } from "./TransactionTypeCell";

export const columns: AccessorColumnDef<TransactionRowType>[] = [
  {
    accessorKey: "hash",
    enableSorting: false,
    enableHiding: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tx Hash" />,
    cell: ({ row }) => (
      <Link href={UrlService.transaction(row.getValue("hash"))} target="_blank">
        {getSplitText(row.getValue("hash"), 6, 6)}
      </Link>
    )
  },
  {
    accessorKey: "type",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => {
      return <TransactionTypeCell row={row} />;
    }
  },
  {
    accessorKey: "isSuccess",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created Height" />,
    cell: ({ row }) => (row.original.isSuccess ? "Success" : "Failed")
  },
  {
    id: "amount",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => {
      return row.original.messages[0].amount && <AKTAmount uakt={row.original.messages[0].amount} showAKTLabel />;
    },
    accessorFn: row => row.messages[0].amount
  },
  {
    id: "fee",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fee" />,
    cell: ({ row }) => <AKTAmount uakt={row.getValue("fee")} showAKTLabel />,
    accessorFn: row => row.fee
  },
  {
    id: "height",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Height" />,
    cell: ({ row }) => <Link href={UrlService.block(row.getValue("height"))}>{row.getValue("height")}</Link>,
    accessorFn: row => row.height
  },
  {
    id: "datetime",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">
        <FormattedRelativeTime
          value={(new Date(row.getValue("datetime")).getTime() - new Date().getTime()) / 1000}
          numeric="auto"
          unit="second"
          style="short"
          updateIntervalInSeconds={7}
        />
      </span>
    ),
    accessorFn: row => row.datetime
  }
];
