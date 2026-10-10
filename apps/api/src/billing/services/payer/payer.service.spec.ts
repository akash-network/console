import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { billingOwnerOfCustomer, PayerService } from "./payer.service";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(PayerService.name, () => {
  describe("getCurrentPayer", () => {
    it("pays with the acting user's customer while a personal organization is active", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const { service, organizationRepository } = setup({ user, context: { organizationId: "org_personal", organizationType: "personal" } });

      const payer = await service.getCurrentPayer();

      expect(payer).toEqual({ user, organizationId: "org_personal", stripeCustomerId: "cus_user" });
      expect(organizationRepository.findById).not.toHaveBeenCalled();
    });

    it("pays with the acting user's customer when the request has no organization", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const { service } = setup({ user });

      expect(await service.getCurrentPayer()).toEqual({ user, organizationId: undefined, stripeCustomerId: "cus_user" });
    });

    it("pays with the team's own customer, not the member's, while a team organization is active", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const team = createOrganization({ type: "team", stripeCustomerId: "cus_team" });
      const { service, organizationRepository } = setup({ user, context: { organizationId: team.id, organizationType: "team" } });
      organizationRepository.findById.mockResolvedValue(team);

      const payer = await service.getCurrentPayer();

      expect(organizationRepository.findById).toHaveBeenCalledWith(team.id);
      expect(payer).toEqual({ user, organizationId: team.id, team, stripeCustomerId: "cus_team" });
    });

    it("answers 404 when the active team organization is gone", async () => {
      const { service, organizationRepository } = setup({ user: createUser(), context: { organizationId: "org_gone", organizationType: "team" } });
      organizationRepository.findById.mockResolvedValue(undefined);

      await expect(service.getCurrentPayer()).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("getCurrentPayingPayer", () => {
    it("answers 402 when the user has not set up payments", async () => {
      const { service } = setup({ user: createUser({ stripeCustomerId: null }) });

      await expect(service.getCurrentPayingPayer()).rejects.toMatchObject({ status: 402, message: "User payments are not set up." });
    });

    it("answers 402 when the team has not set up payments, even if the member has", async () => {
      const team = createOrganization({ type: "team", stripeCustomerId: null });
      const { service, organizationRepository } = setup({
        user: createUser({ stripeCustomerId: "cus_user" }),
        context: { organizationId: team.id, organizationType: "team" }
      });
      organizationRepository.findById.mockResolvedValue(team);

      await expect(service.getCurrentPayingPayer()).rejects.toMatchObject({ status: 402, message: "Organization payments are not set up." });
    });

    it("returns the payer once payments are set up", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const { service } = setup({ user });

      expect(await service.getCurrentPayingPayer()).toMatchObject({ user, stripeCustomerId: "cus_user" });
    });
  });

  describe("findByStripeCustomerId", () => {
    it("resolves a team organization's customer to the team without reading users", async () => {
      const team = createOrganization({ type: "team", stripeCustomerId: "cus_team" });
      const { service, organizationRepository, userRepository } = setup({ user: createUser() });
      organizationRepository.findOneBy.mockResolvedValue(team);

      const owner = await service.findByStripeCustomerId("cus_team");

      expect(organizationRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_team", type: "team" });
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(owner).toEqual({ team });
      expect(billingOwnerOfCustomer(owner!)).toEqual({ organizationId: team.id });
    });

    it("falls back to the user linked to the customer, with the user's personal organization", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const personalOrganization = createOrganization({ type: "personal", createdByUserId: user.id });
      const { service, organizationRepository, userRepository } = setup({ user });
      organizationRepository.findOneBy.mockResolvedValue(undefined);
      userRepository.findOneBy.mockResolvedValue(user);
      organizationRepository.findPersonalByUserId.mockResolvedValue(personalOrganization);

      const owner = await service.findByStripeCustomerId("cus_user");

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_user" });
      expect(organizationRepository.findPersonalByUserId).toHaveBeenCalledWith(user.id);
      expect(owner).toEqual({ user, personalOrganizationId: personalOrganization.id });
      expect(billingOwnerOfCustomer(owner!)).toEqual({ userId: user.id });
    });

    it("resolves a user who has no personal organization yet", async () => {
      const user = createUser({ stripeCustomerId: "cus_user" });
      const { service, organizationRepository, userRepository } = setup({ user });
      userRepository.findOneBy.mockResolvedValue(user);
      organizationRepository.findPersonalByUserId.mockResolvedValue(undefined);

      expect(await service.findByStripeCustomerId("cus_user")).toEqual({ user, personalOrganizationId: undefined });
    });

    it("returns nothing for an unknown customer", async () => {
      const { service, organizationRepository, userRepository } = setup({ user: createUser() });
      organizationRepository.findOneBy.mockResolvedValue(undefined);
      userRepository.findOneBy.mockResolvedValue(undefined);

      expect(await service.findByStripeCustomerId("cus_unknown")).toBeUndefined();
      expect(organizationRepository.findPersonalByUserId).not.toHaveBeenCalled();
    });
  });

  function setup(input: { user: UserOutput; context?: Pick<OrganizationContext, "organizationId" | "organizationType"> }) {
    const authService = mock<AuthService>({ currentUser: input.user });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(key =>
      key === "ORGANIZATION_CONTEXT" && input.context ? { ...input.context, role: "owner", projectScope: { kind: "all" }, mode: "organization" } : undefined
    );
    const organizationRepository = mock<OrganizationRepository>();
    const userRepository = mock<UserRepository>();
    const service = new PayerService(authService, executionContextService, organizationRepository, userRepository);

    return { service, organizationRepository, userRepository };
  }
});
