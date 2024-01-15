export interface TransactionDetail {
  height: number;
  datetime: string;
  hash: string;
  isSuccess: boolean;
  error: string;
  gasUsed: number;
  gasWanted: number;
  fee: number;
  memo: string;
  multisigThreshold: number;
  signers: string[];
  messages: TransactionMessage[];
}

export interface TransactionMessage {
  id: string;
  type: string;
  data?: any;
  isReceiver?: boolean;
  amount?: number;
}
