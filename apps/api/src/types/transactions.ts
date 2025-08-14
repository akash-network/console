export type ApiTransactionResponse = {
  height: number | string;
  datetime: Date;
  hash: string;
  multisigThreshold?: number;
  signers?: string[];
  isSuccess: boolean;
  error: string | null;
  gasUsed: number;
  gasWanted: number;
  fee: number;
  memo: string;
  messages: {
    id: string;
    type: string;
    data: unknown;
    relatedDeploymentId: string | null;
  }[];
};

export type TransactionCsvRow = {
  id: string;
  date: string;
  amount: string;
  currency: string;
  status: string;
  paymentMethodType: string;
  cardBrand: string;
  cardLast4: string;
  description: string;
  receiptUrl: string;
};
