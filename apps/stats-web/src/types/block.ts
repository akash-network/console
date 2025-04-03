import type { TransactionMessage } from "./transaction";
import type { IValidatorAddess } from "./validator";

export interface Block {
  datetime: string;
  height: number;
  proposer: IValidatorAddess;
  transactionCount: number;
}

export interface BlockDetail {
  height: number;
  proposer: IValidatorAddess;
  datetime: string;
  hash: string;
  gasUsed: number;
  gasWanted: number;
  transactions: BlockTransaction[];
}

export interface BlockTransaction {
  hash: string;
  isSuccess: boolean;
  error: string;
  fee: number;
  datetime: string;
  messages: TransactionMessage[];
}
