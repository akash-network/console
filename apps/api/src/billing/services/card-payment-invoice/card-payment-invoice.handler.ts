import { singleton } from "tsyringe";

import { IssueCardPaymentInvoiceCommand } from "@src/billing/commands/issue-card-payment-invoice.command";
import type { JobHandler, JobPayload, JobPermissions } from "@src/core";
import { CardPaymentInvoiceService } from "./card-payment-invoice.service";

@singleton()
export class CardPaymentInvoiceHandler implements JobHandler<IssueCardPaymentInvoiceCommand> {
  public readonly accepts = IssueCardPaymentInvoiceCommand;

  public readonly concurrency = 2;

  constructor(private readonly cardPaymentInvoiceService: CardPaymentInvoiceService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<IssueCardPaymentInvoiceCommand>): Promise<void> {
    await this.cardPaymentInvoiceService.issueInvoiceForTransaction(payload.transactionId);
  }
}
