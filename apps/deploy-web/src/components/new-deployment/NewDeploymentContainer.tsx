"use client";
import { FC, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";

import { USER_TEMPLATE_CODE } from "@src/config/deploy.config";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider";
import { useTemplates } from "@src/context/TemplatesProvider";
import { isImageInYaml } from "@src/services/remote-deploy/remote-deployment-controller.service";
import sdlStore from "@src/store/sdlStore";
import { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CreateLease } from "./CreateLease";
import { ManifestEdit } from "./ManifestEdit";
import { CustomizedSteppers } from "./Stepper";
import { TemplateList } from "./TemplateList";

export const NewDeploymentContainer: FC = () => {
  const [isGitProviderTemplate, setIsGitProviderTemplate] = useState<boolean>(false);
  const { isLoading: isLoadingTemplates, templates } = useTemplates();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCreation | null>(null);
  const [editedManifest, setEditedManifest] = useState<string | null>(null);
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const { getDeploymentData } = useLocalNotes();
  const { getTemplateById } = useTemplates();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dseq = searchParams?.get("dseq");
  const { toggleCmp, hasComponent } = useSdlBuilder();

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
        UrlService.newDeployment({
          step: RouteStep.editDeployment,
          gitProvider: "github",
          gitProviderCode: code,
          templateId: CI_CD_TEMPLATE_ID
        })
      );
    } else {
      setIsGitProviderTemplate(!!isGitProvider);
    }
  }, [searchParams]);

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

    const cicdTemplate = getTemplateById(CI_CD_TEMPLATE_ID);
    const isRemoteYamlImage = isImageInYaml(template?.content as string, cicdTemplate?.deploy);
    const queryStep = searchParams?.get("step");
    if (queryStep !== RouteStep.editDeployment) {
      if (isRemoteYamlImage) {
        setIsGitProviderTemplate(true);
      }

      const newParams = isRemoteYamlImage
        ? { ...searchParams, step: RouteStep.editDeployment, gitProvider: "github" }
        : { ...searchParams, step: RouteStep.editDeployment };

      router.replace(UrlService.newDeployment(newParams));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, editedManifest, searchParams, router, toggleCmp, hasComponent, activeStep]);

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

  const getGalleryTemplate = (): Partial<{
    code: string;
    name: string;
    content: string;
    valuesToChange: any[];
    config: { ssh?: boolean };
  }> | null => {
    const queryTemplateId = searchParams?.get("templateId");
    if (queryTemplateId) {
      const templateById = getTemplateById(queryTemplateId as string);
      if (templateById) {
        return {
          code: "empty",
          name: templateById.name,
          content: templateById.deploy,
          valuesToChange: templateById.valuesToChange || [],
          config: templateById.config
        };
      }

      const hardCodedTemplate = hardcodedTemplates.find(t => t.code === queryTemplateId);
      if (hardCodedTemplate) {
        return hardCodedTemplate;
      }
    }

    return null;
  };

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

  return (
    <Layout isLoading={isLoadingTemplates} isUsingSettings isUsingWallet containerClassName="pb-0 h-full">
      {!!activeStep && (
        <div className="flex w-full items-center">
          <CustomizedSteppers activeStep={activeStep} />
        </div>
      )}

      {activeStep === 0 && (
        <TemplateList onChangeGitProvider={setIsGitProviderTemplate} onTemplateSelected={setSelectedTemplate} setEditedManifest={setEditedManifest} />
      )}
      {activeStep === 1 && (
        <ManifestEdit
          selectedTemplate={selectedTemplate}
          onTemplateSelected={setSelectedTemplate}
          editedManifest={editedManifest}
          setEditedManifest={setEditedManifest}
          isGitProviderTemplate={isGitProviderTemplate}
        />
      )}
      {activeStep === 2 && <CreateLease dseq={dseq as string} />}
    </Layout>
  );
};
