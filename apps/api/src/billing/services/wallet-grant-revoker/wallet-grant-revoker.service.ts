import { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";

/** The chain reports a revoke of a grant that no longer exists this way, which an earlier attempt of the same revoke can have caused. */
const GRANT_MISSING_PATTERN = /not found/i;

/** Each revoke re-reads the grant on chain and reports whether it revoked one, so a retry after a partial failure resumes where it stopped. */
@singleton()
export class WalletGrantRevokerService {
  constructor(
    private readonly txManagerService: TxManagerService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly signerService: ManagedSignerService
  ) {}

  async revokeDepositGrant(grantee: string): Promise<boolean> {
    const granter = await this.txManagerService.getFundingWalletAddress();
    if (!(await this.authzHttpService.hasDepositDeploymentGrant(granter, grantee))) return false;

    await this.#executeRevoke(this.rpcMessageService.getRevokeDepositDeploymentGrantMsg({ granter, grantee }));
    return true;
  }

  async revokeFeeGrant(grantee: string): Promise<boolean> {
    const granter = await this.txManagerService.getFundingWalletAddress();
    if (!(await this.authzHttpService.hasFeeAllowance(granter, grantee))) return false;

    await this.#executeRevoke(this.rpcMessageService.getRevokeAllowanceMsg({ granter, grantee }));
    return true;
  }

  async #executeRevoke(message: EncodeObject): Promise<void> {
    try {
      await this.signerService.executeFundingTx([message]);
    } catch (error) {
      if (isGrantMissingError(error)) return;
      throw error;
    }
  }
}

function isGrantMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const originalError = (error as { originalError?: unknown }).originalError;
  const messages = [error.message, originalError instanceof Error ? originalError.message : undefined];

  return messages.some(message => message && GRANT_MISSING_PATTERN.test(message));
}
