import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
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

  async create(input: { userId: UserWalletOutput["userId"] }): Promise<CertificateOutput> {
    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(input.userId);
    assert(userWallet?.address, 404, "UserWallet not found");

    const { cert: crtpem, publicKey: pubpem, privateKey: encryptedKey } = await this.certificateManager.generatePEM(userWallet.address);
    const createCertificateMsg = this.rpcMessageService.getCreateCertificateMsg(userWallet.address, crtpem, pubpem);
    const messages = [createCertificateMsg];

    await this.managedSignerService.executeDecodedTxByUserId(userWallet.userId, messages);

    return {
      certPem: crtpem,
      pubkeyPem: pubpem,
      encryptedKey: encryptedKey
    };
  }
}
