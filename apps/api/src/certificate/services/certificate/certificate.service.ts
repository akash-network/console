import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { Trace, withSpan } from "@src/core/services/tracing/tracing.service";
import { CertificateManager } from "../../providers/certificate-manager.provider";

interface CertificateOutput {
  certPem: string;
  pubkeyPem: string;
  encryptedKey: string;
}

@singleton()
export class CertificateService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly certificateManager: CertificateManager,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService
  ) {}

  @Trace()
  async create(input: { userId: UserWalletOutput["userId"] }): Promise<CertificateOutput> {
    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(input.userId);
    const { address } = userWallet || {};
    assert(userWallet && address, 404, "UserWallet not found");

    const {
      cert: crtpem,
      publicKey: pubpem,
      privateKey: encryptedKey
    } = await withSpan("CertificateService.generatePEM", () => this.certificateManager.generatePEM(address));
    const createCertificateMsg = this.rpcMessageService.getCreateCertificateMsg(address, crtpem, pubpem);
    const messages = [createCertificateMsg];

    await this.managedSignerService.executeDerivedDecodedTxByUserId(userWallet.userId, messages);

    return {
      certPem: crtpem,
      pubkeyPem: pubpem,
      encryptedKey: encryptedKey
    };
  }
}
