"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import {
  Button,
  buttonVariants,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { cn, copyTextToClipboard } from "@akashnetwork/ui/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, ChevronRight, Link2, RefreshCw, SlidersHorizontal, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { NotFoundPage } from "@src/components/shared/NotFoundPage/NotFoundPage";
import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import { TemplateVisibilityBadge } from "@src/components/templates/TemplateVisibilityBadge/TemplateVisibilityBadge";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useAddFavoriteTemplate, useRemoveFavoriteTemplate } from "@src/queries/useTemplateQuery";
import { useMarketplaceTemplate, useTemplateVersion, useTemplateVersions } from "@src/queries/useUserTemplateQueries";
import type { MarketplaceTemplate, TemplateVersionDetail, TemplateVersionSummary } from "@src/types/marketplace-template";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import { TemplateConfigurationTab } from "./TemplateConfigurationTab/TemplateConfigurationTab";
import { TemplateReadmeTab } from "./TemplateReadmeTab/TemplateReadmeTab";
import { TemplateSettingsTab } from "./TemplateSettingsTab/TemplateSettingsTab";
import { TemplateVersionsTab } from "./TemplateVersionsTab/TemplateVersionsTab";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  NotFoundPage,
  TemplateIcon,
  TemplateReadmeTab,
  TemplateConfigurationTab,
  TemplateVersionsTab,
  TemplateSettingsTab,
  useMarketplaceTemplate,
  useTemplateVersions,
  useTemplateVersion,
  useAddFavoriteTemplate,
  useRemoveFavoriteTemplate,
  useCustomUser,
  useSnackbar,
  useRouter
};

const TABS = ["readme", "configuration", "versions", "settings"] as const;
type Tab = (typeof TABS)[number];

const VIEWER_TABS: readonly Tab[] = TABS.filter(tab => tab !== "settings");

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const TAB_TRIGGER_CLASSES =
  "gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

export interface TemplatePageProps {
  id: string;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplatePage: FC<TemplatePageProps> = ({ id, dependencies: d = DEPENDENCIES }) => {
  const templateQuery = d.useMarketplaceTemplate(id);
  const template = templateQuery.data;
  const versionsQuery = d.useTemplateVersions(id, { enabled: !!template });
  const [selectedVersion, setSelectedVersion] = useState<number>();
  const currentVersion = template?.currentVersion ?? null;
  const shownVersionNumber = selectedVersion ?? currentVersion?.version;
  const isCurrentShown = shownVersionNumber === currentVersion?.version;
  const otherVersionQuery = d.useTemplateVersion(id, isCurrentShown ? undefined : shownVersionNumber);
  const shownVersion = isCurrentShown ? currentVersion : otherVersionQuery.data;
  const router = d.useRouter();
  const { user } = d.useCustomUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutateAsync: addFavorite } = d.useAddFavoriteTemplate(id);
  const { mutateAsync: removeFavorite } = d.useRemoveFavoriteTemplate(id);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean>();
  const [isChangingFavorite, setIsChangingFavorite] = useState(false);

  useEffect(
    function followFavoriteFromServer() {
      setFavoriteOverride(undefined);
    },
    [template?.isFavorite]
  );

  if (templateQuery.error instanceof ApiError && templateQuery.error.status === 404) return <d.NotFoundPage />;

  if (!template) {
    return (
      <d.Layout background="dots" isLoading={templateQuery.isLoading}>
        {templateQuery.isError && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="text-muted-foreground">Couldn&apos;t load this template.</p>
            <Button variant="outline" size="sm" onClick={() => templateQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
      </d.Layout>
    );
  }

  const tabs = template.canEdit ? TABS : VIEWER_TABS;
  const requestedTab = router.query.tab;
  const activeTab = tabs.find(tab => tab === requestedTab) ?? "readme";
  const isFavorite = favoriteOverride ?? template.isFavorite;
  const usageParts = describeUsage(template.usage);

  const changeTab = (tab: string) => {
    router.replace({ pathname: router.pathname, query: { ...router.query, tab } }, undefined, { shallow: true, scroll: false });
  };

  const toggleFavorite = async () => {
    if (isChangingFavorite) return;
    setIsChangingFavorite(true);
    try {
      await (isFavorite ? removeFavorite() : addFavorite());
      setFavoriteOverride(!isFavorite);
    } catch {
      enqueueSnackbar(<Snackbar title="Couldn't update your favorites" iconVariant="error" />, { variant: "error" });
    } finally {
      setIsChangingFavorite(false);
    }
  };

  const selectVersion = (version: number) => setSelectedVersion(version === currentVersion?.version ? undefined : version);

  const copyLink = async () => {
    const isCopied = await copyTextToClipboard(`${getBaseUrl()}${UrlService.template(id)}`);
    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Link copied" iconVariant="success" />, { variant: "success" });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the link" iconVariant="error" />, { variant: "error" });
    }
  };

  const renderShownVersion = (render: (version: TemplateVersionDetail) => ReactNode) => {
    if (shownVersion) return render(shownVersion);
    if (!currentVersion) return <TabNotice>This template has no saved version yet.</TabNotice>;
    if (otherVersionQuery.isLoading) {
      return (
        <div role="status" aria-label={`Loading v${shownVersionNumber}`} className="flex justify-center py-14">
          <Spinner size="medium" />
        </div>
      );
    }
    return <TabNotice>Couldn&apos;t load v{shownVersionNumber}.</TabNotice>;
  };

  return (
    <d.Layout background="dots" disableContainer>
      <d.NextSeo title={template.title} description={template.summary ?? undefined} />

      <div className="container px-4 pb-16 pt-6 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <li>
              <Link href={UrlService.templates()} className="transition-colors hover:text-foreground">
                Templates
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="truncate text-foreground">
              {template.title}
            </li>
          </ol>
        </nav>

        <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="min-w-[min(280px,100%)] flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted">
                <d.TemplateIcon icon={template.icon} className="h-5 w-5" />
              </span>
              <h1 className="min-w-0 break-words text-[26px] font-bold leading-tight tracking-tight">{template.title}</h1>
              <TemplateVisibilityBadge visibility={template.visibility} />
              {currentVersion && <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs">v{currentVersion.version} current</span>}
            </div>
            {template.summary && <p className="mt-3 max-w-3xl text-[15px] text-muted-foreground">{template.summary}</p>}
            {usageParts.length > 0 && <p className="mt-2 text-[13px] text-muted-foreground">{usageParts.join(" · ")}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {template.canEdit && versionsQuery.data && shownVersionNumber !== undefined && (
              <VersionPicker versions={versionsQuery.data} selected={shownVersionNumber} currentVersion={currentVersion?.version} onSelect={selectVersion} />
            )}
            {user && (
              <Button variant="outline" size="icon" aria-label="Favorite" aria-pressed={isFavorite} aria-busy={isChangingFavorite} onClick={toggleFavorite}>
                <Star className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} aria-hidden="true" />
              </Button>
            )}
            <Button variant="outline" size="icon" aria-label="Copy link" onClick={copyLink}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            {template.canEdit && (
              <Link
                href={UrlService.configureTemplate({ mode: "edit", userTemplateId: id })}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Edit configuration
              </Link>
            )}
            <Link
              href={UrlService.configureDeployment({ userTemplateId: id, templateVersion: shownVersionNumber })}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              Deploy
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={changeTab} className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-border">
            <TabsList className="flex h-auto justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger value="readme" className={TAB_TRIGGER_CLASSES}>
                README
              </TabsTrigger>
              <TabsTrigger value="configuration" className={TAB_TRIGGER_CLASSES}>
                Configuration
              </TabsTrigger>
              <TabsTrigger value="versions" className={TAB_TRIGGER_CLASSES}>
                Versions {versionsQuery.data && <span className="rounded-full bg-muted px-1.5 font-mono text-xs">{versionsQuery.data.length}</span>}
              </TabsTrigger>
              {template.canEdit && (
                <TabsTrigger value="settings" className={TAB_TRIGGER_CLASSES}>
                  Settings
                </TabsTrigger>
              )}
            </TabsList>
            {template.canEdit && (
              <p className="py-2 text-[12.5px] text-muted-foreground">
                Edit configuration and Settings show only to members of {template.publisher?.name ?? "your organization"}
              </p>
            )}
          </div>

          <TabsContent value="readme" className="mt-5">
            {renderShownVersion(version => (
              <d.TemplateReadmeTab key={version.version} templateId={id} version={version} canEdit={template.canEdit && isCurrentShown} />
            ))}
          </TabsContent>
          <TabsContent value="configuration" className="mt-5">
            {renderShownVersion(version => (
              <d.TemplateConfigurationTab version={version} />
            ))}
          </TabsContent>
          <TabsContent value="versions" className="mt-5">
            {versionsQuery.data ? (
              <d.TemplateVersionsTab
                templateId={id}
                versions={versionsQuery.data}
                currentVersion={currentVersion?.version}
                shownVersion={shownVersionNumber}
                canEdit={template.canEdit}
                onView={selectVersion}
              />
            ) : versionsQuery.isError ? (
              <TabNotice>Couldn&apos;t load the versions.</TabNotice>
            ) : (
              <div role="status" aria-label="Loading versions" className="flex justify-center py-14">
                <Spinner size="medium" />
              </div>
            )}
          </TabsContent>
          {template.canEdit && (
            <TabsContent value="settings" className="mt-5">
              <d.TemplateSettingsTab template={template} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </d.Layout>
  );
};

const VersionPicker: FC<{
  versions: TemplateVersionSummary[];
  selected: number;
  currentVersion: number | undefined;
  onSelect: (version: number) => void;
}> = ({ versions, selected, currentVersion, onSelect }) => (
  <Select value={String(selected)} onValueChange={value => onSelect(Number(value))}>
    <SelectTrigger aria-label="Version" className="h-9 w-[150px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {versions.map(({ version }) => (
        <SelectItem key={version} value={String(version)}>
          <span className="font-mono">v{version}</span>
          {version === currentVersion && <span className="ml-2 rounded-md border border-border px-1.5 text-xs text-muted-foreground"> Current</span>}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const TabNotice: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="rounded-[14px] border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">{children}</p>
);

function describeUsage(usage: MarketplaceTemplate["usage"]): string[] {
  const parts: string[] = [];
  if (usage.deploys > 0) parts.push(`${NUMBER_FORMAT.format(usage.deploys)} ${usage.deploys === 1 ? "deploy" : "deploys"}`);
  if (usage.stillUpAfter24h !== null) parts.push(`${Math.round(usage.stillUpAfter24h * 100)}% still up after 24 h`);
  if (usage.lastDeployedAt) parts.push(`Last deployed ${formatDistanceToNowStrict(new Date(usage.lastDeployedAt), { addSuffix: true })}`);
  return parts;
}
