import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  ListOrganizationMembersResponse,
  OrganizationMemberResponse,
  UpdateOrganizationMemberRequest
} from "@src/organization/http-schemas/organization-member.schema";
import type { OrganizationMemberWithUser } from "@src/organization/repositories/organization-member/organization-member.repository";
import { OrganizationMemberService } from "@src/organization/services/organization-member/organization-member.service";

@singleton()
export class OrganizationMemberController {
  constructor(private readonly organizationMemberService: OrganizationMemberService) {}

  @Protected([{ action: "read", subject: "OrganizationMember" }])
  async list(): Promise<ListOrganizationMembersResponse> {
    const members = await this.organizationMemberService.listMembers();

    return { data: members.map(toOrganizationMember) };
  }

  @Protected([{ action: "update", subject: "OrganizationMember" }])
  async update(id: string, { role }: UpdateOrganizationMemberRequest["data"]): Promise<OrganizationMemberResponse> {
    return { data: toOrganizationMember(await this.organizationMemberService.updateRole(id, role)) };
  }

  @Protected([{ action: "delete", subject: "OrganizationMember" }])
  async delete(id: string): Promise<void> {
    await this.organizationMemberService.removeMember(id);
  }

  @Protected([{ action: "update", subject: "OrganizationMember" }])
  async transferOwnership(id: string): Promise<OrganizationMemberResponse> {
    return { data: toOrganizationMember(await this.organizationMemberService.transferOwnership(id)) };
  }
}

function toOrganizationMember({ id, userId, username, email, role, createdAt }: OrganizationMemberWithUser): OrganizationMemberResponse["data"] {
  return { id, userId, username, email, role, createdAt: createdAt.toISOString() };
}
