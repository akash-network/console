"use client";
import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useAtomValue } from "jotai";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { DeployTargetGate } from "@src/components/projects/DeployTargetGate/DeployTargetGate";
import { useTakeAutoDeployStart } from "@src/hooks/useAutoDeployStart/useAutoDeployStart";
import { useFlag } from "@src/hooks/useFlag";
import { usePublicTemplate, useTemplate } from "@src/queries/useTemplateQuery";
import { useMarketplaceTemplate, useTemplateVersion } from "@src/queries/useUserTemplateQueries";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { secretReferenceNamesIn } from "@src/utils/sdl/sdlSecrets";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import { AutoDeployFlow } from "../AutoDeployFlow/AutoDeployFlow";
import { ConfigureDeploymentForm } from "../ConfigureDeploymentForm/ConfigureDeploymentForm";
import { DeploymentFlowProvider } from "../DeploymentFlowProvider/DeploymentFlowProvider";
import { ResumeDeploymentGuard } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import { ConfigureTemplateForm } from "../templateMode/ConfigureTemplateForm/ConfigureTemplateForm";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { parseDeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  AutoDeployFlow,
  ConfigureDeploymentForm,
  ConfigureTemplateForm,
  DeploymentFlowProvider,
  ResumeDeploymentGuard,
  DeployTargetGate,
  usePublicTemplate,
  useUserTemplate: useTemplate,
  useMarketplaceTemplate,
  useTemplateVersion,
  useFlag,
  useRouter,
  useConfigureDraft,
  useTakeAutoDeployStart,
  useSearchParams,
  useParams,
  useSnackbar,
  Snackbar
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Resolves the SDL the Configure screen starts from, then hands it to the form. The draft session (see
 * `useConfigureDraft`) identifies a started session by a `draftId`: when present its persisted working SDL is restored
 * and the template is ignored; when absent an id is minted and written into the URL so a reload resumes the same draft.
 * Without a draft, a `templateId` is resolved the same way the legacy flow does: hardcoded templates (e.g. hello-world)
 * carry their SDL inline and are matched by code, while everything else is fetched as a public gallery template. A
 * `userTemplateId` instead fetches the viewer's own saved template, which the API answers with an empty body when it
 * isn't theirs to see — surfaced as the same "couldn't load" fallback as a failed request. With neither, the carried-in
 * `deploySdl` atom is used, except on a `vm=true` or `exampleImage=true` entry, which ignores the atom so a fresh
 * Container-VM or example image session always seeds deterministically. A resume none of those answer for starts the form from the definition the console recorded.
 * Keeping resolution here lets the form initialize synchronously from a single source — and lets a resume skip the
 * template fetch.
 */
export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const searchParams = d.useSearchParams();
  const routeParams = d.useParams();
  const dseqSegment = Array.isArray(routeParams?.dseq) ? routeParams.dseq[0] : (routeParams?.dseq as string | undefined);
  const isTemplateMarketplaceEnabled = d.useFlag("template_marketplace");
  const intent = parseDeploymentIntent(
    { dseqSegment, searchParams: new URLSearchParams(searchParams?.toString() ?? "") },
    { isTemplateModeEnabled: isTemplateMarketplaceEnabled }
  );
  const [hasStartedDeploying, setHasStartedDeploying] = useState(false);
  const autoDeployStart = d.useTakeAutoDeployStart(intent, { hasStartedDeploying });
  const session = useConfigureSession(intent.draftId);

  if (intent.templateMode) {
    return <ConfigureTemplateScreen key={session.key} intent={intent} onDraftIdChange={session.reportScreenDraftId} dependencies={d} />;
  }

  return (
    <ConfigureDeploymentScreen
      key={`${autoDeployStart.key}:${session.key}`}
      intent={intent}
      isStartedByConsole={autoDeployStart.templateId !== null}
      onDeployStartedChange={setHasStartedDeploying}
      onDraftIdChange={session.reportScreenDraftId}
      dependencies={d}
    />
  );
};

/** A link elsewhere in the console can open a deployment onto this page while it stays mounted, so a URL naming another draft than the screen's starts the screen over for it. */
function useConfigureSession(urlDraftId: string | undefined) {
  const [screenDraftId, setScreenDraftId] = useState<string>();
  const [session, setSession] = useState({ urlDraftId, key: 0 });

  if (session.urlDraftId !== urlDraftId) {
    setSession({ urlDraftId, key: urlDraftId === screenDraftId ? session.key : session.key + 1 });
  }

  return { key: session.key, reportScreenDraftId: setScreenDraftId };
}

type ScreenProps = {
  intent: DeploymentIntent;
  /** The URL alone never deploys: any arrival other than a console deploy button for this template, a reload included, opens the form. */
  isStartedByConsole: boolean;
  onDeployStartedChange: (hasStartedDeploying: boolean) => void;
  onDraftIdChange: (draftId: string) => void;
  dependencies: typeof DEPENDENCIES;
};

/** Remounted for each console start, so its draft, resume guard and flow begin afresh for the template that start deploys. */
const ConfigureDeploymentScreen: FC<ScreenProps> = ({ intent, isStartedByConsole, onDeployStartedChange, onDraftIdChange, dependencies: d }) => {
  const draft = d.useConfigureDraft(intent);

  useEffect(
    function reportTheDraftOnScreen() {
      onDraftIdChange(draft.draftId);
    },
    [draft.draftId, onDraftIdChange]
  );

  const templateId = intent.templateId;
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const hardcodedTemplate: TemplateCreation | undefined = templateId ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const isDraftRestored = draft.persistedSdl !== undefined;
  const isAwaitingDraft = draft.isLoading || isDraftRestored;
  const fetchedTemplateId = isAwaitingDraft || hardcodedTemplate ? undefined : templateId;
  const fetchedUserTemplateId = isAwaitingDraft ? undefined : intent.userTemplateId;
  const templateQuery = d.usePublicTemplate(fetchedTemplateId);
  const userTemplateQuery = d.useUserTemplate(fetchedUserTemplateId);
  const { enqueueSnackbar } = d.useSnackbar();

  const isFetchingTemplate = !!fetchedTemplateId || !!fetchedUserTemplateId;
  const isTemplateLoading = (!!fetchedTemplateId && templateQuery.isLoading) || (!!fetchedUserTemplateId && userTemplateQuery.isLoading);
  const hasTemplateFailed =
    (!!fetchedTemplateId && templateQuery.isError) ||
    (!!fetchedUserTemplateId && (userTemplateQuery.isError || (userTemplateQuery.isSuccess && !userTemplateQuery.data?.sdl)));

  const fetchedSdl = fetchedTemplateId ? templateQuery.data?.deploy : userTemplateQuery.data?.sdl;
  const fetchedName = fetchedTemplateId ? templateQuery.data?.name : userTemplateQuery.data?.title;
  const carriedInSdl = intent.vm || intent.exampleImage ? undefined : deploySdl?.content;
  const initialSdl = draft.persistedSdl ?? hardcodedTemplate?.content ?? (isFetchingTemplate ? fetchedSdl : carriedInSdl);
  const initialName = draft.persistedName ?? hardcodedTemplate?.name ?? (isFetchingTemplate ? fetchedName : undefined);
  const isStartingFromDefault = hasTemplateFailed && !initialSdl;
  const [hasFallenBackToForm, setHasFallenBackToForm] = useState(false);
  if (isStartingFromDefault && !hasFallenBackToForm) setHasFallenBackToForm(true);

  useEffect(
    function notifyOnTemplateError() {
      if (!isStartingFromDefault) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the template" subTitle="Starting from a default deployment instead." iconVariant="error" />, {
        variant: "error"
      });
    },
    [isStartingFromDefault, enqueueSnackbar, d]
  );

  /** The auto flow has no way to supply secret values, so an SDL that references any is edited in the form, which does. */
  const needsSecretValues = useMemo(() => !!initialSdl && secretReferenceNamesIn(initialSdl).size > 0, [initialSdl]);
  /** Only the form saves a draft, and a template that failed with nothing to start from has handed the session to it, so neither returns to auto later. */
  const isEditedInForm = isDraftRestored || hasFallenBackToForm;
  const resolvedIntent = useMemo<DeploymentIntent>(
    () => ({
      templateId: intent.templateId,
      userTemplateId: intent.userTemplateId,
      sdlStrategy: needsSecretValues || isEditedInForm || !isStartedByConsole ? "edit" : intent.sdlStrategy,
      bidStrategy: intent.bidStrategy,
      dseq: intent.dseq,
      draftId: draft.draftId,
      vm: intent.vm,
      exampleImage: intent.exampleImage
    }),
    [
      intent.templateId,
      intent.userTemplateId,
      intent.sdlStrategy,
      needsSecretValues,
      isEditedInForm,
      isStartedByConsole,
      intent.bidStrategy,
      intent.dseq,
      draft.draftId,
      intent.vm,
      intent.exampleImage
    ]
  );

  const isAutoDeploy = resolvedIntent.sdlStrategy === "default" && resolvedIntent.bidStrategy === "auto";
  const templateName = templateQuery.data?.name ?? hardcodedTemplate?.title ?? "your deployment";

  // Only the auto flow (with an SDL in hand) can finish an already-leased deployment by re-sending its manifest;
  // a manual visitor or a cold resume with no SDL is sent to the detail page instead. The DeploymentFlowProvider owns
  // the single flow both branches share — keyed by the draft so a draft change remounts a fresh flow, while an
  // auto↔manual switch within one draft keeps it. It sits below the guard so the flow only mounts once the guard has
  // settled the dseq. The template-loading spinner stays above the provider so the trial isn't started mid-fetch.
  const loadingScreen = (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <d.NextSeo title="Configure your deployment" />
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="large" />
      </div>
    </d.Layout>
  );

  if (draft.isLoading) return loadingScreen;

  return (
    <d.DeployTargetGate filedDseq={intent.dseq} fallback={loadingScreen}>
      <d.ResumeDeploymentGuard intent={resolvedIntent} canResume={isAutoDeploy && !!initialSdl}>
        {resume => {
          if (isTemplateLoading) return loadingScreen;

          return (
            <d.DeploymentFlowProvider key={draft.draftId} intent={resolvedIntent} pendingCreate={resume.pendingCreate}>
              {({ flow }) => (
                <>
                  <ReportDeployStarted flow={flow} onChange={onDeployStartedChange} />
                  {isAutoDeploy && initialSdl ? (
                    <d.AutoDeployFlow templateName={templateName} sdl={initialSdl} resume={resume} flow={flow} />
                  ) : (
                    <d.ConfigureDeploymentForm
                      initialSdl={initialSdl ?? resume.recordedDefinition?.sdl}
                      initialName={initialName ?? resume.recordedDefinition?.name}
                      intent={resolvedIntent}
                      flow={flow}
                    />
                  )}
                </>
              )}
            </d.DeploymentFlowProvider>
          );
        }}
      </d.ResumeDeploymentGuard>
    </d.DeployTargetGate>
  );
};

/** A failed attempt that left no deployment is as fresh as the form it returns to, while a cancelled deployment still closing counts, since a fresh start would never close it. */
function ReportDeployStarted({ flow, onChange }: { flow: DeploymentFlow; onChange: (hasStartedDeploying: boolean) => void }) {
  const hasFailedWithoutDeployment = flow.phase === "error" && !flow.dseq;
  const hasStartedDeploying = (flow.phase !== "configuring" && !hasFailedWithoutDeployment) || !!flow.pendingClose;

  useEffect(
    function reportDeployStarted() {
      onChange(hasStartedDeploying);
    },
    [hasStartedDeploying, onChange]
  );

  return null;
}

type TemplateScreenProps = {
  intent: DeploymentIntent;
  onDraftIdChange: (draftId: string) => void;
  dependencies: typeof DEPENDENCIES;
};

/** Authors a template, so no flow, bid or deployment starts here; an edit is pinned to the version its starting SDL came from, the URL's for a restored draft and the current one otherwise, so a save after a colleague's is refused rather than applied over it. */
const ConfigureTemplateScreen: FC<TemplateScreenProps> = ({ intent, onDraftIdChange, dependencies: d }) => {
  const draft = d.useConfigureDraft(intent);
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();
  const isEditing = intent.templateMode === "edit";
  /** Read once the draft loads, since the screen's own draft saves and the clear after a template save would otherwise turn a copy back on. */
  const [restoredOnLoad, setRestoredOnLoad] = useState<boolean | null>(null);
  if (restoredOnLoad === null && !draft.isLoading) setRestoredOnLoad(draft.persistedSdl !== undefined);
  const isDraftRestored = restoredOnLoad ?? draft.persistedSdl !== undefined;
  const templateQuery = d.useMarketplaceTemplate(isEditing ? intent.userTemplateId : undefined);
  const isCopying = !isEditing && !!intent.copyFromTemplateId && !draft.isLoading && !isDraftRestored;
  const copyQuery = d.useTemplateVersion(isCopying ? intent.copyFromTemplateId : undefined, isCopying ? intent.copyFromVersion : undefined);
  const template = isEditing ? templateQuery.data : undefined;
  const isNotEditor = !!template && !template.canEdit;
  const hasTemplateFailed = isEditing && templateQuery.isError && !templateQuery.data;
  const hasCopyFailed = isCopying && copyQuery.isError;
  const copiedVersion = isCopying ? copyQuery.data : undefined;
  const [pinnedBase, setPinnedBase] = useState<{ version?: number } | null>(null);
  if (!pinnedBase && !draft.isLoading && template?.canEdit) {
    setPinnedBase({ version: isDraftRestored && intent.baseVersion ? intent.baseVersion : template.currentVersion?.version });
  }
  const pinnedBaseVersion = pinnedBase?.version;
  const pinnedToUrlRef = useRef<string>();

  useEffect(
    function reportTheDraftOnScreen() {
      onDraftIdChange(draft.draftId);
    },
    [draft.draftId, onDraftIdChange]
  );

  useEffect(
    function pinTheBaseVersionInTheUrl() {
      const pinnedUrlKey = `${draft.draftId}:${pinnedBaseVersion}`;
      if (draft.isLoading || !pinnedBaseVersion || intent.baseVersion === pinnedBaseVersion || pinnedToUrlRef.current === pinnedUrlKey) return;
      pinnedToUrlRef.current = pinnedUrlKey;
      router.replace(buildConfigureUrl({ ...intent, draftId: draft.draftId, baseVersion: pinnedBaseVersion }, undefined, intent.bidStrategy), undefined, {
        shallow: true
      });
    },
    [draft.isLoading, draft.draftId, pinnedBaseVersion, intent, router]
  );

  useEffect(
    function sendNonEditorsToTheTemplatePage() {
      if (isNotEditor && intent.userTemplateId) router.replace(UrlService.template(intent.userTemplateId));
    },
    [isNotEditor, intent.userTemplateId, router]
  );

  useEffect(
    function leaveATemplateThatCannotBeRead() {
      if (!hasTemplateFailed) return;
      enqueueSnackbar(
        <d.Snackbar title="Couldn't load the template" subTitle="It may have been deleted, or you no longer have access to it." iconVariant="error" />,
        {
          variant: "error"
        }
      );
      router.replace(UrlService.myTemplates());
    },
    [hasTemplateFailed, enqueueSnackbar, router, d]
  );

  useEffect(
    function notifyOnCopyError() {
      if (!hasCopyFailed) return;
      enqueueSnackbar(<d.Snackbar title="Couldn't load the template" subTitle="Starting from a new template instead." iconVariant="error" />, {
        variant: "error"
      });
    },
    [hasCopyFailed, enqueueSnackbar, d]
  );

  const loadingScreen = (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <d.NextSeo title="Configure your template" />
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="large" />
      </div>
    </d.Layout>
  );

  const isWaitingForTemplate = isEditing && (!template || isNotEditor);
  const isWaitingForCopy = isCopying && !copiedVersion && !hasCopyFailed;
  if (draft.isLoading || isWaitingForTemplate || isWaitingForCopy) return loadingScreen;

  const { copyFromTemplateId, copyFromVersion, ...intentWithoutCopy } = intent;
  const isCopied = !!copiedVersion || (isDraftRestored && !!copyFromTemplateId);
  const screenIntent: DeploymentIntent = {
    ...intentWithoutCopy,
    ...(isCopied ? { copyFromTemplateId, copyFromVersion } : {}),
    ...(isEditing ? { baseVersion: pinnedBaseVersion } : {}),
    draftId: draft.draftId
  };
  const startingVersion = template?.currentVersion ?? copiedVersion;
  const templateForm = (
    <d.ConfigureTemplateForm
      key={`${draft.draftId}:${template?.id}`}
      intent={screenIntent}
      initialSdl={draft.persistedSdl ?? startingVersion?.sdl}
      initialName={draft.persistedName ?? template?.title}
      suggestedTitle={draft.persistedTemplateTitle}
      suggestedSummary={draft.persistedTemplateSummary}
      template={template}
      askedValues={startingVersion?.askedValues ?? []}
    />
  );

  return isEditing ? templateForm : <d.DeployTargetGate fallback={loadingScreen}>{templateForm}</d.DeployTargetGate>;
};
