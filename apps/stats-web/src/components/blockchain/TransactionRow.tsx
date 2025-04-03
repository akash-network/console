"use client";
import { FormattedRelativeTime } from "react-intl";
import { Badge, TableCell, TableRow } from "@akashnetwork/ui/components";
import Link from "next/link";

import { AKTAmount } from "@/components/AKTAmount";
import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import { getSplitText } from "@/hooks/useShortText";
import { UrlService } from "@/lib/urlUtils";
import type { BlockTransaction } from "@/types";

type Props = {
  errors?: string;
  isSimple?: boolean;
  blockHeight: number;
  transaction: BlockTransaction;
};

export const TransactionRow: React.FunctionComponent<Props> = ({ transaction, blockHeight, isSimple }) => {
  const txHash = getSplitText(transaction.hash, 6, 6);
  const friendlyMessage = useFriendlyMessageType(transaction.messages[0].type);
  const firstMessageType = transaction.messages[0].isReceiver ? "Receive" : friendlyMessage;

  return (
    <TableRow>
      <TableCell>
        <Link href={UrlService.transaction(transaction.hash)} target="_blank">
          {txHash}
        </Link>
      </TableCell>
      <TableCell align="center">
        <Badge className="h-4 max-w-[120px] bg-primary">
          <span className="truncate">{firstMessageType}</span>
        </Badge>
        <span className="text-xs">{transaction.messages.length > 1 ? " +" + (transaction.messages.length - 1) : ""}</span>
      </TableCell>
      {!isSimple && (
        <>
          <TableCell align="center">{transaction.isSuccess ? "Success" : "Failed"}</TableCell>
          <TableCell align="center">{transaction.messages[0].amount && <AKTAmount uakt={transaction.messages[0].amount} showAKTLabel />}</TableCell>
          <TableCell align="center">
            <AKTAmount uakt={transaction.fee} showAKTLabel />
          </TableCell>
        </>
      )}
      <TableCell align="center">
        <Link href={UrlService.block(blockHeight)}>{blockHeight}</Link>
      </TableCell>
      <TableCell align="center">
        <span className="whitespace-nowrap text-sm">
          <FormattedRelativeTime
            value={(new Date(transaction.datetime).getTime() - new Date().getTime()) / 1000}
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
