"use client";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { useAtomValue } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";

import { USER_TEMPLATE_CODE } from "@src/config/deploy.config";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider";
import { useServices } from "@src/context/ServicesProvider";
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
  CustomizedSteppers,
  useRouter,
  useSearchParams,
  useSdlBuilder,
  useLocalNotes,
  useTemplates,
  useServices
};

export const NewDeploymentContainer: FC<NewDeploymentContainerProps> = ({ template: requestedTemplate, templateId, dependencies: d = DEPENDENCIES }) => {
  const { urlService, sdlAnalyzer } = d.useServices();
  const [isGitProviderTemplate, setIsGitProviderTemplate] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCreation | null>(null);
  const [editedManifest, setEditedManifest] = useState("");
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const { getDeploymentData } = d.useLocalNotes();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { toggleCmp, hasComponent } = d.useSdlBuilder();
  const { isLoading: isLoadingTemplates, templates } = d.useTemplates();

  const dseq = searchParams?.get("dseq");

  useEffect(() => {
    const queryStep = searchParams?.get("step");
    const _activeStep = getStepIndexByParam(queryStep as RouteStep);
    setActiveStep(_activeStep);

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

  function getStepIndexByParam(step: (typeof RouteStep)[keyof typeof RouteStep] | null) {
    switch (step) {
      case RouteStep.editDeployment:
        return 1;
      case RouteStep.createLeases:
        return 2;
      case RouteStep.chooseTemplate:
      default:
        return 0;
    }
  }

  const isFirstStepCompleted = activeStep !== null && activeStep >= 1;

  return (
    <d.Layout isLoading={isLoadingTemplates} isUsingSettings isUsingWallet containerClassName="pb-0 h-full">
      {isFirstStepCompleted && (
        <div className="flex w-full items-center">
          <d.CustomizedSteppers activeStep={activeStep} />
        </div>
      )}

      {activeStep === 0 && (
        <d.TemplateList onChangeGitProvider={setIsGitProviderTemplate} onTemplateSelected={setSelectedTemplate} setEditedManifest={setEditedManifest} />
      )}
      {activeStep === 1 && (
        <d.ManifestEdit
          selectedTemplate={selectedTemplate}
          onTemplateSelected={setSelectedTemplate}
          editedManifest={editedManifest}
          setEditedManifest={setEditedManifest}
          isGitProviderTemplate={isGitProviderTemplate}
        />
      )}
      {activeStep === 2 && <d.CreateLease dseq={dseq as string} />}
    </d.Layout>
  );
};
