"use client";
import { FormattedRelativeTime } from "react-intl";
import { TableCell, TableRow } from "@akashnetwork/ui/components";
import Link from "next/link";

import { getShortText } from "@/hooks/useShortText";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import type { Block } from "@/types";

type Props = {
  errors?: string;
  block: Block;
};

export const BlockRow: React.FunctionComponent<Props> = ({ block }) => {
  return (
    <TableRow>
      <TableCell align="center">
        <Link href={UrlService.block(block.height)}>{block.height}</Link>
      </TableCell>
      <TableCell align="center">
        <Link href={UrlService.validator(block.proposer.operatorAddress)}>
          <span className="max-[150px] line-clamp-1">{getShortText(block.proposer.moniker, 20)}</span>
        </Link>
      </TableCell>
      <TableCell
        align="center"
        className={cn({ "text-red-500": block.transactionCount > 0, "font-bold": block.transactionCount > 0, "opacity-30": block.transactionCount === 0 })}
      >
        {block.transactionCount}
      </TableCell>
      <TableCell align="center" className="whitespace-nowrap">
        <span className="text-sm">
          <FormattedRelativeTime
            value={(new Date(block.datetime).getTime() - new Date().getTime()) / 1000}
            numeric="auto"
            unit="second"
            style="short"
            updateIntervalInSeconds={7}
          />
        </span>
      </TableCell>
    </TableRow>
  );
};
