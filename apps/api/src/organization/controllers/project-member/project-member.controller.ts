import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateProjectMemberRequest,
  ListProjectMembersResponse,
  ProjectMemberResponse,
  ProjectMemberResponseItem,
  UpdateProjectMemberRequest
} from "@src/organization/http-schemas/project-member.schema";
import type { ProjectMemberWithUser } from "@src/organization/repositories/project-member/project-member.repository";
import { ProjectMemberService } from "@src/organization/services/project-member/project-member.service";

@singleton()
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  @Protected([{ action: "read", subject: "ProjectMember" }])
  async list(projectId: string): Promise<ListProjectMembersResponse> {
    const grants = await this.projectMemberService.list(projectId);

    return { data: grants.map(toProjectMemberResponse) };
  }

  @Protected([{ action: "create", subject: "ProjectMember" }])
  async create(input: CreateProjectMemberRequest["data"]): Promise<ProjectMemberResponse> {
    return { data: toProjectMemberResponse(await this.projectMemberService.create(input)) };
  }

  @Protected([{ action: "update", subject: "ProjectMember" }])
  async update(id: string, input: UpdateProjectMemberRequest["data"]): Promise<ProjectMemberResponse> {
    return { data: toProjectMemberResponse(await this.projectMemberService.update(id, input)) };
  }

  @Protected([{ action: "delete", subject: "ProjectMember" }])
  async delete(id: string): Promise<void> {
    await this.projectMemberService.delete(id);
  }
}

function toProjectMemberResponse({ id, projectId, userId, username, email, role, createdAt }: ProjectMemberWithUser): ProjectMemberResponseItem {
  return { id, projectId, userId, username, email, role, createdAt: createdAt.toISOString() };
}
