"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { DeploymentsList } from "@src/components/deployments/DeploymentsList/DeploymentsList";
import Layout from "@src/components/layout/Layout";
import { canManageProjects } from "@src/components/organizations/organizationAccess";
import { NotFoundPage } from "@src/components/shared/NotFoundPage/NotFoundPage";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useOrganizationActivitiesQuery } from "@src/queries/useOrganizationActivitiesQuery";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { ProjectRecord } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { NewProjectModal } from "../NewProjectModal/NewProjectModal";
import { ProjectBudgetPanel } from "../ProjectBudgetPanel/ProjectBudgetPanel";
import { ProjectMembersPreview } from "../ProjectMembersPreview/ProjectMembersPreview";
import { ProjectSwitcher } from "../ProjectSwitcher/ProjectSwitcher";
import { RecentActivityFeed } from "../RecentActivityFeed/RecentActivityFeed";

export const DEPENDENCIES = {
  useFlag,
  useRouter,
  useActiveOrganization,
  useProjectsQuery,
  useOrganizationActivitiesQuery,
  Layout,
  NotFoundPage,
  DeploymentsList,
  ProjectSwitcher,
  ProjectBudgetPanel,
  ProjectMembersPreview,
  RecentActivityFeed,
  NewProjectModal
};

interface Props {
  projectId: string;
  dependencies?: typeof DEPENDENCIES;
}

/** One project: its deployments, who was granted it and what happened in it. A project the caller cannot see reads as one that does not exist. */
export function ProjectPage({ projectId, dependencies: d = DEPENDENCIES }: Props) {
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { isLoading, projectsEnabled } = d.useActiveOrganization();

  if (!isOrganizationsEnabled) return <d.NotFoundPage />;
  if (isLoading) return <d.Layout background="dots" isLoading disableContainer />;
  if (!projectsEnabled) return <d.NotFoundPage />;
  return <ProjectPageContent projectId={projectId} dependencies={d} />;
}

function ProjectPageContent({ projectId, dependencies: d }: Required<Props>) {
  const router = d.useRouter();
  const { activeOrganization } = d.useActiveOrganization();
  const projectsQuery = d.useProjectsQuery();
  const activityFeed = d.useOrganizationActivitiesQuery({ projectId });
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const projects = projectsQuery.data ?? [];
  const project = projects.find(candidate => candidate.id === projectId);
  const organizationName = activeOrganization?.name ?? "";

  const role = activeOrganization?.role;
  const canManage = !!role && canManageProjects(role);
  const seesMembers = !!role && role !== "billing";

  if (projectsQuery.isLoading) return <d.Layout background="dots" isLoading disableContainer />;
  if (projectsQuery.isError) {
    return (
      <d.Layout background="dots" disableContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <p className="text-muted-foreground">Couldn&apos;t load the project.</p>
          <Button variant="outline" size="sm" onClick={() => projectsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </d.Layout>
    );
  }
  if (!project) return <d.NotFoundPage />;

  const openCreatedProject = (createdProject: ProjectRecord) => {
    setIsCreatingProject(false);
    router.push(UrlService.project(createdProject.id));
  };

  return (
    <>
      <d.DeploymentsList
        key={project.id}
        project={{
          id: project.id,
          name: project.name,
          title: (
            <d.ProjectSwitcher
              organizationName={organizationName}
              projects={projects}
              currentProject={project}
              onNewProject={canManage ? () => setIsCreatingProject(true) : undefined}
            />
          ),
          aside: (
            <>
              <d.ProjectBudgetPanel projectId={project.id} projectName={project.name} />
              {seesMembers && <d.ProjectMembersPreview project={{ id: project.id, name: project.name }} organizationName={organizationName} />}
              <d.RecentActivityFeed
                activities={activityFeed.activities}
                projects={projects}
                hasMore={activityFeed.hasMore}
                onShowMore={activityFeed.showMore}
                isError={activityFeed.isError}
                onRetry={activityFeed.retry}
                showsProjects={false}
              />
            </>
          )
        }}
      />

      {isCreatingProject && (
        <d.NewProjectModal
          organizationName={organizationName}
          existingSlugs={projects.map(candidate => candidate.name.toLowerCase())}
          onClose={() => setIsCreatingProject(false)}
          onCreated={openCreatedProject}
        />
      )}
    </>
  );
}
