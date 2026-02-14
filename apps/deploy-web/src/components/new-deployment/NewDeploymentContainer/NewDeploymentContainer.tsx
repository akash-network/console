"use client";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { useAtomValue } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";

import { Editor } from "@src/components/shared/Editor/Editor";
import { USER_TEMPLATE_CODE } from "@src/config/deploy.config";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWhen } from "@src/hooks/useWhen";
import { useTemplates } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { hardcodedTemplates } from "@src/utils/templates";
import Layout from "../../layout/Layout";
import { CreateLease } from "../CreateLease/CreateLease";
import { ManifestEdit } from "../ManifestEdit/ManifestEdit";
import { CustomizedSteppers } from "../Stepper";
import { TemplateList } from "../TemplateList";

export interface NewDeploymentContainerProps {
  template?: TemplateOutput;
  templateId?: string;
  isDeployButtonFlow?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Layout,
  TemplateList,
  ManifestEdit,
  CreateLease,
  Editor,
  CustomizedSteppers,
  useRouter,
  useSearchParams,
  useSdlBuilder,
  useLocalNotes,
  useTemplates,
  useServices
};

const STEPS = [RouteStep.chooseTemplate, RouteStep.editDeployment, RouteStep.createLeases] as const;

export const NewDeploymentContainer: FC<NewDeploymentContainerProps> = ({ template: requestedTemplate, templateId, dependencies: d = DEPENDENCIES }) => {
  const { urlService, sdlAnalyzer } = d.useServices();
  const [isGitProviderTemplate, setIsGitProviderTemplate] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCreation | null>(null);
  const [editedManifest, setEditedManifest] = useState("");
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const { getDeploymentData } = d.useLocalNotes();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { toggleCmp, hasComponent } = d.useSdlBuilder();
  const { isLoading: isLoadingTemplates, templates } = d.useTemplates();
  const activeStep = useMemo(() => getStepIndexByParam(searchParams?.get("step") as RouteStep), [searchParams]);
  const activeStepName = STEPS[activeStep];

  const dseq = searchParams?.get("dseq");

  useEffect(() => {
    const redeploy = searchParams?.get("redeploy");
    const code = searchParams?.get("code");
    const gitProvider = searchParams?.get("gitProvider");
    const state = searchParams?.get("state");
    const templateId = searchParams?.get("templateId");
    const shouldRedirectToGitlab = !redeploy && state === "gitlab" && code;
    const isGitProvider = gitProvider === "github" || code || state === "gitlab" || (templateId && templateId === CI_CD_TEMPLATE_ID);

    if (shouldRedirectToGitlab) {
      router.replace(
        urlService.newDeployment({
          step: RouteStep.editDeployment,
          gitProvider: "github",
          gitProviderCode: code,
          templateId: CI_CD_TEMPLATE_ID
        })
      );
    } else {
      setIsGitProviderTemplate(!!isGitProvider);
    }
  }, [router, searchParams]);

  useEffect(() => {
    const templateId = searchParams?.get("templateId");
    const isCreating = !!activeStep && activeStep > getStepIndexByParam(RouteStep.chooseTemplate);

    if (!templates || (isCreating && !!editedManifest && !!templateId)) return;

    const template = getRedeployTemplate() || getGalleryTemplate() || deploySdl;
    const isUserTemplate = template?.code === USER_TEMPLATE_CODE;
    const isUserTemplateInit = isUserTemplate && !!editedManifest;
    if (!template || isUserTemplateInit) return;

    setSelectedTemplate(template as TemplateCreation);
    setEditedManifest(template.content as string);

    if ("config" in template && (template.config?.ssh || (!template.config?.ssh && hasComponent("ssh")))) {
      toggleCmp("ssh");
    }

    const isRemoteYamlImage = sdlAnalyzer.hasCiCdImage(template?.content);
    const queryStep = searchParams?.get("step");
    if (queryStep !== RouteStep.editDeployment) {
      if (isRemoteYamlImage) {
        setIsGitProviderTemplate(true);
      }
      const newParams = isRemoteYamlImage
        ? { ...Object.fromEntries(searchParams.entries()), step: RouteStep.editDeployment, gitProvider: "github" }
        : { ...Object.fromEntries(searchParams.entries()), step: RouteStep.editDeployment };
      router.replace(urlService.newDeployment(newParams));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, !!editedManifest, searchParams, router, toggleCmp, hasComponent, activeStep]);

  useWhen(activeStepName === RouteStep.chooseTemplate, () => d.Editor.preload());

  const getRedeployTemplate = () => {
    let template: Partial<TemplateCreation> | null = null;
    const queryRedeploy = searchParams?.get("redeploy");
    if (queryRedeploy) {
      const deploymentData = getDeploymentData(queryRedeploy as string);

      if (deploymentData && deploymentData.manifest) {
        template = {
          name: deploymentData.name,
          code: "empty",
          content: deploymentData.manifest
        };
      }
    }

    return template;
  };

  const getGalleryTemplate = useCallback(():
    | Partial<{
        code: string;
        name: string;
        content: string;
        valuesToChange: any[];
        config: { ssh?: boolean };
      }>
    | undefined => {
    return requestedTemplate
      ? {
          code: "empty",
          name: requestedTemplate.name,
          content: requestedTemplate.deploy,
          valuesToChange: [],
          config: requestedTemplate.config
        }
      : hardcodedTemplates.find(t => t.code === templateId);
  }, [requestedTemplate, templateId]);

  function getStepIndexByParam(step: (typeof RouteStep)[keyof typeof RouteStep] | null | undefined) {
    if (!step) return 0;
    const index = STEPS.indexOf(step);
    return index === -1 ? 0 : index;
  }

  const isFirstStepCompleted = activeStep !== null && activeStep >= 1;

  return (
    <d.Layout isLoading={isLoadingTemplates} isUsingSettings isUsingWallet containerClassName="pb-0 h-full">
      {isFirstStepCompleted && (
        <div className="flex w-full items-center">
          <d.CustomizedSteppers activeStep={activeStep} />
        </div>
      )}

      {activeStepName === RouteStep.chooseTemplate && (
        <d.TemplateList onChangeGitProvider={setIsGitProviderTemplate} onTemplateSelected={setSelectedTemplate} setEditedManifest={setEditedManifest} />
      )}
      {activeStepName === RouteStep.editDeployment && (
        <d.ManifestEdit
          selectedTemplate={selectedTemplate}
          onTemplateSelected={setSelectedTemplate}
          editedManifest={editedManifest}
          setEditedManifest={setEditedManifest}
          isGitProviderTemplate={isGitProviderTemplate}
        />
      )}
      {activeStepName === RouteStep.createLeases && <d.CreateLease dseq={dseq as string} />}
    </d.Layout>
  );
};
