"use client";
import { FC, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";

import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider";
import { useTemplates } from "@src/context/TemplatesProvider";
import sdlStore from "@src/store/sdlStore";
import { TemplateCreation } from "@src/types";
import { RouteStepKeys } from "@src/utils/constants";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CreateLease } from "./CreateLease";
import { ManifestEdit } from "./ManifestEdit";
import { CustomizedSteppers } from "./Stepper";
import { TemplateList } from "./TemplateList";

export const NewDeploymentContainer: FC = () => {
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
    if (!templates) return;

    const redeployTemplate = getRedeployTemplate();
    const galleryTemplate = getGalleryTemplate();

    if (redeployTemplate) {
      // If it's a redeployment, set the template from local storage
      setSelectedTemplate(redeployTemplate as TemplateCreation);
      setEditedManifest(redeployTemplate.content as string);
    } else if (galleryTemplate) {
      // If it's a deployment from the template gallery, load from template data
      setSelectedTemplate(galleryTemplate as TemplateCreation);
      setEditedManifest(galleryTemplate.content as string);

      if (galleryTemplate.config?.ssh || (!galleryTemplate.config?.ssh && hasComponent("ssh"))) {
        toggleCmp("ssh");
      }
    }

    const queryStep = searchParams?.get("step");
    const _activeStep = getStepIndexByParam(queryStep);
    setActiveStep(_activeStep);

    if ((redeployTemplate || galleryTemplate) && queryStep !== RouteStepKeys.editDeployment) {
      router.replace(UrlService.newDeployment({ ...searchParams, step: RouteStepKeys.editDeployment }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

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

    // Jotai state template
    if (deploySdl) {
      return deploySdl;
    }

    return null;
  };

  function getStepIndexByParam(step) {
    switch (step) {
      case RouteStepKeys.editDeployment:
        return 1;
      case RouteStepKeys.createLeases:
        return 2;
      case RouteStepKeys.chooseTemplate:
      default:
        return 0;
    }
  }

  return (
    <Layout isLoading={isLoadingTemplates} isUsingSettings isUsingWallet containerClassName="pb-0">
      <div className="flex w-full items-center">{activeStep !== null && <CustomizedSteppers activeStep={activeStep} />}</div>

      {activeStep === 0 && <TemplateList />}
      {activeStep === 1 && (
        <ManifestEdit
          selectedTemplate={selectedTemplate}
          onTemplateSelected={setSelectedTemplate}
          editedManifest={editedManifest}
          setEditedManifest={setEditedManifest}
        />
      )}
      {activeStep === 2 && <CreateLease dseq={dseq as string} />}
    </Layout>
  );
};
