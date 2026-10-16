import { subject } from "@casl/ability";
import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationContextResolver } from "@src/organization/services/organization-context/organization-context.resolver";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { type UserOutput, UserRepository } from "@src/user/repositories";

export const ACCESS_REVOKED_ERROR_CODE = "access_revoked";

/** What a job queued for a member acts on; `walletId` is absent when the job signs with the member's own wallet. */
export type MemberDeploymentAction = { userId: string; walletId?: number; dseq: string };

type AccessRevocation = "wallet_gone" | "wallet_of_another_user" | "user_gone" | "not_a_member" | "cannot_sign" | "outside_project_scope";

export function isAccessRevoked(error: unknown): boolean {
  return isHttpError(error) && error.errorCode === ACCESS_REVOKED_ERROR_CODE;
}

@singleton()
export class MemberDeploymentAccessService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly organizationContextResolver: OrganizationContextResolver,
    private readonly abilityService: AbilityService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: MemberDeploymentAccessService.name });
  }

  /** A job signs long after the request that queued it, so it re-runs that request's checks against the member's membership, role and project access as they stand now. */
  async assertMayStillAct(action: MemberDeploymentAction): Promise<void> {
    const revocation = await this.#revocationOf(action);

    if (!revocation) return;

    this.#logger.warn({ event: "MEMBER_ACCESS_REVOKED", ...action, revocation });
    throw createError(403, "You no longer have access to this deployment.", { errorCode: ACCESS_REVOKED_ERROR_CODE });
  }

  async #revocationOf({ userId, walletId, dseq }: MemberDeploymentAction): Promise<AccessRevocation | undefined> {
    if (walletId === undefined) return undefined;

    const wallet = await this.userWalletRepository.unscoped("member-access-validation").findById(walletId);

    if (!wallet) return "wallet_gone";
    if (wallet.userId !== null) return wallet.userId === userId ? undefined : "wallet_of_another_user";

    const user = await this.userRepository.findById(userId);

    if (!user) return "user_gone";

    const context = wallet.organizationId ? await this.#contextIn(user, wallet.organizationId) : undefined;

    if (!context) return "not_a_member";

    return await this.#revocationWithin(context, user, wallet, dseq);
  }

  async #contextIn(user: UserOutput, organizationId: string): Promise<OrganizationContext | undefined> {
    try {
      return await this.organizationContextResolver.resolveBoundTo(user, organizationId);
    } catch (error) {
      if (isHttpError(error) && error.errorCode === ORGANIZATION_FORBIDDEN_ERROR_CODE) return undefined;

      throw error;
    }
  }

  /** Runs in a context of its own, so the member's organization and ability reach the request's checks without replacing the job's. */
  async #revocationWithin(context: OrganizationContext, user: UserOutput, wallet: UserWalletOutput, dseq: string): Promise<AccessRevocation | undefined> {
    return await this.executionContextService.runWithContext(async () => {
      this.executionContextService.set("CURRENT_USER", user);
      this.executionContextService.set("ORGANIZATION_CONTEXT", context);
      const ability = this.abilityService.getAbilityFor("REGULAR_USER", user);
      this.executionContextService.set("ABILITY", ability);

      if (!ability.can("sign", subject("UserWallet", { ...wallet }))) return "cannot_sign";
      if (!(await this.managedSignerService.isDeploymentInProjectScope(wallet, dseq, "update"))) return "outside_project_scope";

      return undefined;
    });
  }
}
