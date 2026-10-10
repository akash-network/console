import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { createUser } from "../../../../test/seeders/user.seeder";
import { createUserWallet } from "../../../../test/seeders/user-wallet.seeder";
import type { AuthService } from "../../../auth/services/auth.service";
import type { UserWalletRepository } from "../../../billing/repositories";
import type { UserOutput } from "../../../user/repositories/user/user.repository";
import type { CreateJwtTokenRequest } from "../../http-schemas/jwt-token.schema";
import type { ProviderJwtTokenService } from "../../services/provider-jwt-token/provider-jwt-token.service";
import { JwtTokenController } from "./jwt-token.controller";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(JwtTokenController.name, () => {
  describe("createJwtToken", () => {
    it("creates JWT token successfully when user has wallet", async () => {
      const user = createUser();
      const { controller, authService, userWalletRepository, providerJwtTokenService, jwtToken, wallet } = setup({ user });

      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);
      providerJwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const payload = createPayload();
      const result = await controller.createJwtToken(payload);

      expect(result.unwrap()).toEqual({ token: jwtToken });
      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneUsedBy).toHaveBeenCalledWith(user.id);
      expect(providerJwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId: wallet.id,
        leases: payload.leases,
        ttl: payload.ttl
      });
    });

    describe("when the caller is limited to some projects", () => {
      const projectScoped = createOrganizationContext({ role: "member", projectScope: { kind: "projects", projectIds: ["project-a"] } });

      it("grants a token for deployments listed one by one once they are checked against the caller's projects", async () => {
        const user = createUser();
        const { controller, authService, userWalletRepository, providerJwtTokenService, signerService, jwtToken, wallet } = setup({
          user,
          organizationContext: projectScoped
        });
        authService.currentUser = user;
        userWalletRepository.accessibleBy.mockReturnThis();
        userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);
        providerJwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

        const result = await controller.createJwtToken(granularPayload([{ dseq: 1 }, { dseq: 2 }]));

        expect(result.unwrap()).toEqual({ token: jwtToken });
        expect(signerService.assertDeploymentsInProjectScope).toHaveBeenCalledWith(wallet, ["1", "2"]);
      });

      it("refuses a token for a deployment outside the caller's projects", async () => {
        const user = createUser();
        const { controller, authService, userWalletRepository, providerJwtTokenService, signerService, wallet } = setup({
          user,
          organizationContext: projectScoped
        });
        authService.currentUser = user;
        userWalletRepository.accessibleBy.mockReturnThis();
        userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);
        signerService.assertDeploymentsInProjectScope.mockRejectedValue(createError(403, "outside", { errorCode: "project_forbidden" }));

        await expect(controller.createJwtToken(granularPayload([{ dseq: 1 }]))).rejects.toMatchObject({ status: 403 });
        expect(providerJwtTokenService.generateJwtToken).not.toHaveBeenCalled();
      });

      it.each([
        { name: "full access", leases: { access: "full" } },
        { name: "access scoped across every lease", leases: { access: "scoped", scope: ["logs"] } },
        { name: "full access to a provider", leases: { access: "granular", permissions: [{ provider: "akash1provider", access: "full" }] } },
        { name: "no deployment listed", leases: { access: "granular", permissions: [{ provider: "akash1provider", access: "granular", deployments: [] }] } },
        { name: "no provider listed", leases: { access: "granular", permissions: [] } }
      ])("refuses a token with $name", async ({ leases }) => {
        const user = createUser();
        const { controller, authService, userWalletRepository, providerJwtTokenService, wallet } = setup({ user, organizationContext: projectScoped });
        authService.currentUser = user;
        userWalletRepository.accessibleBy.mockReturnThis();
        userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);

        const result = await controller.createJwtToken({ ttl: 3600, leases });

        expect(result.err && result.val).toMatchObject({ status: 403, errorCode: "project_forbidden" });
        expect(providerJwtTokenService.generateJwtToken).not.toHaveBeenCalled();
      });

      it("refuses a token meant to outlive an hour", async () => {
        const user = createUser();
        const { controller, authService, userWalletRepository, providerJwtTokenService, signerService, wallet } = setup({
          user,
          organizationContext: projectScoped
        });
        authService.currentUser = user;
        userWalletRepository.accessibleBy.mockReturnThis();
        userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);

        const result = await controller.createJwtToken({ ...granularPayload([{ dseq: 1 }]), ttl: 3601 });

        expect(result.err && result.val).toMatchObject({ status: 400, message: "ttl must be at most 3600 seconds" });
        expect(signerService.assertDeploymentsInProjectScope).not.toHaveBeenCalled();
        expect(providerJwtTokenService.generateJwtToken).not.toHaveBeenCalled();
      });

      function granularPayload(deployments: { dseq: number }[]): CreateJwtTokenRequest {
        return {
          ttl: 3600,
          leases: {
            access: "granular",
            permissions: [{ provider: "akash1provider", access: "granular", deployments: deployments.map(({ dseq }) => ({ dseq, scope: ["logs"] })) }]
          }
        };
      }
    });

    it("grants a token of any lifetime to a caller who reaches every project", async () => {
      const user = createUser();
      const { controller, authService, userWalletRepository, providerJwtTokenService, jwtToken, wallet } = setup({
        user,
        organizationContext: createOrganizationContext({ projectScope: { kind: "all" } })
      });
      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);
      providerJwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const result = await controller.createJwtToken({ ...createPayload(), ttl: 86400 });

      expect(result.unwrap()).toEqual({ token: jwtToken });
    });

    it("grants any lease access to a caller who reaches every project", async () => {
      const user = createUser();
      const { controller, authService, userWalletRepository, providerJwtTokenService, signerService, jwtToken, wallet } = setup({
        user,
        organizationContext: createOrganizationContext({ projectScope: { kind: "all" } })
      });
      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneUsedBy.mockResolvedValue(wallet);
      providerJwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const result = await controller.createJwtToken(createPayload());

      expect(result.unwrap()).toEqual({ token: jwtToken });
      expect(signerService.assertDeploymentsInProjectScope).not.toHaveBeenCalled();
    });

    it("returns UnauthorizedError when user is not authenticated", async () => {
      const { controller, authService } = setup();

      authService.currentUser = undefined as any;
      const result = await controller.createJwtToken(createPayload());

      expect(() => result.unwrap()).toThrow(/UnauthorizedError/);
    });

    it("returns BadRequestError when user has no wallet", async () => {
      const user = createUser();
      const { controller, authService, userWalletRepository } = setup({ user });

      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneUsedBy.mockResolvedValue(undefined);

      const result = await controller.createJwtToken(createPayload());
      expect(() => result.unwrap()).toThrow(/BadRequestError/);
    });
  });

  function setup(input?: { user?: UserOutput; organizationContext?: OrganizationContext }) {
    const authService = mock<AuthService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const providerJwtTokenService = mock<ProviderJwtTokenService>();
    const signerService = mock<ManagedSignerService>();
    const executionContextService = mock<ExecutionContextService>({ get: vi.fn().mockReturnValue(input?.organizationContext) });

    const controller = new JwtTokenController(providerJwtTokenService, authService, userWalletRepository, signerService, executionContextService);

    const wallet = createUserWallet({ userId: input?.user?.id });
    const jwtToken = faker.string.alphanumeric(64);

    return {
      controller,
      authService,
      userWalletRepository,
      providerJwtTokenService,
      signerService,
      jwtToken,
      wallet
    };
  }

  function createPayload(): CreateJwtTokenRequest {
    return {
      ttl: faker.number.int({ min: 3600, max: 86400 }),
      leases: {
        access: "full",
        scope: ["send-manifest", "get-manifest"]
      }
    };
  }
});
