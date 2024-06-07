import { FormattedTime } from "react-intl";
import Link from "next/link";

import { TableCell, TableRow } from "@/components/ui/table";
import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import { getSplitText } from "@/hooks/useShortText";
import { UrlService } from "@/lib/urlUtils";

export const EventRow = ({
  event
}: React.PropsWithChildren<{
  event: {
    txHash: string;
    date: string;
    type: string;
  };
}>) => {
  return (
    <TableRow>
      <TableCell>
        <Link href={UrlService.transaction(event.txHash)} target="_blank">
          {getSplitText(event.txHash, 6, 6)}
        </Link>
      </TableCell>
      <TableCell align="center">{useFriendlyMessageType(event.type)}</TableCell>
      <TableCell align="center">
        <FormattedTime value={event.date} day="2-digit" month="2-digit" year="numeric" />
      </TableCell>
    </TableRow>
  );
};
