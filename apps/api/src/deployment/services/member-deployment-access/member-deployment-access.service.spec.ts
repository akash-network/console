import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AbilityService } from "@src/auth/services/ability/ability.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationContextResolver } from "@src/organization/services/organization-context/organization-context.resolver";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { ACCESS_REVOKED_ERROR_CODE, isAccessRevoked, MemberDeploymentAccessService } from "./member-deployment-access.service";

import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(MemberDeploymentAccessService.name, () => {
  const REVOKED = { status: 403, errorCode: ACCESS_REVOKED_ERROR_CODE, message: "You no longer have access to this deployment." };

  describe("assertMayStillSign", () => {
    it("lets a job signing with the member's own wallet act without reading anything", async () => {
      const { service, userWalletRepository, userRepository, organizationContextResolver, member } = setup();

      await expect(service.assertMayStillSign({ userId: member.id, dseq: "100" })).resolves.toBeUndefined();

      expect(userWalletRepository.unscoped).not.toHaveBeenCalled();
      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
    });

    it("lets a job act with a personal wallet named by id when it belongs to the member", async () => {
      const { service, organizationContextResolver, managedSignerService, member } = setup({ wallet: "personal" });

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).resolves.toBeUndefined();

      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
      expect(managedSignerService.isDeploymentInProjectScope).not.toHaveBeenCalled();
    });

    it("reads the wallet named by id outside the organization scoping a job might carry", async () => {
      const { service, userWalletRepository, unscopedWallets, member } = setup();

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });

      expect(userWalletRepository.unscoped).toHaveBeenCalledWith("member-access-validation");
      expect(unscopedWallets.findById).toHaveBeenCalledWith(7);
    });

    it("refuses a personal wallet of another user", async () => {
      const { service, member } = setup({ wallet: "another user's" });

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
    });

    it("refuses a wallet that no longer exists", async () => {
      const { service, unscopedWallets, member } = setup();
      unscopedWallets.findById.mockResolvedValue(undefined);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
    });

    it("refuses a wallet that no longer belongs to any organization", async () => {
      const { service, organizationContextResolver, member } = setup({ wallet: "detached" });

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
    });

    it("refuses a member whose account no longer exists", async () => {
      const { service, userRepository, organizationContextResolver, member } = setup();
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
      expect(userRepository.findById).toHaveBeenCalledWith(member.id);
      expect(organizationContextResolver.resolveBoundTo).not.toHaveBeenCalled();
    });

    it("rebuilds the member's context in the organization the wallet belongs to", async () => {
      const { service, organizationContextResolver, member, wallet } = setup();

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });

      expect(organizationContextResolver.resolveBoundTo).toHaveBeenCalledWith(member, wallet.organizationId);
    });

    it("refuses a member the organization no longer counts, as after they left or it was deleted", async () => {
      const { service, organizationContextResolver, abilityService, member } = setup();
      organizationContextResolver.resolveBoundTo.mockRejectedValue(
        createError(403, "Not a member of this organization", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE })
      );

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
      expect(abilityService.getAbilityFor).not.toHaveBeenCalled();
    });

    it("refuses a member for whom no context resolves", async () => {
      const { service, organizationContextResolver, member } = setup();
      organizationContextResolver.resolveBoundTo.mockResolvedValue(undefined);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
    });

    it("passes on any other failure to resolve the member's context, so the job retries it", async () => {
      const { service, organizationContextResolver, member } = setup();
      const outage = createError(503, "Database unavailable");
      organizationContextResolver.resolveBoundTo.mockRejectedValue(outage);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toBe(outage);
    });

    it("passes on a failure that is no HTTP error, so the job retries it", async () => {
      const { service, organizationContextResolver, member } = setup();
      const outage = new Error("connection terminated");
      organizationContextResolver.resolveBoundTo.mockRejectedValue(outage);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toBe(outage);
    });

    it("builds the member's ability in their rebuilt context", async () => {
      const { service, abilityService, executionContextService, member, context, ability } = setup();
      const seen: { context?: OrganizationContext; user?: UserOutput } = {};
      abilityService.getAbilityFor.mockImplementation(() => {
        seen.context = executionContextService.get("ORGANIZATION_CONTEXT");
        seen.user = executionContextService.get("CURRENT_USER");
        return ability;
      });

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });

      expect(abilityService.getAbilityFor).toHaveBeenCalledWith("REGULAR_USER", member);
      expect(seen).toEqual({ context, user: member });
    });

    it("refuses a member whose role no longer lets them sign with the wallet", async () => {
      const { service, abilityService, managedSignerService, member } = setup();
      abilityService.getAbilityFor.mockReturnValue(createMongoAbility([{ action: "read", subject: "UserWallet" }]));

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
      expect(managedSignerService.isDeploymentInProjectScope).not.toHaveBeenCalled();
    });

    it("refuses a member who may sign only with another organization's wallet", async () => {
      const { service, abilityService, member } = setup();
      abilityService.getAbilityFor.mockReturnValue(
        createMongoAbility([{ action: "sign", subject: "UserWallet", conditions: { organizationId: faker.string.uuid() } }])
      );

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
    });

    it("refuses a member who may no longer manage the deployment's project", async () => {
      const { service, managedSignerService, member } = setup();
      managedSignerService.isDeploymentInProjectScope.mockResolvedValue(false);

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).rejects.toMatchObject(REVOKED);
    });

    it("checks the deployment against the projects the member may manage, as their request was", async () => {
      const { service, managedSignerService, executionContextService, member, wallet, ability, context } = setup();
      const seen: { context?: OrganizationContext; ability?: MongoAbility } = {};
      managedSignerService.isDeploymentInProjectScope.mockImplementation(async () => {
        seen.context = executionContextService.get("ORGANIZATION_CONTEXT");
        seen.ability = executionContextService.get("ABILITY");
        return true;
      });

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });

      expect(managedSignerService.isDeploymentInProjectScope).toHaveBeenCalledWith(wallet, "100", "update");
      expect(seen).toEqual({ context, ability });
    });

    it("lets a member who still holds every access act", async () => {
      const { service, member } = setup();

      await expect(service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" })).resolves.toBeUndefined();
    });

    it("leaves the job's own context as it was", async () => {
      const { service, executionContextService, member } = setup();
      const jobAbility = createMongoAbility();
      const jobUser = createUser({ id: "bg-job-user" });

      const after = await executionContextService.runWithContext(async () => {
        executionContextService.set("ABILITY", jobAbility);
        executionContextService.set("CURRENT_USER", jobUser);
        await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });
        return {
          context: executionContextService.get("ORGANIZATION_CONTEXT"),
          ability: executionContextService.get("ABILITY"),
          user: executionContextService.get("CURRENT_USER")
        };
      });

      expect(after).toEqual({ context: undefined, ability: jobAbility, user: jobUser });
    });

    it("logs what the member lost along with the action refused", async () => {
      const { service, managedSignerService, logger, member } = setup();
      managedSignerService.isDeploymentInProjectScope.mockResolvedValue(false);

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" }).catch(() => undefined);

      expect(logger.warn).toHaveBeenCalledWith({
        event: "MEMBER_ACCESS_REVOKED",
        userId: member.id,
        walletId: 7,
        dseq: "100",
        revocation: "outside_project_scope"
      });
    });

    it("logs nothing for a member who still holds every access", async () => {
      const { service, logger, member } = setup();

      await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs under its own name", () => {
      const { createLogger } = setup();

      expect(createLogger).toHaveBeenCalledWith({ context: MemberDeploymentAccessService.name });
    });
  });

  describe("isAccessRevoked", () => {
    it("recognizes the refusal of a member who lost access", async () => {
      const { service, managedSignerService, member } = setup();
      managedSignerService.isDeploymentInProjectScope.mockResolvedValue(false);

      const refusal = await service.assertMayStillSign({ userId: member.id, walletId: 7, dseq: "100" }).catch((error: unknown) => error);

      expect(isAccessRevoked(refusal)).toBe(true);
    });

    it("tells any other refusal or failure apart", () => {
      expect(isAccessRevoked(createError(403, "This deployment is outside the projects you can manage", { errorCode: "project_forbidden" }))).toBe(false);
      expect(isAccessRevoked(createError(403, "Forbidden"))).toBe(false);
      expect(isAccessRevoked(Object.assign(new Error("no access"), { errorCode: ACCESS_REVOKED_ERROR_CODE }))).toBe(false);
      expect(isAccessRevoked(undefined)).toBe(false);
    });
  });

  function setup(input: { wallet?: "team" | "personal" | "another user's" | "detached" } = {}) {
    const member = createUser();
    const organizationId = faker.string.uuid();
    const walletsByKind: Record<NonNullable<typeof input.wallet>, UserWalletOutput> = {
      team: { ...createUserWallet({ id: 7, organizationId }), userId: null },
      personal: createUserWallet({ id: 7, userId: member.id, organizationId }),
      "another user's": createUserWallet({ id: 7, organizationId }),
      detached: { ...createUserWallet({ id: 7 }), userId: null, organizationId: null }
    };
    const wallet = walletsByKind[input.wallet ?? "team"];
    const context = createOrganizationContext({ organizationId, role: "member", projectScope: createProjectsScope([faker.string.uuid()]) });
    const ability = createMongoAbility([{ action: "sign", subject: "UserWallet", conditions: { organizationId } }]);

    const unscopedWallets = mock<UserWalletRepository>({ findById: vi.fn().mockResolvedValue(wallet) });
    const userWalletRepository = mock<UserWalletRepository>({ unscoped: vi.fn().mockReturnValue(unscopedWallets) });
    const userRepository = mock<UserRepository>({ findById: vi.fn().mockResolvedValue(member) });
    const organizationContextResolver = mock<OrganizationContextResolver>({ resolveBoundTo: vi.fn().mockResolvedValue(context) });
    const abilityService = mock<AbilityService>({ getAbilityFor: vi.fn().mockReturnValue(ability) });
    const managedSignerService = mock<ManagedSignerService>({ isDeploymentInProjectScope: vi.fn().mockResolvedValue(true) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const executionContextService = new ExecutionContextService(() => mock<ReturnType<CreateLogger>>());

    const service = new MemberDeploymentAccessService(
      userWalletRepository,
      userRepository,
      organizationContextResolver,
      abilityService,
      managedSignerService,
      executionContextService,
      createLogger
    );

    return {
      service,
      userWalletRepository,
      unscopedWallets,
      userRepository,
      organizationContextResolver,
      abilityService,
      managedSignerService,
      executionContextService,
      logger,
      createLogger,
      member,
      wallet,
      context,
      ability
    };
  }
});
