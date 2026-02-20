import { FormattedTime } from "react-intl";
import { TableCell, TableRow } from "@akashnetwork/ui/components";

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
        <a href={UrlService.transaction(event.txHash)} target="_blank" rel="noopener noreferrer">
          {getSplitText(event.txHash, 6, 6)}
        </a>
      </TableCell>
      <TableCell align="center">{useFriendlyMessageType(event.type)}</TableCell>
      <TableCell align="center">
        <FormattedTime value={event.date} day="2-digit" month="2-digit" year="numeric" />
      </TableCell>
    </TableRow>
  );
};
