import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateProjectRequest,
  ListProjectsResponse,
  ProjectResponse,
  ProjectResponseItem,
  UpdateProjectRequest
} from "@src/organization/http-schemas/project.schema";
import type { ProjectWithCreator } from "@src/organization/repositories/project/project.repository";
import { ProjectService } from "@src/organization/services/project/project.service";

@singleton()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Protected()
  async list(): Promise<ListProjectsResponse> {
    const projects = await this.projectService.list();

    return { data: projects.map(toProjectResponse) };
  }

  @Protected()
  async get(id: string): Promise<ProjectResponse> {
    return { data: toProjectResponse(await this.projectService.get(id)) };
  }

  @Protected()
  async create(input: CreateProjectRequest["data"]): Promise<ProjectResponse> {
    return { data: toProjectResponse(await this.projectService.create(input)) };
  }

  @Protected()
  async update(id: string, input: UpdateProjectRequest["data"]): Promise<ProjectResponse> {
    return { data: toProjectResponse(await this.projectService.update(id, input)) };
  }

  @Protected()
  async delete(id: string): Promise<void> {
    await this.projectService.delete(id);
  }
}

function toProjectResponse({ id, name, slug, description, isDefault, createdAt, createdBy }: ProjectWithCreator): ProjectResponseItem {
  return { id, name, slug, description, isDefault, createdAt: createdAt.toISOString(), createdBy };
}
