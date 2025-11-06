import type { CertificateManager, certificateManager } from "@akashnetwork/chain-sdk";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { RpcMessageService } from "@src/billing/services";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { CertificateService } from "./certificate.service";

describe(CertificateService.name, () => {
  describe("create", () => {
    it("creates certificate successfully when wallet exists", async () => {
      const userWallet = {
        id: faker.number.int(),
        userId: faker.string.uuid(),
        address: `akash${faker.string.alphanumeric({ length: 39 })}`
      };

      const certificateData = {
        cert: "-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----",
        publicKey: "-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----",
        privateKey: "encrypted-private-key"
      };

      const createCertificateMsg = {
        typeUrl: "/akash.cert.v1beta3.MsgCreateCertificate",
        value: {}
      };

      const { service, userWalletRepository, authService, rpcMessageService, managedSignerService, certificateManager } = setup({
        findWallet: jest.fn().mockResolvedValue(userWallet),
        getCreateCertificateMsg: jest.fn().mockReturnValue(createCertificateMsg),
        executeDecodedTxByUserId: jest.fn().mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash" })
      });

      const result = await service.create({ userId: userWallet.userId });

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userWallet.userId);
      expect(certificateManager.generatePEM).toHaveBeenCalledWith(userWallet.address);
      expect(rpcMessageService.getCreateCertificateMsg).toHaveBeenCalledWith(userWallet.address, certificateData.cert, certificateData.publicKey);
      expect(managedSignerService.executeDecodedTxByUserId).toHaveBeenCalledWith(userWallet.userId, [createCertificateMsg]);
      expect(result).toEqual({
        certPem: certificateData.cert,
        pubkeyPem: certificateData.publicKey,
        encryptedKey: certificateData.privateKey
      });
    });

    it("throws 404 error when user wallet is not found", async () => {
      const userId = faker.string.uuid();
      const { service, userWalletRepository, authService } = setup({
        findWallet: jest.fn().mockResolvedValue(null)
      });

      await expect(service.create({ userId })).rejects.toThrow("UserWallet not found");

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
    });

    it("throws 404 error when user wallet has no address", async () => {
      const userWallet = {
        id: faker.number.int(),
        userId: faker.string.uuid(),
        address: null
      };

      const { service, userWalletRepository, authService } = setup({
        findWallet: jest.fn().mockResolvedValue(userWallet)
      });

      await expect(service.create({ userId: userWallet.userId })).rejects.toThrow("UserWallet not found");

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userWallet.userId);
    });
  });

  function setup(input?: {
    findWallet?: UserWalletRepository["findOneByUserId"];
    generateCert?: typeof certificateManager.generatePEM;
    getCreateCertificateMsg?: RpcMessageService["getCreateCertificateMsg"];
    executeDecodedTxByUserId?: ManagedSignerService["executeDecodedTxByUserId"];
  }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        accessibleBy: jest.fn().mockReturnThis(),
        findOneByUserId: input?.findWallet ?? jest.fn()
      }),
      authService: mock<AuthService>({
        ability: createMongoAbility<MongoAbility>()
      }),
      rpcMessageService: mock<RpcMessageService>({
        getCreateCertificateMsg: input?.getCreateCertificateMsg ?? jest.fn()
      }),
      managedSignerService: mock<ManagedSignerService>({
        executeDecodedTxByUserId: input?.executeDecodedTxByUserId ?? jest.fn()
      }),
      certificateManager: mock<CertificateManager>({
        generatePEM:
          input?.generateCert ??
          jest.fn(async () => ({
            cert: "-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----",
            publicKey: "-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----",
            privateKey: "encrypted-private-key"
          }))
      })
    };

    const service = new CertificateService(
      mocks.userWalletRepository,
      mocks.authService,
      mocks.certificateManager,
      mocks.rpcMessageService,
      mocks.managedSignerService
    );

    return { service, ...mocks };
  }
});
