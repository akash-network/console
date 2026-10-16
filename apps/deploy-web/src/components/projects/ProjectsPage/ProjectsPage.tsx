"use client";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight, FolderPlus, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { canManageProjects } from "@src/components/organizations/organizationAccess";
import { NotFoundPage } from "@src/components/shared/NotFoundPage/NotFoundPage";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { useOrganizationActivitiesQuery } from "@src/queries/useOrganizationActivitiesQuery";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { Project, ProjectDeploymentPreview } from "@src/types/project";
import { pluralize } from "@src/utils/stringUtils";
import { UrlService } from "@src/utils/urlUtils";
import { NewProjectModal } from "../NewProjectModal/NewProjectModal";
import { ProjectFolder } from "../ProjectFolder/ProjectFolder";
import { ProjectFolderMenu } from "../ProjectFolderMenu/ProjectFolderMenu";
import { isProjectListed } from "../projectSummary";
import { RecentActivityFeed } from "../RecentActivityFeed/RecentActivityFeed";
import { SectionLabel } from "../SectionLabel/SectionLabel";
import styles from "./ProjectsPage.module.css";

export const DEPENDENCIES = {
  useFlag,
  useRouter,
  useActiveOrganization,
  useProjectsQuery,
  useOrganizationActivitiesQuery,
  useNewDeploymentUrl,
  Layout,
  NotFoundPage,
  ProjectFolder,
  ProjectFolderMenu,
  RecentActivityFeed,
  NewProjectModal
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

/** A team organization's landing page: its projects as folders, most recently active first, next to what happened lately. */
export function ProjectsPage({ dependencies: d = DEPENDENCIES }: Props) {
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { isLoading, projectsEnabled } = d.useActiveOrganization();

  if (!isOrganizationsEnabled) return <d.NotFoundPage />;
  if (isLoading) return <d.Layout background="dots" isLoading disableContainer />;
  if (!projectsEnabled) return <d.NotFoundPage />;
  return <ProjectsPageContent dependencies={d} />;
}

function ProjectsPageContent({ dependencies: d }: Required<Props>) {
  const router = d.useRouter();
  const { activeOrganization } = d.useActiveOrganization();
  const projectsQuery = d.useProjectsQuery();
  const activityFeed = d.useOrganizationActivitiesQuery();
  const newDeploymentUrl = d.useNewDeploymentUrl();
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const canManage = !!activeOrganization && canManageProjects(activeOrganization.role);
  const listedProjects = useMemo(() => (canManage ? projects.filter(isProjectListed) : projects), [canManage, projects]);
  const organizationName = activeOrganization?.name ?? "";
  const hasProjects = listedProjects.length > 0;
  const canDeployAnywhere = projects.some(project => project.access.canDeploy);
  const projectNames = projects.map(project => project.name.toLowerCase());

  const openProject = (project: Project) => router.push(UrlService.project(project.id));
  const openDeployment = (deployment: ProjectDeploymentPreview) => router.push(UrlService.deploymentDetails(deployment.dseq));
  const startDeploymentIn = (project: Project) => router.push(UrlService.newDeployment({ projectId: project.id }));
  const openNewProject = () => setIsCreatingProject(true);
  const closeNewProject = () => setIsCreatingProject(false);

  return (
    <d.Layout background="dots" isLoading={projectsQuery.isLoading} disableContainer>
      <NextSeo title="Projects" />

      <div className="flex flex-col md:h-page-viewport">
        <div className="flex min-h-[60px] shrink-0 items-center border-b border-border bg-background py-2">
          <div className="container flex flex-wrap items-center gap-3 px-4 sm:px-6">
            <h1 className="mr-auto whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.02em]">Projects</h1>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManage && (
                <Button variant="outline" size="md" className="gap-1.5 text-[13px]" onClick={openNewProject}>
                  <FolderPlus className="h-4 w-4" />
                  New project
                </Button>
              )}

              {hasProjects && canDeployAnywhere && (
                <Link
                  href={newDeploymentUrl()}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "h-auto gap-2 rounded-[10px] px-[18px] py-2.5 text-[13px] font-semibold",
                    styles.primaryPill
                  )}
                >
                  New deployment
                  <ArrowRight className="h-[15px] w-[15px]" />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <div className="container p-4 pb-8 sm:p-6">
            <div className={styles.split}>
              <div className={styles.content}>
                <section aria-label="All projects">
                  <SectionLabel
                    rightSlot={
                      hasProjects && <span className="whitespace-nowrap text-xs text-muted-foreground">{pluralize(listedProjects.length, "project")}</span>
                    }
                  >
                    All projects
                  </SectionLabel>

                  {projectsQuery.isError ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                      <p className="text-muted-foreground">Couldn&apos;t load projects.</p>
                      <Button variant="outline" size="sm" onClick={() => projectsQuery.refetch()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  ) : hasProjects ? (
                    <div className={styles.folderGrid}>
                      {listedProjects.map(project => (
                        <d.ProjectFolder
                          key={project.id}
                          project={project}
                          onOpen={() => openProject(project)}
                          onSelectDeployment={openDeployment}
                          onNewDeployment={project.access.canDeploy ? () => startDeploymentIn(project) : undefined}
                          menu={canManage && <d.ProjectFolderMenu project={project} takenNames={projectNames} />}
                        />
                      ))}
                    </div>
                  ) : (
                    projectsQuery.data && <EmptyProjects organizationName={organizationName} onNewProject={canManage ? openNewProject : undefined} />
                  )}
                </section>
              </div>

              <aside className="min-w-0">
                <d.RecentActivityFeed
                  activities={activityFeed.activities}
                  projects={projects}
                  hasMore={activityFeed.hasMore}
                  onShowMore={activityFeed.showMore}
                  isError={activityFeed.isError}
                  onRetry={activityFeed.retry}
                />
              </aside>
            </div>
          </div>
        </div>
      </div>

      {isCreatingProject && (
        <d.NewProjectModal organizationName={organizationName} existingSlugs={projectNames} onClose={closeNewProject} onCreated={closeNewProject} />
      )}
    </d.Layout>
  );
}

function EmptyProjects({ organizationName, onNewProject }: { organizationName: string; onNewProject?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">0 projects in {organizationName}</span>
      {onNewProject ? (
        <>
          <h2 className="text-xl font-semibold text-foreground">Create your first project</h2>
          <p className="mb-1.5 text-[13.5px] text-muted-foreground">A project groups the deployments behind one app or service.</p>
          <Button className={cn("h-auto gap-2 rounded-[10px] px-[18px] py-2.5 text-[13px] font-semibold", styles.primaryPill)} onClick={onNewProject}>
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-foreground">No projects to show</h2>
          <p className="text-[13.5px] text-muted-foreground">You don&apos;t have access to any project yet. Ask an owner or admin.</p>
        </>
      )}
    </div>
  );
}
