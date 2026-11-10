import { EMPTY_VALUE } from "@/lib/statsFormat/statsFormat";
import type { Block, TransactionDetail } from "@/types";

export const TRANSACTION_GROUPS = [
  { key: "all", label: "All", pattern: /.*/ },
  { key: "market", label: "Market", pattern: /Bid|Lease|Provider/ },
  { key: "deployments", label: "Deployments", pattern: /Deployment|Group|AccountDeposit/ },
  { key: "contracts", label: "Contracts", pattern: /Contract|StoreCode/ },
  { key: "staking", label: "Staking", pattern: /delegat|validator|reward/i },
  { key: "transfers", label: "Transfers", pattern: /^(Send|MultiSend|Transfer)$/ }
] as const;

export type TransactionGroupKey = (typeof TRANSACTION_GROUPS)[number]["key"];

export function messageTypeName(type: string) {
  return (type.split(".").pop() ?? "").replace(/^Msg/, "");
}

export function firstMessageLabel(transaction: Pick<TransactionDetail, "messages">) {
  const [firstMessage] = transaction.messages;

  if (!firstMessage) return EMPTY_VALUE;
  if (firstMessage.isReceiver) return "Receive";

  return messageTypeName(firstMessage.type) || EMPTY_VALUE;
}

export function filterTransactionsByGroup<T extends Pick<TransactionDetail, "messages">>(transactions: T[], groupKey: TransactionGroupKey) {
  const group = TRANSACTION_GROUPS.find(({ key }) => key === groupKey) ?? TRANSACTION_GROUPS[0];

  return transactions.filter(transaction => transaction.messages.some(message => group.pattern.test(messageTypeName(message.type))));
}

export function averageBlockTimeSeconds(blocks: Pick<Block, "datetime">[]) {
  if (blocks.length < 2) {
    return undefined;
  }

  const newest = new Date(blocks[0].datetime).getTime();
  const oldest = new Date(blocks[blocks.length - 1].datetime).getTime();

  return Math.abs(newest - oldest) / (blocks.length - 1) / 1000;
}

export function initialsOf(name: string) {
  return (
    name
      .split(/[\s.]+/)
      .filter(word => /^[a-z0-9]/i.test(word))
      .map(word => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
