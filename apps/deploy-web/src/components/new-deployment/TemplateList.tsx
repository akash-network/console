"use client";
import React, { Dispatch, useEffect, useRef, useState } from "react";
import { ArrowRight, Cpu, Page, Rocket, Wrench } from "iconoir-react";
import { NavArrowLeft } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTemplates } from "@src/context/TemplatesProvider";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import sdlStore from "@src/store/sdlStore";
import { ApiTemplate, TemplateCreation } from "@src/types";
import { RouteStepKeys } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import { helloWorldTemplate, ubuntuTemplate } from "@src/utils/templates";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { TemplateBox } from "../templates/TemplateBox";
import { Button, buttonVariants } from "../ui/button";
import { DeployOptionBox } from "./DeployOptionBox";

const previewTemplateIds = [
  "akash-network-cosmos-omnibus-cosmoshub",
  "akash-network-cosmos-omnibus-juno",
  "akash-network-cosmos-omnibus-osmosis",
  "akash-network-cosmos-omnibus-akash",
  "akash-network-cosmos-omnibus-stargaze",
  "akash-network-cosmos-omnibus-kava",
  // "akash-network-cosmos-omnibus-chihuahua",
  "akash-network-awesome-akash-wordpress",
  // "akash-network-awesome-akash-pgadmin4",
  "akash-network-awesome-akash-minecraft"
];

type Props = {
  setSelectedTemplate: Dispatch<TemplateCreation>;
  setEditedManifest: Dispatch<string>;
};

export const TemplateList: React.FunctionComponent<Props> = ({ setSelectedTemplate, setEditedManifest }) => {
  const { templates } = useTemplates();
  const router = useRouter();
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [previewTemplates, setPreviewTemplates] = useState<ApiTemplate[]>([]);
  const [, setSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);
  const previousRoute = usePreviousRoute();

  useEffect(() => {
    if (templates) {
      const _previewTemplates = templates.filter(x => previewTemplateIds.some(y => x.id === y));
      setPreviewTemplates(_previewTemplates);
    }
  }, [templates]);

  async function fromFile() {
    fileUploadRef.current?.click();
  }

  const handleFileChange = event => {
    const fileUploaded = event.target.files[0];
    const reader = new FileReader();

    reader.onload = event => {
      setSelectedTemplate({
        title: "From file",
        code: "from-file",
        category: "General",
        description: "Custom uploaded file",
        content: event.target?.result as string
      });
      setEditedManifest(event.target?.result as string);
      router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
    };

    reader.readAsText(fileUploaded);
  };

  function onSDLBuilderClick() {
    setSdlEditMode("builder");
    router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
  }

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.deploymentList());
    }
  }

  return (
    <>
      <CustomNextSeo title="Create Deployment - Template List" url={`${domainName}${UrlService.newDeployment({ step: RouteStepKeys.chooseTemplate })}`} />

      <div className="mb-8 mt-8 flex items-center">
        <Button aria-label="back" onClick={handleBackClick} size="icon" variant="ghost">
          <NavArrowLeft />
        </Button>
        <h1 className="ml-4 text-2xl">
          <strong>What do you want to deploy?</strong>
        </h1>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <DeployOptionBox
            title={helloWorldTemplate.title}
            description={helloWorldTemplate.description}
            icon={<Rocket className="rotate-45" />}
            onClick={() => router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: helloWorldTemplate.code }))}
          />

          <DeployOptionBox
            title="Rent GPUs"
            description="Rent GPUs from the Akash Network providers to run your AI workloads."
            icon={<Cpu />}
            onClick={() => router.push(UrlService.rentGpus())}
          />

          <DeployOptionBox
            title={"Build your template"}
            description={"With our new SDL Builder, you can create your own SDL from scratch in a few clicks!"}
            icon={<Wrench />}
            onClick={onSDLBuilderClick}
          />

          <input type="file" ref={fileUploadRef} onChange={handleFileChange} style={{ display: "none" }} accept=".yml,.yaml,.txt" />
          <DeployOptionBox title={"Upload SDL"} description={"Upload a deploy.yml file from the computer."} icon={<Page />} onClick={() => fromFile()} />
        </div>
      </div>

      <div className="mb-4 flex items-center">
        <h5>
          <strong>Staff Picks</strong>
        </h5>

        <Link href={UrlService.templates()} className="ml-4 flex items-center">
          Search marketplace
          <ArrowRight className="ml-2 text-xs" />
        </Link>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <DeployOptionBox
            title={ubuntuTemplate.title}
            description={ubuntuTemplate.description}
            imageUrl="/images/ubuntu.png"
            onClick={() => router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: ubuntuTemplate.code }))}
          />

          {previewTemplates.map(template => (
            <TemplateBox
              key={template.id}
              template={template}
              linkHref={UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: template?.id })}
            />
          ))}
        </div>
      </div>

      <div className="pb-8 text-center">
        <Link href={UrlService.templates()} className={cn(buttonVariants({ size: "lg", variant: "default" }))}>
          See all categories
        </Link>
      </div>
    </>
  );
};
