import type { Transaction } from "@src/billing/http-schemas/stripe.schema";

const mockTransactionsData: Transaction[] = [
  {
    id: "ch_1",
    amount: 1500,
    currency: "usd",
    status: "succeeded",
    created: 1738368000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "4242" } },
    receiptUrl: "https://stripe.com/receipt/ch_1",
    description: "Order #1001",
    metadata: { orderId: "1001" }
  },
  {
    id: "ch_2",
    amount: 2500,
    currency: "eur",
    status: "pending",
    created: 1740873600,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "4444" } },
    receiptUrl: "https://stripe.com/receipt/ch_2",
    description: "Order #1002",
    metadata: { orderId: "1002" }
  },
  {
    id: "ch_3",
    amount: 999,
    currency: "usd",
    status: "failed",
    created: 1743292800,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0005" } },
    receiptUrl: "https://stripe.com/receipt/ch_3",
    description: null,
    metadata: {}
  },
  {
    id: "ch_4",
    amount: 4200,
    currency: "gbp",
    status: "succeeded",
    created: 1745798400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "1111" } },
    receiptUrl: "https://stripe.com/receipt/ch_4",
    description: "Subscription May",
    metadata: { plan: "basic" }
  },
  {
    id: "ch_5",
    amount: 3200,
    currency: "eur",
    status: "succeeded",
    created: 1738627200,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "2222" } },
    receiptUrl: "https://stripe.com/receipt/ch_5",
    description: "Order #1005",
    metadata: { orderId: "1005" }
  },
  {
    id: "ch_6",
    amount: 5000,
    currency: "usd",
    status: "pending",
    created: 1741737600,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "3333" } },
    receiptUrl: "https://stripe.com/receipt/ch_6",
    description: "Order #1006",
    metadata: { orderId: "1006" }
  },
  {
    id: "ch_7",
    amount: 2750,
    currency: "usd",
    status: "succeeded",
    created: 1744156800,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0003" } },
    receiptUrl: "https://stripe.com/receipt/ch_7",
    description: "Gift purchase",
    metadata: { gift: "yes" }
  },
  {
    id: "ch_8",
    amount: 1800,
    currency: "eur",
    status: "failed",
    created: 1746662400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "3333" } },
    receiptUrl: "https://stripe.com/receipt/ch_8",
    description: "Order #1008",
    metadata: { orderId: "1008" }
  },
  {
    id: "ch_9",
    amount: 6100,
    currency: "gbp",
    status: "succeeded",
    created: 1747958400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "5555" } },
    receiptUrl: "https://stripe.com/receipt/ch_9",
    description: "Annual membership",
    metadata: { membership: "pro" }
  },
  {
    id: "ch_10",
    amount: 2300,
    currency: "usd",
    status: "succeeded",
    created: 1749168000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "6666" } },
    receiptUrl: "https://stripe.com/receipt/ch_10",
    description: "Order #1010",
    metadata: { orderId: "1010" }
  },
  {
    id: "ch_11",
    amount: 1500,
    currency: "eur",
    status: "pending",
    created: 1750377600,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0007" } },
    receiptUrl: "https://stripe.com/receipt/ch_11",
    description: "Order #1011",
    metadata: { orderId: "1011" }
  },
  {
    id: "ch_12",
    amount: 7800,
    currency: "usd",
    status: "succeeded",
    created: 1738800000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "7777" } },
    receiptUrl: "https://stripe.com/receipt/ch_12",
    description: "Order #1012",
    metadata: { orderId: "1012" }
  },
  {
    id: "ch_13",
    amount: 3400,
    currency: "gbp",
    status: "failed",
    created: 1741910400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "8888" } },
    receiptUrl: "https://stripe.com/receipt/ch_13",
    description: "Order #1013",
    metadata: { orderId: "1013" }
  },
  {
    id: "ch_14",
    amount: 9200,
    currency: "eur",
    status: "succeeded",
    created: 1744329600,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "9999" } },
    receiptUrl: "https://stripe.com/receipt/ch_14",
    description: "Bulk purchase",
    metadata: { bulk: "true" }
  },
  {
    id: "ch_15",
    amount: 1200,
    currency: "usd",
    status: "pending",
    created: 1746835200,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0002" } },
    receiptUrl: "https://stripe.com/receipt/ch_15",
    description: "Order #1015",
    metadata: { orderId: "1015" }
  },
  {
    id: "ch_16",
    amount: 6600,
    currency: "eur",
    status: "succeeded",
    created: 1748131200,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "1112" } },
    receiptUrl: "https://stripe.com/receipt/ch_16",
    description: null,
    metadata: {}
  },
  {
    id: "ch_17",
    amount: 4300,
    currency: "gbp",
    status: "succeeded",
    created: 1749340800,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "2223" } },
    receiptUrl: "https://stripe.com/receipt/ch_17",
    description: "Gift voucher",
    metadata: { voucher: "yes" }
  },
  {
    id: "ch_18",
    amount: 2950,
    currency: "usd",
    status: "failed",
    created: 1750550400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0004" } },
    receiptUrl: "https://stripe.com/receipt/ch_18",
    description: "Order #1018",
    metadata: { orderId: "1018" }
  },
  {
    id: "ch_19",
    amount: 5100,
    currency: "eur",
    status: "succeeded",
    created: 1738972800,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "3334" } },
    receiptUrl: "https://stripe.com/receipt/ch_19",
    description: "Subscription Jun",
    metadata: { plan: "premium" }
  },
  {
    id: "ch_20",
    amount: 3800,
    currency: "gbp",
    status: "pending",
    created: 1742083200,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "4445" } },
    receiptUrl: "https://stripe.com/receipt/ch_20",
    description: "Order #1020",
    metadata: { orderId: "1020" }
  },
  {
    id: "ch_21",
    amount: 2700,
    currency: "usd",
    status: "succeeded",
    created: 1744502400,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0006" } },
    receiptUrl: "https://stripe.com/receipt/ch_21",
    description: null,
    metadata: {}
  },
  {
    id: "ch_22",
    amount: 8450,
    currency: "eur",
    status: "succeeded",
    created: 1747008000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "5556" } },
    receiptUrl: "https://stripe.com/receipt/ch_22",
    description: "Order #1022",
    metadata: { orderId: "1022" }
  },
  {
    id: "ch_23",
    amount: 2300,
    currency: "gbp",
    status: "failed",
    created: 1748304000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "mastercard", last4: "6667" } },
    receiptUrl: "https://stripe.com/receipt/ch_23",
    description: "Order #1023",
    metadata: { orderId: "1023" }
  },
  {
    id: "ch_24",
    amount: 4700,
    currency: "usd",
    status: "succeeded",
    created: 1748304000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "visa", last4: "7778" } },
    receiptUrl: "https://stripe.com/receipt/ch_24",
    description: "Order #1024",
    metadata: { orderId: "1024" }
  },
  {
    id: "ch_25",
    amount: 5500,
    currency: "eur",
    status: "pending",
    created: 1719792000,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    paymentMethod: { type: "card", card: { brand: "amex", last4: "0009" } },
    receiptUrl: "https://stripe.com/receipt/ch_25",
    description: "Order #1025",
    metadata: { orderId: "1025" }
  }
];

export default function getMockTransactions(
  options: {
    limit?: number;
    startingAfter?: string;
    endingBefore?: string;
    created?: { gt?: number; lt?: number };
  } = {}
) {
  const { limit = 100, startingAfter, endingBefore, created } = options;

  // Filter by created timestamp if provided
  let filteredTransactions = mockTransactionsData;
  if (created) {
    filteredTransactions = mockTransactionsData.filter(tx => {
      let matches = true;
      if (created.gt !== undefined) {
        matches = matches && tx.created > created.gt;
      }
      if (created.lt !== undefined) {
        matches = matches && tx.created < created.lt;
      }
      return matches;
    });
  }

  // Sort by created timestamp (newest first, which is typical for transaction lists)
  filteredTransactions.sort((a, b) => b.created - a.created);

  let startIndex = 0;
  let endIndex = filteredTransactions.length;

  // Handle cursor-based pagination
  if (startingAfter) {
    const startIndex_ = filteredTransactions.findIndex(tx => tx.id === startingAfter);
    if (startIndex_ !== -1) {
      startIndex = startIndex_ + 1; // Start after the cursor
    }
  }

  if (endingBefore) {
    const endIndex_ = filteredTransactions.findIndex(tx => tx.id === endingBefore);
    if (endIndex_ !== -1) {
      endIndex = endIndex_; // End before the cursor
    }
  }

  // Apply pagination slice
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex).slice(0, limit);

  // Determine if there are more pages
  const hasMoreAfter = startIndex + paginatedTransactions.length < filteredTransactions.length;
  const hasMoreBefore = startIndex > 0;

  // Calculate pagination cursors
  const nextPage = hasMoreAfter && paginatedTransactions.length > 0 ? paginatedTransactions[paginatedTransactions.length - 1].id : null;

  const prevPage = hasMoreBefore && paginatedTransactions.length > 0 ? paginatedTransactions[0].id : null;

  // Transform transactions to match your expected format
  const transactions = paginatedTransactions.map(tx => ({
    id: tx.id,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    created: tx.created,
    paymentMethod: tx.paymentMethod || null,
    receiptUrl: tx.receiptUrl || null,
    description: tx.description || null,
    metadata: tx.metadata || {}
  }));

  return {
    transactions,
    hasMore: hasMoreAfter,
    nextPage,
    prevPage,
    totalCount: filteredTransactions.length
  };
}
