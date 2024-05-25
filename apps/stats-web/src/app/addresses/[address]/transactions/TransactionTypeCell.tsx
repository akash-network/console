import { Badge } from "@/components/ui/badge";
import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import { TransactionRowType } from "@/lib/zod/transactionRow";
import { Row } from "@tanstack/react-table";

export const TransactionTypeCell = ({
  row
}: React.PropsWithChildren<{
  row: Row<TransactionRowType>;
}>) => {
  const friendlyMessage = useFriendlyMessageType(row.original.messages[0].type);
  const firstMessageType = row.original.messages[0].isReceiver ? "Receive" : friendlyMessage;

  return (
    <>
      <Badge className="h-4 max-w-[120px] bg-primary">
        <span className="truncate">{firstMessageType}</span>
      </Badge>
      <span className="text-xs">{row.original.messages.length > 1 ? " +" + (row.original.messages.length - 1) : ""}</span>
    </>
  );
};
