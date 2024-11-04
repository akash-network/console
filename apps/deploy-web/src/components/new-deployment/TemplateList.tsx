"use client";
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Button, buttonVariants, Card } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CardContent } from "@mui/material";
import { ArrowRight, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useTemplates } from "@src/context/TemplatesProvider";
import sdlStore from "@src/store/sdlStore";
import { ApiTemplate, TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { helloWorldTemplate } from "@src/utils/templates";
import { domainName, NewDeploymentParams, UrlService } from "@src/utils/urlUtils";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { TemplateBox } from "../templates/TemplateBox";
import { DeployOptionBox } from "./DeployOptionBox";

const previewTemplateIds = [
  "akash-network-awesome-akash-Llama-3.1-8B",
  "akash-network-awesome-akash-Llama-3.1-405B-FP8",
  "akash-network-awesome-akash-Llama-3.1-405B-BF16",
  "akash-network-awesome-akash-FLock-training-node",
  "akash-network-awesome-akash-tensorflow-jupyter-mnist",
  "akash-network-awesome-akash-comfyui",
  "akash-network-awesome-akash-Falcon-7B",
  "akash-network-awesome-akash-stable-diffusion-ui",
  "akash-network-awesome-akash-bert",
  "akash-network-awesome-akash-open-gpt",
  "akash-network-awesome-akash-grok",
  "akash-network-awesome-akash-FastChat"
];

type Props = {
  onChangeGitProvider: (gh: boolean) => void;
  onTemplateSelected: Dispatch<TemplateCreation | null>;
  setEditedManifest: Dispatch<SetStateAction<string>>;
};

export const TemplateList: React.FunctionComponent<Props> = ({ onChangeGitProvider, onTemplateSelected, setEditedManifest }) => {
  const { templates } = useTemplates();
  const router = useRouter();
  const [previewTemplates, setPreviewTemplates] = useState<ApiTemplate[]>([]);
  const [, setSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const handleGithubTemplate = async () => {
    onChangeGitProvider(true);
    router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, gitProvider: "github", templateId: CI_CD_TEMPLATE_ID }));
  };

  useEffect(() => {
    if (templates) {
      const _previewTemplates = previewTemplateIds.map(x => templates.find(y => x === y.id)).filter(x => !!x);
      setPreviewTemplates(_previewTemplates as ApiTemplate[]);
    }
  }, [templates]);

  function onSDLBuilderClick(page: NewDeploymentParams["page"] = "new-deployment") {
    setSdlEditMode("builder");
    router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, page }));
  }

  const propagateUploadedSdl = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ?? [];
    const hasFileSelected = selectedFiles.length > 0;
    if (!hasFileSelected) return;
    const fileUploaded = selectedFiles[0];

    const reader = new FileReader();

    reader.onload = event => {
      onTemplateSelected({
        title: "From file",
        code: "from-file",
        category: "General",
        description: "Custom uploaded file",
        content: event.target?.result as string
      });
      setEditedManifest(event.target?.result as string);
      setSdlEditMode("yaml");

      router.push(UrlService.newDeployment({ step: RouteStep.editDeployment }));
    };

    reader.readAsText(fileUploaded);
  };

  const onSdlUpload = () => {
    if (fileUploadRef.current) {
      fileUploadRef.current.value = "";
      fileUploadRef.current.click();
    }
  };

  return (
    <div className="my-0 md:my-12">
      <CustomNextSeo title="Create Deployment - Template List" url={`${domainName}${UrlService.newDeployment({ step: RouteStep.chooseTemplate })}`} />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="col-span-3 grid grid-cols-1 gap-4 md:col-span-1">
          <DeployOptionBox
            title="Build & Deploy"
            description="Build & Deploy directly from a code repository (VCS)"
            topIcons={["/images/github.png", "/images/gitlab.png", "/images/bitbucket.png"]}
            bottomIcons={["/images/nextjs.png", "/images/vuejs.png", "/images/astrojs.png", "/images/python.png"]}
            onClick={handleGithubTemplate}
            testId="build-and-deploy-card"
          />

          <DeployOptionBox
            title="Launch Container-VM"
            description="Deploy and work with a plain-linux vm-like container"
            topIcons={["/images/docker-logo.png", "/images/vm.png"]}
            bottomIcons={["/images/ubuntu.png", "/images/centos.png", "/images/debian.png", "/images/suse.png"]}
            onClick={() => onSDLBuilderClick("deploy-linux")}
            testId="plain-linux-card"
          />

          <DeployOptionBox
            title="Run Custom Container"
            description="Run your own docker container stored in a private or public container registry"
            topIcons={["/images/docker-logo.png"]}
            onClick={() => onSDLBuilderClick()}
            testId="custom-container-card"
          />

          <input type="file" ref={fileUploadRef} onChange={propagateUploadedSdl} className="hidden" accept=".yml,.yaml,.txt" />
          <Button variant="outline" onClick={() => onSdlUpload()} size="sm" className="space-x-2 bg-card text-foreground">
            <Upload className="text-xs" />
            <span className="text-xs">Upload your SDL</span>
          </Button>
        </div>

        <Card className="col-span-3">
          <CardContent>
            <div className="mb-4">
              <h3 className="mb-2 text-xl font-bold tracking-tight">Explore Templates</h3>

              <p className="text-sm text-muted-foreground">
                Browse through the marketplace of pre-made solutions with categories like AI&ML, Blockchain nodes and more!{" "}
                <Link
                  href={UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: helloWorldTemplate.code })}
                  className="text-inherit underline"
                  data-testid="hello-world-card"
                >
                  Try hello world app!
                </Link>
              </p>
            </div>

            <div className="my-6">
              <Link href={UrlService.templates()} className="flex items-center space-x-2 text-xs font-bold text-muted-foreground">
                <span>View All Templates</span>
                <ArrowRight className="text-xs" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {previewTemplates.map(template => (
                <TemplateBox
                  key={template.id}
                  template={template}
                  linkHref={UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: template?.id })}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
