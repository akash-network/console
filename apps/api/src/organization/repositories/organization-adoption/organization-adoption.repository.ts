import { and, eq, isNull } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

export interface AdoptUserRowsInput {
  userId: string;
  /** The Auth0 subject, which is how templates name their owner. */
  externalUserId: string | null;
  organizationId: string;
  projectId: string;
}

export interface AdoptedRowCounts {
  userWallets: number;
  walletSettings: number;
  paymentMethods: number;
  stripeTransactions: number;
  deploymentSettings: number;
  apiKeys: number;
  templates: number;
}

/** Every statement only touches rows that have no organization yet, which is what lets the whole pass be re-run. */
@singleton()
export class OrganizationAdoptionRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("UserWallets") private readonly userWallets: ApiPgTables["UserWallets"],
    @InjectPgTable("WalletSetting") private readonly walletSettings: ApiPgTables["WalletSetting"],
    @InjectPgTable("PaymentMethods") private readonly paymentMethods: ApiPgTables["PaymentMethods"],
    @InjectPgTable("StripeTransactions") private readonly stripeTransactions: ApiPgTables["StripeTransactions"],
    @InjectPgTable("DeploymentSettings") private readonly deploymentSettings: ApiPgTables["DeploymentSettings"],
    @InjectPgTable("ApiKeys") private readonly apiKeys: ApiPgTables["ApiKeys"],
    @InjectPgTable("Templates") private readonly templates: ApiPgTables["Templates"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async adoptUserRows({ userId, externalUserId, organizationId, projectId }: AdoptUserRowsInput): Promise<AdoptedRowCounts> {
    const { userWallets, walletSettings, paymentMethods, stripeTransactions, deploymentSettings, apiKeys, templates } = this;

    return {
      userWallets: (
        await this.#cursor
          .update(userWallets)
          .set({ organizationId })
          .where(and(eq(userWallets.userId, userId), isNull(userWallets.organizationId)))
      ).count,
      walletSettings: (
        await this.#cursor
          .update(walletSettings)
          .set({ organizationId })
          .where(and(eq(walletSettings.userId, userId), isNull(walletSettings.organizationId)))
      ).count,
      paymentMethods: (
        await this.#cursor
          .update(paymentMethods)
          .set({ organizationId })
          .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.organizationId)))
      ).count,
      stripeTransactions: (
        await this.#cursor
          .update(stripeTransactions)
          .set({ organizationId })
          .where(and(eq(stripeTransactions.userId, userId), isNull(stripeTransactions.organizationId)))
      ).count,
      deploymentSettings: (
        await this.#cursor
          .update(deploymentSettings)
          .set({ organizationId, projectId })
          .where(and(eq(deploymentSettings.userId, userId), isNull(deploymentSettings.organizationId)))
      ).count,
      apiKeys: (
        await this.#cursor
          .update(apiKeys)
          .set({ organizationId, projectId })
          .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.organizationId)))
      ).count,
      templates: externalUserId
        ? (
            await this.#cursor
              .update(templates)
              .set({ organizationId, projectId })
              .where(and(eq(templates.userId, externalUserId), isNull(templates.organizationId)))
          ).count
        : 0
    };
  }
}
