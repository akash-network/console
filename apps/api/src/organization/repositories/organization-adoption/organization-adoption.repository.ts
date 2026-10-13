import { and, eq, isNull, or, sql } from "drizzle-orm";
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

export const ADOPTABLE_TABLES = [
  "userWallets",
  "walletSettings",
  "paymentMethods",
  "stripeTransactions",
  "deploymentSettings",
  "apiKeys",
  "templates"
] as const;

export type AdoptableTable = (typeof ADOPTABLE_TABLES)[number];

export type AdoptedRowCounts = Record<AdoptableTable, number>;

/** Rows with no organization yet, or already in this organization but in no project, which is what lets the whole pass be re-run. */
function unfiled(table: ApiPgTables["DeploymentSettings"] | ApiPgTables["Templates"], organizationId: string) {
  return or(isNull(table.organizationId), and(eq(table.organizationId, organizationId), isNull(table.projectId)));
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

  async adoptRows(table: AdoptableTable, { userId, externalUserId, organizationId, projectId }: AdoptUserRowsInput): Promise<number> {
    const { userWallets, walletSettings, paymentMethods, stripeTransactions, deploymentSettings, apiKeys, templates } = this;

    switch (table) {
      case "userWallets":
        return (
          await this.#cursor
            .update(userWallets)
            .set({ organizationId, createdByUserId: sql`coalesce(${userWallets.createdByUserId}, ${userWallets.userId})` })
            .where(and(eq(userWallets.userId, userId), isNull(userWallets.organizationId)))
        ).count;
      case "walletSettings":
        return (
          await this.#cursor
            .update(walletSettings)
            .set({ organizationId })
            .where(and(eq(walletSettings.userId, userId), isNull(walletSettings.organizationId)))
        ).count;
      case "paymentMethods":
        return (
          await this.#cursor
            .update(paymentMethods)
            .set({ organizationId })
            .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.organizationId)))
        ).count;
      case "stripeTransactions":
        return (
          await this.#cursor
            .update(stripeTransactions)
            .set({ organizationId })
            .where(and(eq(stripeTransactions.userId, userId), isNull(stripeTransactions.organizationId)))
        ).count;
      case "deploymentSettings":
        return (
          await this.#cursor
            .update(deploymentSettings)
            .set({ organizationId, projectId })
            .where(and(eq(deploymentSettings.userId, userId), unfiled(deploymentSettings, organizationId)))
        ).count;
      case "apiKeys":
        return (
          await this.#cursor
            .update(apiKeys)
            .set({ organizationId })
            .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.organizationId)))
        ).count;
      case "templates":
        if (!externalUserId) return 0;

        return (
          await this.#cursor
            .update(templates)
            .set({ organizationId, projectId })
            .where(and(eq(templates.userId, externalUserId), unfiled(templates, organizationId)))
        ).count;
    }
  }
}
