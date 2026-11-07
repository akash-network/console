"use client";
import type { ChangeEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import {
  Button,
  buttonVariants,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn, copyTextToClipboard } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { Building2, ChevronRight, Copy, Ellipsis, ExternalLink, Folder, Globe, Link2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { ImportSdlButton } from "@src/components/new-deployment/ImportSdlButton/ImportSdlButton";
import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import { SUPPORT_EMAIL } from "@src/config/ui.config";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { useDeleteMarketplaceTemplateMutation, useMyTemplates } from "@src/queries/useUserTemplateQueries";
import type { TemplateVisibility, UserTemplateListItem } from "@src/types/marketplace-template";
import type { Project } from "@src/types/project";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import type { TemplateStatus } from "./templateStatus";
import { TEMPLATE_STATUS_LABELS, templateStatusOf } from "./templateStatus";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  ImportSdlButton,
  useMyTemplates,
  useDeleteMarketplaceTemplateMutation,
  useActiveOrganization,
  useProjectsQuery,
  usePopup,
  useSnackbar
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

type Filters = {
  projectId: string | null;
  search: string;
  visibility: TemplateVisibility | null;
  status: string | null;
};

const ANY = "any";
const EMPTY_CELL = "–";
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const VISIBILITY_LABELS: Record<TemplateVisibility, string> = { private: "Private", organization: "Organization", public: "Public" };
const VISIBILITY_ICONS: Record<TemplateVisibility, typeof Globe> = { private: Folder, organization: Building2, public: Globe };

const STATUS_TONE_CLASSES: Record<TemplateStatus["tone"], { text: string; dot?: string }> = {
  neutral: { text: "text-muted-foreground" },
  success: { text: "text-green-700 dark:text-green-500", dot: "bg-green-600" },
  warning: { text: "text-amber-700 dark:text-amber-500", dot: "bg-amber-500" },
  danger: { text: "text-red-600 dark:text-red-500", dot: "bg-red-600" }
};

const VISIBILITY_OPTIONS = Object.entries(VISIBILITY_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = TEMPLATE_STATUS_LABELS.map(label => ({ value: label, label }));

const FILTER_TRIGGER_CLASSES = "w-full gap-1 sm:w-[180px]";

export function MyTemplates({ dependencies: d = DEPENDENCIES }: Props) {
  const templatesQuery = d.useMyTemplates();
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const { data: projects } = d.useProjectsQuery({ enabled: projectsEnabled });
  const { mutateAsync: deleteTemplate } = d.useDeleteMarketplaceTemplateMutation();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const { publicConfig } = useServices();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ projectId: null, search: "", visibility: null, status: null });

  const templates = useMemo(() => (templatesQuery.data ?? []).filter(template => !deletedIds.includes(template.id)), [templatesQuery.data, deletedIds]);
  const visibleTemplates = useMemo(() => filterTemplates(templates, filters), [templates, filters]);
  const organizationName = activeOrganization?.name;

  const changeFilters = (change: Partial<Filters>) => setFilters(current => ({ ...current, ...change }));

  const confirmAndDelete = async (template: UserTemplateListItem) => {
    const isConfirmed = await confirm({
      title: `Delete ${template.title}?`,
      message: "The template and all its versions are deleted for everyone in the organization. Deployments made from it keep running."
    });
    if (!isConfirmed) return;

    try {
      await deleteTemplate({ id: template.id });
      setDeletedIds(ids => [...ids, template.id]);
      enqueueSnackbar(<Snackbar title={`Deleted ${template.title}`} iconVariant="success" />, { variant: "success" });
    } catch {
      enqueueSnackbar(<Snackbar title="Couldn't delete the template" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const copyLink = async (template: UserTemplateListItem) => {
    const isCopied = await copyTextToClipboard(`${getBaseUrl()}${UrlService.template(template.id)}`);
    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Link copied" iconVariant="success" />, { variant: "success" });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the link" iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <d.Layout background="dots" isLoading={templatesQuery.isLoading} disableContainer>
      <d.NextSeo title="My templates" />

      <div className="flex flex-col">
        <div className="border-b border-border bg-background py-3">
          <div className="container flex flex-wrap items-end gap-3 px-4 sm:px-6">
            <div className="mr-auto flex flex-col gap-1">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                  <li>
                    <Link href={UrlService.templates()} className="transition-colors hover:text-foreground">
                      Templates
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li aria-current="page" className="text-foreground">
                    My templates
                  </li>
                </ol>
              </nav>
              <h1 className="text-xl font-bold leading-7 tracking-[-0.02em]">My templates</h1>
            </div>

            <div className="flex items-center gap-2">
              <d.ImportSdlButton configureUrl={draftId => UrlService.configureTemplate({ mode: "new", draftId })} />
              <Link href={UrlService.configureTemplate({ mode: "new" })} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New template
              </Link>
            </div>
          </div>
        </div>

        <div className="container flex flex-col gap-4 px-4 pb-8 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {projectsEnabled && organizationName && projects && (
              <ProjectTabs
                organizationName={organizationName}
                projects={projects}
                templates={templates}
                selectedProjectId={filters.projectId}
                onSelect={projectId => changeFilters({ projectId })}
              />
            )}

            <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
              <Input
                value={filters.search}
                onChange={(event: ChangeEvent<HTMLInputElement>) => changeFilters({ search: event.target.value })}
                aria-label="Search my templates"
                placeholder="Search my templates"
                type="text"
                className="w-full sm:w-[280px]"
                startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              />

              <FilterSelect
                label="Visibility"
                value={filters.visibility}
                options={VISIBILITY_OPTIONS}
                onChange={visibility => changeFilters({ visibility: visibility as TemplateVisibility | null })}
              />

              <FilterSelect label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={status => changeFilters({ status })} />
            </div>
          </div>

          {templatesQuery.isError ? (
            <Notice>
              <p className="text-muted-foreground">Couldn&apos;t load your templates.</p>
              <Button variant="outline" size="sm" onClick={() => templatesQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            </Notice>
          ) : templatesQuery.data && templates.length === 0 ? (
            <Notice>
              <p className="text-sm font-semibold">No templates yet</p>
              <p className="text-[13px] text-muted-foreground">Save a deployment as a template, or start a new one, to reuse it across your projects.</p>
            </Notice>
          ) : (
            templates.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead className="text-right">Deploys</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTemplates.map(template => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        supportUrl={publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL}
                        onCopyLink={() => copyLink(template)}
                        onDelete={() => confirmAndDelete(template)}
                      />
                    ))}
                  </TableBody>
                </Table>
                {visibleTemplates.length === 0 && <p className="px-6 py-10 text-center text-[13px] text-muted-foreground">No templates match these filters.</p>}
              </div>
            )
          )}

          <p className="text-[12.5px] text-muted-foreground">
            Private and Organization templates are only visible to members. Public templates are published under {organizationName ?? "your organization"}.
          </p>
        </div>
      </div>
    </d.Layout>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const labelId = useId();
  const valueId = useId();

  return (
    <Select value={value ?? ANY} onValueChange={selected => onChange(selected === ANY ? null : selected)}>
      <SelectTrigger aria-labelledby={`${labelId} ${valueId}`} className={FILTER_TRIGGER_CLASSES}>
        <span id={labelId} className="text-muted-foreground">
          {label}:
        </span>
        <SelectValue id={valueId} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Any</SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function filterTemplates(templates: UserTemplateListItem[], filters: Filters): UserTemplateListItem[] {
  const search = filters.search.trim().toLowerCase();

  return templates.filter(
    template =>
      (!filters.projectId || template.projectId === filters.projectId) &&
      (!search || `${template.title} ${template.summary ?? ""}`.toLowerCase().includes(search)) &&
      (!filters.visibility || template.visibility === filters.visibility) &&
      (!filters.status || templateStatusOf(template).label === filters.status)
  );
}

function ProjectTabs({
  organizationName,
  projects,
  templates,
  selectedProjectId,
  onSelect
}: {
  organizationName: string;
  projects: Project[];
  templates: UserTemplateListItem[];
  selectedProjectId: string | null;
  onSelect: (projectId: string | null) => void;
}) {
  const tabs = [
    { projectId: null, label: `All of ${organizationName}`, count: templates.length },
    ...projects.map(project => ({
      projectId: project.id,
      label: project.name,
      count: templates.filter(template => template.projectId === project.id).length
    }))
  ];

  return (
    <div role="group" aria-label="Projects" className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {tabs.map(tab => {
        const isSelected = tab.projectId === selectedProjectId;
        return (
          <button
            key={tab.projectId ?? "all"}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(tab.projectId)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              isSelected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.projectId && <Folder className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{tab.label}</span>
            <span className="font-mono text-xs text-muted-foreground">{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function TemplateRow({
  template,
  supportUrl,
  onCopyLink,
  onDelete
}: {
  template: UserTemplateListItem;
  supportUrl: string | undefined;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const status = templateStatusOf(template);
  const VisibilityIcon = VISIBILITY_ICONS[template.visibility];
  const toneClasses = STATUS_TONE_CLASSES[status.tone];

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <TemplateIcon icon={template.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link href={UrlService.template(template.id)} className="block truncate font-semibold text-foreground hover:underline">
              {template.title}
            </Link>
            {template.lastEditedBy && <p className="truncate text-[12.5px] text-muted-foreground">Edited by {template.lastEditedBy.username}</p>}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
          <VisibilityIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {VISIBILITY_LABELS[template.visibility]}
        </span>
      </TableCell>
      <TableCell>
        <p className={cn("flex items-center gap-1.5 text-[13px] font-medium", toneClasses.text)}>
          {toneClasses.dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneClasses.dot)} aria-hidden="true" />}
          {status.label}
        </p>
        {status.reason && (
          <p className="text-[12.5px] text-muted-foreground">
            {status.reason}
            {status.nextStep === "contact-support" && (
              <>
                {" "}
                <a href={supportUrl || `mailto:${SUPPORT_EMAIL}`} target="_blank" rel="noopener noreferrer" className="underline">
                  Contact support
                </a>
              </>
            )}
          </p>
        )}
      </TableCell>
      <TableCell className="font-mono text-[13px]">{template.currentVersion ? `v${template.currentVersion.version}` : EMPTY_CELL}</TableCell>
      <TableCell className="text-right font-mono text-[13px]">
        {template.usage.deploys > 0 ? NUMBER_FORMAT.format(template.usage.deploys) : EMPTY_CELL}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{format(new Date(template.updatedAt), "MMM d, yyyy")}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {template.canEdit && (
            <Link
              href={UrlService.configureTemplate({ mode: "edit", userTemplateId: template.id })}
              aria-label={`Edit ${template.title}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Link>
          )}
          <TemplateActionsMenu template={template} onCopyLink={onCopyLink} onDelete={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TemplateActionsMenu({ template, onCopyLink, onDelete }: { template: UserTemplateListItem; onCopyLink: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Actions for ${template.title}`} size="icon" variant="ghost" className="h-8 w-8 rounded-full">
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={UrlService.template(template.id)}>
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
            Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyLink}>
          <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Copy link
        </DropdownMenuItem>
        {template.canEdit && (
          <>
            <DropdownMenuItem asChild>
              <Link href={UrlService.configureTemplate({ mode: "new", copyFromTemplateId: template.id, copyFromVersion: template.currentVersion?.version })}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Duplicate
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete template
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">{children}</div>;
}
