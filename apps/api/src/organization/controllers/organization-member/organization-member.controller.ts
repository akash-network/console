import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  ListOrganizationMemberProjectGrantsResponse,
  ListOrganizationMembersResponse,
  OrganizationMemberResponse,
  UpdateOrganizationMemberRequest
} from "@src/organization/http-schemas/organization-member.schema";
import { effectiveProjectAccessOf } from "@src/organization/lib/project-access/project-access";
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
  async listProjectGrants(id: string): Promise<ListOrganizationMemberProjectGrantsResponse> {
    return { data: await this.organizationMemberService.listProjectGrantsOf(id) };
  }

  @Protected([{ action: "update", subject: "OrganizationMember" }])
  async update(id: string, change: UpdateOrganizationMemberRequest["data"]): Promise<OrganizationMemberResponse> {
    return { data: toOrganizationMember(await this.organizationMemberService.update(id, change)) };
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

function toOrganizationMember(member: OrganizationMemberWithUser): OrganizationMemberResponse["data"] {
  const { id, userId, username, email, role, projectCount, createdAt } = member;
  const projectAccess = effectiveProjectAccessOf(role, member.projectAccess);

  return {
    id,
    userId,
    username,
    email,
    role,
    projectAccess,
    projectCount: projectAccess === "selected" ? projectCount : null,
    createdAt: createdAt.toISOString()
  };
}
