"use client";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { ConfigureDeployTargetChip } from "@src/components/projects/ConfigureDeployTargetChip/ConfigureDeployTargetChip";
import { useConfigureDeployTarget } from "@src/components/projects/DeployTargetGate/DeployTargetGate";
import { describeTemplateRefusal } from "@src/components/templates/describeTemplateRefusal";
import { useCreateTemplateMutation, useCreateTemplateVersionMutation } from "@src/queries/useUserTemplateQueries";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import type { MarketplaceTemplate, TemplateAskedValue } from "@src/types/marketplace-template";
import { severalRegionPicksOf } from "@src/utils/sdl/placementRegions";
import { UrlService } from "@src/utils/urlUtils";
import { ConfigureEditor } from "../../ConfigureEditor/ConfigureEditor";
import { ResetConfigurationButton } from "../../ConfigureEditor/ResetConfigurationButton/ResetConfigurationButton";
import { draftableSdlOf, getInitialState, regenerateSdl, sdlOfImportedState } from "../../configureFormState/configureFormState";
import type { ImportedDeploymentState } from "../../importDeploymentState/importDeploymentState";
import { PlacementManagerProvider } from "../../PlacementManagerProvider/PlacementManagerProvider";
import { SdlImportChangesBanner } from "../../SdlImportChangesBanner/SdlImportChangesBanner";
import { SdlImportExport } from "../../SdlImportExport/SdlImportExport";
import { SdlPreviewPane } from "../../SdlPreviewPane/SdlPreviewPane";
import { nextSelectedServiceId, resolveSelectedPlacement } from "../../serviceSelection/serviceSelection";
import { useConfigureDraft } from "../../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../../useDeploymentFlow/deploymentIntent";
import { useForceSshForVmServices } from "../../useForceSshForVmServices/useForceSshForVmServices";
import { useSyncLogCollectors } from "../../useSyncLogCollectors/useSyncLogCollectors";
import { buildAskedValues, summarizeAskedValues } from "../buildAskedValues";
import { ConfigureTemplateHeader } from "../ConfigureTemplateHeader/ConfigureTemplateHeader";
import type { TemplateDetails } from "../SaveTemplateDialog/SaveTemplateDialog";
import { SaveTemplateDialog } from "../SaveTemplateDialog/SaveTemplateDialog";
import type { TemplateModeState } from "../TemplateModeProvider/TemplateModeProvider";
import { TemplateModeProvider, useTemplateMode } from "../TemplateModeProvider/TemplateModeProvider";
import { UnaskableSecretsAlert } from "../UnaskableSecretsAlert/UnaskableSecretsAlert";
import { useConfirmLeave } from "../useConfirmLeave/useConfirmLeave";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  ConfigureTemplateHeader,
  ConfigureDeployTargetChip,
  ConfigureEditor,
  SdlImportExport,
  ResetConfigurationButton,
  SdlPreviewPane,
  SdlImportChangesBanner,
  SaveTemplateDialog,
  Snackbar,
  useConfigureDraft,
  useConfigureDeployTarget,
  useCreateTemplateMutation,
  useCreateTemplateVersionMutation,
  useConfirmLeave,
  useRouter,
  useSnackbar
};

/** Delay between a form edit and updating the debounced SDL preview and draft. */
const SDL_SYNC_DEBOUNCE_MS = 300;

/** Long enough to read the reason and act on it; the default duration dismisses before either. */
const REFUSAL_TOAST_DURATION_MS = 10000;

const CONFLICT_STATUS = 409;

const LEAVE_MESSAGE = "Leave without saving? Your changes to this template will be lost.";

const PREVIEW_FOOTER = "Highlighted values are asked to the deployer. Secret values are never written into a template.";

type Props = {
  intent: DeploymentIntent;
  initialSdl?: string;
  initialName?: string;
  /** The template an edit saves a new version of. */
  template?: MarketplaceTemplate;
  askedValues: TemplateAskedValue[];
  dependencies?: typeof DEPENDENCIES;
};

/** The ask-the-deployer settings are read once on mount, so the screen mounts only once the template's asked values are known. */
export const ConfigureTemplateForm: FC<Props> = ({ askedValues, ...props }) => (
  <TemplateModeProvider initialAskedValues={askedValues}>
    <TemplateForm {...props} />
  </TemplateModeProvider>
);

const TemplateForm: FC<Omit<Props, "askedValues">> = ({ intent, initialSdl, initialName, template, dependencies: d = DEPENDENCIES }) => {
  const templateMode = useTemplateMode() as TemplateModeState;
  const isEditing = intent.templateMode === "edit";
  const draft = d.useConfigureDraft(intent);
  const router = d.useRouter();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const deployTarget = d.useConfigureDeployTarget();
  const { mutateAsync: createTemplate, isPending: isCreating } = d.useCreateTemplateMutation();
  const { mutateAsync: createVersion, isPending: isSavingVersion } = d.useCreateTemplateVersionMutation();
  const [initialState] = useState(() => getInitialState(initialSdl, intent, draft.persistedPlacementRegions));
  const [startingSdl] = useState(() => (draft.persistedSdl === undefined ? initialSdl : draft.persistedStartingSdl));
  const [liveSdl, setLiveSdl] = useState(initialState.sdl);
  const [previewSdl, setPreviewSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState(initialState.selectedServiceId);
  const [importChanges, setImportChanges] = useState(initialState.changes);
  const [name, setName] = useState(initialName ?? "");
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const lastSelectedServiceId = useRef(selectedServiceId);
  /** A draft save still pending when the template is saved would otherwise write the cleared draft back. */
  const isSavedRef = useRef(false);
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: initialState.values,
    mode: "onTouched",
    reValidateMode: "onChange",
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const services = useWatch({ control: form.control, name: "services" });
  const placements = useWatch({ control: form.control, name: "placements" });
  const placementRegionPicks = useMemo(() => severalRegionPicksOf(placements), [placements]);
  const draftableStartingSdl = useMemo(() => startingSdl && draftableSdlOf(startingSdl, services), [startingSdl, services]);
  const selectedPlacement = resolveSelectedPlacement(services, placements, selectedServiceId || lastSelectedServiceId.current);
  const lastSelectedPlacementId = useRef(selectedPlacement.id);
  const askedValues = useMemo(() => buildAskedValues(services, templateMode.settings), [services, templateMode.settings]);
  const askedSummary = useMemo(() => summarizeAskedValues(askedValues, services), [askedValues, services]);
  const [hasRestoredEdits] = useState(() => isEditing && draft.persistedSdl !== undefined);
  const isDirty = hasRestoredEdits || templateMode.isDirty || form.formState.isDirty || liveSdl !== initialState.sdl;
  const leaveControl = d.useConfirmLeave(isDirty, LEAVE_MESSAGE);
  useSyncLogCollectors(form);
  useForceSshForVmServices(form);

  useEffect(
    function syncLiveSdl() {
      const subscription = form.watch(values => setLiveSdl(previous => regenerateSdl(values as SdlBuilderFormValuesType, previous)));
      return function teardownLiveSync() {
        subscription.unsubscribe();
      };
    },
    [form]
  );

  useEffect(
    function debouncePreviewSdl() {
      const timeout = setTimeout(function commitDebouncedSdl() {
        setPreviewSdl(liveSdl);
        if (!isSavedRef.current) draft.save(liveSdl, name, undefined, draftableStartingSdl, placementRegionPicks);
      }, SDL_SYNC_DEBOUNCE_MS);
      return function cancelPreviewDebounce() {
        clearTimeout(timeout);
      };
    },
    [liveSdl, name, draftableStartingSdl, placementRegionPicks, draft]
  );

  useEffect(
    function rememberLastSelection() {
      if (selectedServiceId) lastSelectedServiceId.current = selectedServiceId;
      lastSelectedPlacementId.current = selectedPlacement.id;
    },
    [selectedServiceId, selectedPlacement.id]
  );

  useEffect(
    function reselectRemovedService() {
      const subscription = form.watch(values => {
        setSelectedServiceId(previous =>
          nextSelectedServiceId(values as SdlBuilderFormValuesType, previous || lastSelectedServiceId.current, lastSelectedPlacementId.current)
        );
      });
      return function teardownReselect() {
        subscription.unsubscribe();
      };
    },
    [form]
  );

  const applyImportedState = useCallback(
    (state: ImportedDeploymentState) => {
      form.reset(state.values);
      setLiveSdl(sdlOfImportedState(state));
      setSelectedServiceId(state.selectedServiceId);
      setImportChanges(state.changes);
    },
    [form]
  );

  const resetConfiguration = useCallback(() => applyImportedState(getInitialState(startingSdl, intent)), [applyImportedState, startingSdl, intent]);

  function templateContent() {
    const values = form.getValues();
    return { sdl: regenerateSdl(values, liveSdl), askedValues: buildAskedValues(values.services, templateMode.settings) };
  }

  function leaveFor(url: string) {
    isSavedRef.current = true;
    draft.clear();
    templateMode.markSaved();
    leaveControl.allowLeaving();
    router.push(url).then(
      hasLeft => {
        if (!hasLeft) leaveControl.askBeforeLeaving();
      },
      () => leaveControl.askBeforeLeaving()
    );
  }

  async function saveTemplate({ title, summary }: TemplateDetails) {
    try {
      const response = await createTemplate({
        data: {
          title,
          summary: summary || undefined,
          ...templateContent(),
          projectId: deployTarget.project?.id,
          copiedFromId: intent.copyFromTemplateId
        }
      });
      leaveFor(UrlService.template(response.data.id));
    } catch (error) {
      toastSaveFailure(error);
    }
  }

  async function saveVersion(editedTemplate: MarketplaceTemplate) {
    try {
      await createVersion({ id: editedTemplate.id, data: { ...templateContent(), baseVersion: intent.baseVersion } });
      leaveFor(`${UrlService.template(editedTemplate.id)}?tab=versions`);
    } catch (error) {
      if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
        toastNewerVersion(editedTemplate.id);
        return;
      }
      toastSaveFailure(error);
    }
  }

  function toastNewerVersion(templateId: string) {
    const key = enqueueSnackbar(
      <d.Snackbar
        title="Someone saved a newer version of this template"
        iconVariant="warning"
        action={
          <Link href={UrlService.template(templateId)} className="text-sm font-medium underline" onClick={() => closeSnackbar(key)}>
            Open template
          </Link>
        }
      />,
      { variant: "warning", autoHideDuration: REFUSAL_TOAST_DURATION_MS }
    );
  }

  function toastSaveFailure(error: unknown) {
    enqueueSnackbar(
      <d.Snackbar title="Couldn't save the template" subTitle={describeTemplateRefusal(error) ?? "Try again in a moment."} iconVariant="error" />,
      {
        variant: "error",
        autoHideDuration: REFUSAL_TOAST_DURATION_MS
      }
    );
  }

  function save() {
    if (isEditing && template) {
      void saveVersion(template);
      return;
    }
    setIsSaveDialogOpen(true);
  }

  const source = intent.sourceDseq
    ? { name: initialName || `deployment ${intent.sourceDseq}`, href: UrlService.deploymentDetails(intent.sourceDseq) }
    : undefined;
  const canSaveVersion = askedSummary.unaskableSecrets.length === 0;

  return (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <d.NextSeo title="Configure your template" />
      <FormProvider {...form}>
        <PlacementManagerProvider onSelectService={setSelectedServiceId}>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <d.ConfigureTemplateHeader
              mode={isEditing ? "edit" : "new"}
              source={source}
              services={services}
              askedCount={askedValues.length}
              isSaving={isCreating || isSavingVersion}
              canSave={!isEditing || canSaveVersion}
              onSave={save}
            />
            {isEditing && <UnaskableSecretsAlert unaskableSecrets={askedSummary.unaskableSecrets} className="mx-6 mt-4 w-auto" />}
            {importChanges.length > 0 && <d.SdlImportChangesBanner changes={importChanges} onDismiss={() => setImportChanges([])} />}
            {!isEditing && <d.ConfigureDeployTargetChip />}
            <div className="relative mt-6 flex flex-1 flex-col border-t border-zinc-300 lg:min-h-0 lg:flex-row dark:border-zinc-700">
              <div className="border-zinc-300 lg:h-full lg:min-w-[560px] lg:flex-1 lg:border-r dark:border-zinc-700">
                <d.ConfigureEditor
                  title="Template"
                  selectedServiceId={selectedServiceId}
                  activePlacementId={selectedPlacement.id}
                  onSelectService={setSelectedServiceId}
                  deploymentName={name}
                  onDeploymentNameChange={setName}
                  showsNameField={!isEditing}
                  toolbar={
                    <div className="flex items-center gap-1">
                      <d.SdlImportExport variant="toolbar" sdl={liveSdl} deploymentName={name} canImport onImport={applyImportedState} />
                      <d.ResetConfigurationButton onReset={resetConfiguration} />
                    </div>
                  }
                />
              </div>
              <div className={isPreviewOpen ? "min-w-0 lg:h-full lg:w-[42%]" : undefined}>
                <d.SdlPreviewPane
                  sdl={previewSdl}
                  isOpen={isPreviewOpen}
                  onOpen={() => setIsPreviewOpen(true)}
                  onClose={() => setIsPreviewOpen(false)}
                  footer={PREVIEW_FOOTER}
                />
              </div>
            </div>
          </div>
          {!isEditing && (
            <d.SaveTemplateDialog
              open={isSaveDialogOpen}
              initialTitle={name}
              isTitleFromDeployment={!!intent.sourceDseq && name === (initialName ?? "")}
              projectName={deployTarget.project?.name}
              sourceName={source?.name}
              askedValues={askedValues}
              savedAsIs={askedSummary.savedAsIs}
              unaskableSecrets={askedSummary.unaskableSecrets}
              services={services}
              isSaving={isCreating}
              onSave={details => void saveTemplate(details)}
              onClose={() => setIsSaveDialogOpen(false)}
            />
          )}
        </PlacementManagerProvider>
      </FormProvider>
    </d.Layout>
  );
};
