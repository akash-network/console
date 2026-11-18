"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Label,
  LoadingButton,
  RadioGroup,
  RadioGroupItem,
  Snackbar,
  Spinner
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { Building2, CircleAlert, Folder, Globe } from "lucide-react";
import { useSnackbar } from "notistack";

import { describeTemplateRefusal } from "@src/components/templates/describeTemplateRefusal";
import { SUPPORT_EMAIL } from "@src/config/ui.config";
import { useServices } from "@src/context/ServicesProvider";
import { useRunWhenEmailVerified } from "@src/hooks/useEmailVerificationRequiredEventHandler";
import { usePublishTemplateMutation, useTemplatePublishReadiness, useUpdateTemplateSettingsMutation } from "@src/queries/useUserTemplateQueries";
import type { MarketplaceTemplate, TemplateVisibility } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";
import type { PublishOrganization } from "../publishReadiness";
import { countPublishBlockers } from "../publishReadiness";
import type { PublishFixLinks } from "../PublishReadinessPanel/PublishReadinessPanel";
import { PublishReadinessPanel } from "../PublishReadinessPanel/PublishReadinessPanel";
import type { PublishRefusal } from "../readPublishRefusal";
import { readPublishRefusal } from "../readPublishRefusal";
import { ShareOutsideSection } from "../ShareOutsideSection/ShareOutsideSection";

export const DEPENDENCIES = {
  PublishReadinessPanel,
  ShareOutsideSection,
  useTemplatePublishReadiness,
  usePublishTemplateMutation,
  useUpdateTemplateSettingsMutation,
  useRunWhenEmailVerified,
  useSnackbar
};

const VERIFY_EMAIL_MESSAGE = "Verify your email to make a template public.";

const NO_LONGER_ALLOWED = "You can no longer change this template.";

const VISIBILITY_ICONS: Record<TemplateVisibility, LucideIcon> = { private: Folder, organization: Building2, public: Globe };

const VISIBILITY_TITLES: Record<TemplateVisibility, string> = { private: "Private", organization: "Organization", public: "Public" };

const VISIBILITIES: readonly TemplateVisibility[] = ["private", "organization", "public"];

type MembersOnlyVisibility = Exclude<TemplateVisibility, "public">;

type SharingState = Pick<MarketplaceTemplate, "visibility" | "isListed" | "moderationStatus">;

export type SharedTemplate = SharingState & {
  id: string;
  title: string;
  canEdit: boolean;
  currentVersion: { version: number } | null;
};

export interface ShareTemplateDialogProps {
  template: SharedTemplate;
  organization: PublishOrganization | null;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const ShareTemplateDialog: FC<ShareTemplateDialogProps> = ({ template, organization, onClose, dependencies: d = DEPENDENCIES }) => {
  const { publicConfig } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const runWhenEmailVerified = d.useRunWhenEmailVerified();
  const { mutateAsync: publish, isPending: isPublishing } = d.usePublishTemplateMutation();
  const { mutateAsync: updateSettings, isPending: isChangingVisibility } = d.useUpdateTemplateSettingsMutation();
  const [savedState, setSavedState] = useState<SharingState>();
  const sharing = savedState ?? template;
  const [selected, setSelected] = useState<TemplateVisibility>(sharing.visibility);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isConfirmingUnpublish, setIsConfirmingUnpublish] = useState(false);
  const [failure, setFailure] = useState<string>();

  const isPublic = sharing.visibility === "public";
  const isActive = sharing.moderationStatus === "active";
  const isInGallery = isPublic && sharing.isListed && isActive;
  const isPublishOffered = template.canEdit && selected === "public" && isActive && !isInGallery;
  const readinessQuery = d.useTemplatePublishReadiness(template.id, { enabled: isPublishOffered });
  const readiness = isPublishOffered ? readinessQuery.data : undefined;
  const isRunningChecks = readinessQuery.isFetching;
  const blockerCount = readiness ? countPublishBlockers(readiness) : 0;
  const canPublish = !!readiness?.canPublish && hasAcceptedTerms && !isRunningChecks && !isPublishing;
  const pendingVisibility = selected !== "public" && selected !== sharing.visibility ? selected : undefined;
  const isBusy = isPublishing || isChangingVisibility;
  const supportUrl = publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL || `mailto:${SUPPORT_EMAIL}`;
  const fixLinks: PublishFixLinks = {
    rename: `${UrlService.template(template.id)}?tab=settings`,
    "rename-organization": organization?.type === "team" ? UrlService.organizationSettings() : undefined,
    "edit-configuration": UrlService.configureTemplate({ mode: "edit", userTemplateId: template.id, baseVersion: template.currentVersion?.version })
  };

  const runChecksAgain = () => void readinessQuery.refetch();

  const selectVisibility = (visibility: TemplateVisibility) => {
    setSelected(visibility);
    setFailure(undefined);
  };

  const makePublic = async () => {
    if (!readiness) return;
    setFailure(undefined);

    try {
      const response = await publish({ id: template.id, data: { acceptedTermsVersion: readiness.termsVersion } });
      setSavedState(response.data);
      enqueueSnackbar(<Snackbar title="The template is public" subTitle="It's in the gallery now." iconVariant="success" />, { variant: "success" });
    } catch (error) {
      const refusal = readPublishRefusal(error);
      setFailure(describePublishFailure(refusal));
      if (refusal?.kind === "terms_changed") setHasAcceptedTerms(false);
      if (isAnsweredByNewChecks(refusal)) runChecksAgain();
    }
  };

  const changeVisibility = async (visibility: MembersOnlyVisibility) => {
    setFailure(undefined);

    try {
      const response = await updateSettings({ id: template.id, data: { visibility } });
      setSavedState(response.data);
      setHasAcceptedTerms(false);
      enqueueSnackbar(<Snackbar title={visibility === "private" ? "The template is private" : "Shared with your organization"} iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      setFailure(describeTemplateRefusal(error) ?? (readPublishRefusal(error)?.kind === "not_allowed" ? NO_LONGER_ALLOWED : "Try again in a moment."));
    } finally {
      setIsConfirmingUnpublish(false);
    }
  };

  const requestVisibilityChange = (visibility: MembersOnlyVisibility) => {
    if (isPublic) {
      setIsConfirmingUnpublish(true);
      return;
    }
    void changeVisibility(visibility);
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isBusy ? onClose() : undefined)}>
      <DialogV2Content className="max-w-2xl" hideCloseButton={isBusy}>
        <DialogV2Header>
          <DialogV2Title className="break-words leading-snug">Share {template.title}</DialogV2Title>
          <DialogV2Description>{template.canEdit ? "Choose who can find and deploy it." : "Send the link to anyone who should deploy it."}</DialogV2Description>
        </DialogV2Header>

        {isConfirmingUnpublish && pendingVisibility ? (
          <>
            <DialogV2Body className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Take it out of the gallery?</p>
              <p className="text-sm text-muted-foreground">
                The template leaves the gallery and its link stops working for anyone outside {describeAudience(pendingVisibility, organization)}. Deployments
                and forks made from it keep working.
              </p>
            </DialogV2Body>
            <DialogV2Footer className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" disabled={isChangingVisibility} onClick={() => setIsConfirmingUnpublish(false)}>
                Keep it public
              </Button>
              <LoadingButton type="button" loading={isChangingVisibility} disabled={isChangingVisibility} onClick={() => changeVisibility(pendingVisibility)}>
                {CHANGE_LABELS[pendingVisibility]}
              </LoadingButton>
            </DialogV2Footer>
          </>
        ) : (
          <>
            <DialogV2Body className="flex flex-col gap-5">
              {template.canEdit && (
                <RadioGroup
                  aria-label="Who can find and deploy it"
                  value={selected}
                  onValueChange={value => selectVisibility(value as TemplateVisibility)}
                  disabled={isBusy}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {VISIBILITIES.map(visibility => (
                    <VisibilityCard
                      key={visibility}
                      visibility={visibility}
                      isSelected={visibility === selected}
                      isCurrent={visibility === sharing.visibility}
                      description={describeVisibility(visibility, organization)}
                    />
                  ))}
                </RadioGroup>
              )}

              {failure && (
                <Alert variant="destructive">
                  <AlertDescription className="break-words">{failure}</AlertDescription>
                </Alert>
              )}

              {template.canEdit && selected === "public" && (
                <PublicState sharing={sharing} supportUrl={supportUrl}>
                  {isPublishOffered &&
                    (readiness ? (
                      <d.PublishReadinessPanel
                        readiness={readiness}
                        organization={organization}
                        isRunning={isRunningChecks}
                        hasAcceptedTerms={hasAcceptedTerms}
                        fixLinks={fixLinks}
                        supportUrl={supportUrl}
                        onRunAgain={runChecksAgain}
                        onAcceptedTermsChange={setHasAcceptedTerms}
                        onVerifyEmail={() => runWhenEmailVerified(VERIFY_EMAIL_MESSAGE, runChecksAgain)}
                        onCreditsAdded={runChecksAgain}
                        onFollowFix={onClose}
                      />
                    ) : readinessQuery.isError ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
                        <p className="text-sm text-muted-foreground">Couldn&apos;t run the publish checks.</p>
                        <Button type="button" variant="outline" size="sm" onClick={runChecksAgain}>
                          Try again
                        </Button>
                      </div>
                    ) : (
                      <div role="status" aria-label="Running the publish checks" className="flex justify-center py-8">
                        <Spinner size="medium" />
                      </div>
                    ))}
                </PublicState>
              )}

              {pendingVisibility && isPublic && (
                <p className="text-[13px] text-muted-foreground">
                  This takes it out of the gallery and turns off its public link. Deployments and forks made from it keep working.
                </p>
              )}

              <d.ShareOutsideSection templateId={template.id} hasBadge={isPublic && isActive} />
            </DialogV2Body>

            <DialogV2Footer className="flex flex-wrap items-center justify-end gap-2">
              {isPublishOffered && blockerCount > 0 && (
                <p className="mr-auto flex items-center gap-1.5 text-[13px] text-destructive">
                  <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Fix {blockerCount} {blockerCount === 1 ? "item" : "items"} to make it public
                </p>
              )}
              <Button type="button" variant="ghost" disabled={isBusy} onClick={onClose}>
                {isPublishOffered || pendingVisibility ? "Cancel" : "Done"}
              </Button>
              {isPublishOffered && (
                <LoadingButton type="button" loading={isPublishing} disabled={!canPublish} onClick={makePublic}>
                  {isPublic ? "Add to gallery" : "Make public"}
                </LoadingButton>
              )}
              {pendingVisibility && (
                <LoadingButton
                  type="button"
                  loading={isChangingVisibility}
                  disabled={isChangingVisibility}
                  onClick={() => requestVisibilityChange(pendingVisibility)}
                >
                  {CHANGE_LABELS[pendingVisibility]}
                </LoadingButton>
              )}
            </DialogV2Footer>
          </>
        )}
      </DialogV2Content>
    </DialogV2>
  );
};

const CHANGE_LABELS: Record<MembersOnlyVisibility, string> = { private: "Make private", organization: "Share with organization only" };

const VisibilityCard: FC<{ visibility: TemplateVisibility; isSelected: boolean; isCurrent: boolean; description: string }> = ({
  visibility,
  isSelected,
  isCurrent,
  description
}) => {
  const Icon = VISIBILITY_ICONS[visibility];
  const id = `share-visibility-${visibility}`;

  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border p-3.5 transition-colors", isSelected ? "border-foreground" : "border-border")}>
      <RadioGroupItem id={id} value={visibility} className="mt-0.5 shrink-0" />
      <Label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {VISIBILITY_TITLES[visibility]}
          {isCurrent && <span className="rounded-md border border-border px-1.5 text-[11px] font-medium text-muted-foreground">Current</span>}
        </span>
        <span className="break-words text-[13px] font-normal leading-snug text-muted-foreground">{description}</span>
      </Label>
    </div>
  );
};

const PublicState: FC<{ sharing: SharingState; supportUrl: string; children: ReactNode }> = ({ sharing, supportUrl, children }) => {
  if (sharing.moderationStatus !== "active") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Akash hid this template, so it stays out of the gallery and nobody outside your organization can open it.{" "}
          <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Contact support
          </a>
        </AlertDescription>
      </Alert>
    );
  }
  if (sharing.visibility !== "public") return <>{children}</>;

  return (
    <>
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        {sharing.isListed ? (
          <>
            <span className="font-semibold">In the gallery.</span> Anyone can find, deploy and fork it.
          </>
        ) : (
          <>
            <span className="font-semibold">Public by link, but not in the gallery.</span> It went public before publish checks existed. Pass the checks and
            accept the terms to list it.
          </>
        )}
      </p>
      {children}
    </>
  );
};

function describeVisibility(visibility: TemplateVisibility, organization: PublishOrganization | null): string {
  const isTeam = organization?.type === "team";
  if (visibility === "private") return "Members of its project.";
  if (visibility === "organization") return isTeam ? `Everyone in ${organization.name}.` : "Everyone in your organization.";
  return `In the gallery under ${isTeam ? organization.name : "your name"}. Anyone can deploy and fork it.`;
}

function describeAudience(visibility: MembersOnlyVisibility, organization: PublishOrganization | null): string {
  if (visibility === "private") return "its project";
  return organization?.type === "team" ? organization.name : "your organization";
}

function isAnsweredByNewChecks(refusal: PublishRefusal | undefined): boolean {
  return refusal?.kind === "requirements_unmet" || refusal?.kind === "checks_failed" || refusal?.kind === "terms_changed";
}

function describePublishFailure(refusal: PublishRefusal | undefined): string {
  switch (refusal?.kind) {
    case "requirements_unmet":
      return "A requirement is no longer met. The list below shows what changed.";
    case "checks_failed":
      return "A publish check no longer passes. The list below shows what changed.";
    case "terms_changed":
      return "The community template terms changed. Read the new terms and accept them again.";
    case "rate_limited":
      return refusal.message;
    case "not_allowed":
      return NO_LONGER_ALLOWED;
    default:
      return "Couldn't make it public. Try again in a moment.";
  }
}
