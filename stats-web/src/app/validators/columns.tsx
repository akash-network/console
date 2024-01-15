"use client";

import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { UrlService } from "@/lib/urlUtils";
import { AccessorColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { udenomToDenom } from "@/lib/mathHelpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "iconoir-react";
import { getShortText } from "@/hooks/useShortText";
import { FormattedNumber } from "react-intl";
import { AKTLabel } from "@/components/AKTLabel";

export const validatorRowSchema = z.object({
  rank: z.number(),
  moniker: z.string(),
  identity: z.string(),
  operatorAddress: z.string(),
  keybaseAvatarUrl: z.optional(z.string()),
  commission: z.number(),
  votingPower: z.number(),
  votingPowerRatio: z.number()
});

export type ValidatorRowType = z.infer<typeof validatorRowSchema>;

export const columns: AccessorColumnDef<ValidatorRowType>[] = [
  {
    accessorKey: "rank",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rank" />,
    cell: ({ row }) => <Badge variant={(row.getValue("rank") as number) > 10 ? "secondary" : "default"}>{row.getValue("rank")}</Badge>,
    enableSorting: true,
    enableHiding: false,
    size: 80
  },
  {
    accessorKey: "moniker",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Validator" />,
    cell: ({ row }) => (
      <Link href={UrlService.validator(row.original.operatorAddress)} className="inline-flex items-center">
        <Avatar className="h-[26px] w-[26px]">
          <AvatarImage src={row.original.keybaseAvatarUrl} alt={row.original.moniker} />
          <AvatarFallback>
            <User />
          </AvatarFallback>
        </Avatar>

        <span className="ml-4">{getShortText(row.original.moniker, 20)}</span>
      </Link>
    ),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "votingPower",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Voting Power" />,
    cell: ({ row }) => (
      <div className="inline-flex items-center">
        <FormattedNumber value={udenomToDenom(row.getValue("votingPower"))} maximumFractionDigits={0} />
        &nbsp;
        <AKTLabel />
        &nbsp;(
        <FormattedNumber style="percent" value={row.original.votingPowerRatio} minimumFractionDigits={2} />)
      </div>
    ),
    enableSorting: true,
    enableHiding: false
  },
  {
    accessorKey: "commission",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Commission" />,
    cell: ({ row }) => <FormattedNumber style="percent" value={row.getValue("commission")} minimumFractionDigits={2} />,
    enableSorting: true,
    enableHiding: false
  }
];
