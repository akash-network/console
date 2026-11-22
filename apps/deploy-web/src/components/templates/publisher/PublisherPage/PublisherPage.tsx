"use client";
import type { ChangeEvent, FC } from "react";
import { useCallback, useMemo, useState } from "react";
import { Button, buttonVariants, Input, Spinner } from "@akashnetwork/ui/components";
import { ArrowLeft, CalendarDays, Pencil, RefreshCw, Search, User, Users, X } from "lucide-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { GALLERY_SORT_LABELS, GallerySortControl } from "@src/components/templates/communityGallery/GalleryControls/GalleryControls";
import { buildGalleryEntries, filterGalleryEntries, sortGalleryEntries } from "@src/components/templates/communityGallery/galleryEntries";
import { GalleryEntryList } from "@src/components/templates/communityGallery/GalleryEntryList/GalleryEntryList";
import { PublisherInitials, VerifiedPublisherMark } from "@src/components/templates/communityGallery/PublisherName/PublisherName";
import { formatCount, pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import { formatCalendarMonth } from "@src/components/templates/marketplaceDates/marketplaceDates";
import { buildPublisherSeo } from "@src/components/templates/marketplaceSeo/marketplaceSeo";
import { EditPublisherProfileDialog } from "@src/components/templates/publisher/EditPublisherProfileDialog/EditPublisherProfileDialog";
import { PublisherLinkList } from "@src/components/templates/publisher/PublisherLinkList/PublisherLinkList";
import type { GalleryUrlState } from "@src/components/templates/useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { useTemplateGalleryUrlState } from "@src/components/templates/useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useCurrentTemplatePublisher, useTemplatePublisher } from "@src/queries/useUserTemplateQueries";
import { isClientError } from "@src/services/query-error-policy/query-error-policy";
import type { CurrentTemplatePublisher, TemplatePublisherPage } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  GalleryEntryList,
  PublisherLinkList,
  EditPublisherProfileDialog,
  useTemplatePublisher,
  useCurrentTemplatePublisher,
  useTemplateGalleryUrlState,
  useCustomUser
};

export const PUBLIC_PAGE_BEHIND_NOTICE = "Your profile changes are saved. The public page can take a couple of minutes to show them.";

const PUBLISHER_TYPE_LABELS: Record<TemplatePublisherPage["type"], string> = { personal: "Personal", team: "Team" };
const PUBLISHER_TYPE_ICONS = { personal: User, team: Users };

const NO_AWESOME_AKASH_CATEGORIES: never[] = [];
const NO_OFFICIAL_USAGE = {};

const CHIP_CLASSES = "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground";

export interface PublisherPageProps {
  handle: string;
  dependencies?: typeof DEPENDENCIES;
}

export const PublisherPage: FC<PublisherPageProps> = ({ handle, dependencies: d = DEPENDENCIES }) => {
  const publisherQuery = d.useTemplatePublisher(handle);
  const publisher = publisherQuery.data;
  const { user } = d.useCustomUser();
  const ownProfileQuery = d.useCurrentTemplatePublisher({ enabled: !!user });
  const toPublisherUrl = useCallback((state: GalleryUrlState) => UrlService.templatePublisher(handle, { search: state.search, sort: state.sort }), [handle]);
  const urlState = d.useTemplateGalleryUrlState(undefined, toPublisherUrl);
  /** Held apart from the viewer's own profile, which goes away when the session ends: the open form must outlive that to say so and keep what was typed. */
  const [profileBeingEdited, setProfileBeingEdited] = useState<CurrentTemplatePublisher>();

  const templates = publisher?.templates;
  const entries = useMemo(
    () => buildGalleryEntries({ categories: NO_AWESOME_AKASH_CATEGORIES, community: templates && { templates, officialUsage: NO_OFFICIAL_USAGE } }),
    [templates]
  );
  const sortedEntries = useMemo(() => sortGalleryEntries(entries, urlState.sort), [entries, urlState.sort]);
  const shownEntries = useMemo(
    () => filterGalleryEntries(sortedEntries, { source: "all", category: null, search: urlState.search }),
    [sortedEntries, urlState.search]
  );
  const hasCommunityTemplates = useMemo(() => entries.some(entry => !entry.isOfficial), [entries]);

  if (isClientError(publisherQuery.error)) return <PublisherNotFound dependencies={d} />;

  if (!publisher) {
    return (
      <d.Layout background="dots" isLoading={publisherQuery.isLoading}>
        {publisherQuery.isLoading && (
          <div role="status" aria-label="Loading publisher" className="flex justify-center py-12">
            <Spinner size="large" />
          </div>
        )}
        {publisherQuery.isError && <PublisherReadFailed message="Couldn't load this publisher." className="py-14" onRetry={() => publisherQuery.refetch()} />}
      </d.Layout>
    );
  }

  const ownProfile = user && ownProfileQuery.data?.handle === publisher.handle ? ownProfileQuery.data : undefined;
  const profile = ownProfile ?? publisher;
  const isPublicPageBehind = !!ownProfile && !isSameProfile(ownProfile, publisher);
  const TypeIcon = PUBLISHER_TYPE_ICONS[publisher.type];
  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => urlState.changeSearch(event.target.value);

  return (
    <d.Layout background="dots" disableContainer>
      <d.NextSeo {...buildPublisherSeo(publisher, { isOwnProfile: !!ownProfile })} />

      <div className="container flex flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
        <Link
          href={UrlService.templates()}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Templates
        </Link>

        <header className="flex flex-wrap items-start gap-x-8 gap-y-5 rounded-[14px] border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
          <div className="flex min-w-[min(280px,100%)] flex-1 items-start gap-4">
            <PublisherInitials name={publisher.name} className="h-14 w-14 rounded-xl text-lg sm:h-16 sm:w-16 sm:text-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-[26px] font-bold leading-tight tracking-tight">{publisher.name}</h1>
                {publisher.verified && <VerifiedPublisherMark className="h-5 w-5" />}
                <span className={CHIP_CLASSES}>
                  <TypeIcon className="h-3 w-3" aria-hidden="true" />
                  {PUBLISHER_TYPE_LABELS[publisher.type]}
                </span>
                <span className={CHIP_CLASSES}>Community publisher</span>
              </div>
              {profile.bio && <p className="max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground/90">{profile.bio}</p>}
              <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5">
                <d.PublisherLinkList links={profile.links} />
                <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Member since {formatCalendarMonth(publisher.memberSince)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <dl className="flex items-stretch divide-x divide-border">
              <PublisherCount label="Templates" count={publisher.counts.templates} />
              <PublisherCount label="Total deploys" count={publisher.counts.deploys} />
            </dl>
            {ownProfile?.canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setProfileBeingEdited(ownProfile)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit profile
              </Button>
            )}
          </div>

          {isPublicPageBehind && (
            <p role="status" className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
              {PUBLIC_PAGE_BEHIND_NOTICE}
            </p>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={urlState.search}
            onChange={changeSearch}
            aria-label="Search this publisher's templates"
            placeholder="Search these templates"
            type="text"
            className="w-full sm:max-w-[380px]"
            startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            endIcon={
              !!urlState.search && (
                <Button size="icon" variant="text" aria-label="Clear search" onClick={urlState.clearSearch}>
                  <X className="h-4 w-4" />
                </Button>
              )
            }
          />
          <div className="flex items-center gap-2.5 sm:ml-auto">
            <span className="text-[13px] text-muted-foreground">Sort</span>
            <GallerySortControl selected={urlState.sort} onSelect={urlState.selectSort} />
          </div>
        </div>

        {publisherQuery.isError && (
          <PublisherReadFailed message="Couldn't load all of this publisher's templates." className="pb-6" onRetry={() => publisherQuery.refetch()} />
        )}

        <d.GalleryEntryList
          key={`${urlState.sort}|${urlState.search}`}
          title={`${pluralize(entries.length, "template")} · ${GALLERY_SORT_LABELS[urlState.sort]}`}
          entries={shownEntries}
          search={urlState.search}
          showsCommunityNote={hasCommunityTemplates}
          emptyHint={urlState.search.trim() ? "Try a different search." : "This publisher lists no templates right now."}
          linksPublishers={false}
        />
      </div>

      {profileBeingEdited && <d.EditPublisherProfileDialog profile={profileBeingEdited} onClose={() => setProfileBeingEdited(undefined)} />}
    </d.Layout>
  );
};

const PublisherReadFailed: FC<{ message: string; className: string; onRetry: () => void }> = ({ message, className, onRetry }) => (
  <div role="alert" className={`flex flex-col items-center gap-2 text-center ${className}`}>
    <p className="text-muted-foreground">{message}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
      Retry
    </Button>
  </div>
);

const PublisherNotFound: FC<{ dependencies: typeof DEPENDENCIES }> = ({ dependencies: d }) => (
  <d.Layout background="dots">
    <d.NextSeo title="Publisher not found" noindex />
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Publisher not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">There is no publisher page at this address.</p>
      <Link href={UrlService.templates()} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Browse templates
      </Link>
    </div>
  </d.Layout>
);

const PublisherCount: FC<{ label: string; count: number }> = ({ label, count }) => (
  <div className="flex flex-col gap-1 px-5 first:pl-0 last:pr-0">
    <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
    <dd className="text-xl font-bold leading-none tracking-tight">{formatCount(count)}</dd>
  </div>
);

function isSameProfile(own: Pick<CurrentTemplatePublisher, "bio" | "links">, shown: Pick<TemplatePublisherPage, "bio" | "links">): boolean {
  return (
    own.bio === shown.bio &&
    own.links.length === shown.links.length &&
    own.links.every((link, index) => link.url === shown.links[index].url && link.label === shown.links[index].label)
  );
}
