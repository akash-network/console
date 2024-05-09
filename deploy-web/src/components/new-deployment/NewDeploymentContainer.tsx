"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RouteStepKeys } from "@src/utils/constants";
import { useTemplates } from "@src/context/TemplatesProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { UrlService } from "@src/utils/urlUtils";
import { TemplateCreation } from "@src/types";
import { hardcodedTemplates } from "@src/utils/templates";
import sdlStore from "@src/store/sdlStore";
import { useAtomValue } from "jotai";
import Layout from "../layout/Layout";
import { CustomizedSteppers } from "./Stepper";
import { TemplateList } from "./TemplateList";
import { ManifestEdit } from "./ManifestEdit";
import { CreateLease } from "./CreateLease";

export function NewDeploymentContainer() {
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

  useEffect(() => {
    if (!templates) return;

    const redeployTemplate = getRedeployTemplate();
    const galleryTemplate = getGalleryTemplate();

    if (redeployTemplate) {
      // If it's a redeploy, set the template from local storage
      setSelectedTemplate(redeployTemplate as TemplateCreation);
      setEditedManifest(redeployTemplate.content as string);
    } else if (galleryTemplate) {
      // If it's a deploy from the template gallery, load from template data
      setSelectedTemplate(galleryTemplate as TemplateCreation);
      setEditedManifest(galleryTemplate.content as string);
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

  const getGalleryTemplate = () => {
    const queryTemplateId = searchParams?.get("templateId");
    if (queryTemplateId) {
      const templateById = getTemplateById(queryTemplateId as string);
      if (templateById) {
        return {
          code: "empty",
          name: templateById.name,
          content: templateById.deploy,
          valuesToChange: templateById.valuesToChange || []
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

      {activeStep === 0 && <TemplateList setSelectedTemplate={setSelectedTemplate} setEditedManifest={setEditedManifest} />}
      {activeStep === 1 && (
        <ManifestEdit selectedTemplate={selectedTemplate as TemplateCreation} editedManifest={editedManifest as string} setEditedManifest={setEditedManifest} />
      )}
      {activeStep === 2 && <CreateLease dseq={dseq as string} />}
    </Layout>
  );
}
