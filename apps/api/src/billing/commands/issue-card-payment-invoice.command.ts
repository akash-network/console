import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class IssueCardPaymentInvoiceCommand implements Job {
  static readonly [JOB_NAME] = "IssueCardPaymentInvoiceCommand";

  public readonly name = IssueCardPaymentInvoiceCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      transactionId: string;
    }
  ) {}
}
