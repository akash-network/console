import { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import createError, { BadRequest, HttpError, Unauthorized } from "http-errors";
import { Err, Result } from "ts-results";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { PROJECT_FORBIDDEN_ERROR_CODE } from "@src/organization/services/organization-context/organization-context.resolver";
import { CreateJwtTokenRequest, CreateJwtTokenResponse } from "../../http-schemas/jwt-token.schema";
import { ProviderJwtTokenService } from "../../services/provider-jwt-token/provider-jwt-token.service";

const MAX_PROJECT_LIMITED_TTL_SECONDS = 3600;

@singleton()
export class JwtTokenController {
  constructor(
    private readonly providerJwtTokenService: ProviderJwtTokenService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly signerService: ManagedSignerService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async createJwtToken(payload: CreateJwtTokenRequest): Promise<Result<CreateJwtTokenResponse, HttpError>> {
    if (!this.authService.currentUser) return Err(new Unauthorized());

    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneUsedBy(this.authService.currentUser.id);
    if (!wallet) return Err(new BadRequest("User does not have a wallet"));

    if (this.#isLimitedToProjects()) {
      if (payload.ttl > MAX_PROJECT_LIMITED_TTL_SECONDS) return Err(new BadRequest(`ttl must be at most ${MAX_PROJECT_LIMITED_TTL_SECONDS} seconds`));

      const dseqs = deploymentsNamedBy(payload.leases);
      if (!dseqs) return Err(createError(403, "Name the deployments the token is for", { errorCode: PROJECT_FORBIDDEN_ERROR_CODE }));

      await this.signerService.assertDeploymentsInProjectScope(wallet, dseqs);
    }

    const result = await this.providerJwtTokenService.generateJwtToken({
      walletId: wallet.id,
      leases: payload.leases as JwtTokenPayload["leases"],
      ttl: payload.ttl
    });

    return result.map(token => ({ token })).mapErr(errors => new BadRequest(errors.join(".\n")));
  }

  #isLimitedToProjects(): boolean {
    const organizationContext = this.executionContextService.get("ORGANIZATION_CONTEXT");

    return organizationContext?.mode === "organization" && organizationContext.projectScope.kind === "projects";
  }
}

/** The deployments a token grants, only when every provider entry lists them one by one. */
function deploymentsNamedBy(leases: CreateJwtTokenRequest["leases"]): string[] | undefined {
  if (leases.access !== "granular" || !Array.isArray(leases.permissions)) return undefined;

  const dseqs: string[] = [];

  for (const permission of leases.permissions) {
    if (permission?.access !== "granular" || !Array.isArray(permission.deployments) || permission.deployments.length === 0) return undefined;

    dseqs.push(...permission.deployments.map((deployment: { dseq?: unknown }) => String(deployment?.dseq)));
  }

  return dseqs.length > 0 ? dseqs : undefined;
}
