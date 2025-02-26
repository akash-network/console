import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";

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
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService
  ) {}

  async create(): Promise<CertificateOutput> {
    const userWallet = await this.userWalletRepository.findOneByUserId(this.authService.currentUser.id);

    if (userWallet) {
      const { cert: crtpem, publicKey: pubpem, privateKey: encryptedKey } = certificateManager.generatePEM(userWallet.address);
      const createCertificateMsg = this.rpcMessageService.getCreateCertificateMsg(userWallet.address, crtpem, pubpem);
      const messages = [createCertificateMsg];

      await this.managedSignerService.executeDecodedTxByUserId(userWallet.userId, messages);

      return {
        certPem: crtpem,
        pubkeyPem: pubpem,
        encryptedKey: encryptedKey
      };
    }

    return null;
  }
}
