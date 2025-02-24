"use client";
import React, { useEffect, useState } from "react";
import { Card, FileButton } from "@akashnetwork/ui/components";
import { CardContent } from "@mui/material";
import { ArrowRight, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useTemplates } from "@src/context/TemplatesProvider";
import { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { helloWorldTemplate } from "@src/utils/templates";
import { domainName, NewDeploymentParams, UrlService } from "@src/utils/urlUtils";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { TemplateBox } from "../templates/TemplateBox";
import { DeployOptionBox } from "./DeployOptionBox";

const previewTemplateIds = [
  "akash-network-awesome-akash-DeepSeek-R1-Distill-Llama-70B",
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
  onTemplateSelected: (template: TemplateCreation | null) => void;
  setEditedManifest: (manifest: string) => void;
};

export const TemplateList: React.FunctionComponent<Props> = ({ onChangeGitProvider, onTemplateSelected, setEditedManifest }) => {
  const { templates } = useTemplates();
  const router = useRouter();
  const [previewTemplates, setPreviewTemplates] = useState<TemplateOutputSummaryWithCategory[]>([]);
  const [, setSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);

  const handleGithubTemplate = async () => {
    onChangeGitProvider(true);
    router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, gitProvider: "github", templateId: CI_CD_TEMPLATE_ID }));
  };

  useEffect(() => {
    if (templates) {
      const _previewTemplates = previewTemplateIds.map(id => templates.find(template => template.id === id)).filter(x => !!x);
      setPreviewTemplates(_previewTemplates);
    }
  }, [templates]);

  function onSDLBuilderClick(page: NewDeploymentParams["page"] = "new-deployment") {
    setEditedManifest("");
    onTemplateSelected(null);
    setSdlEditMode("builder");
    router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, page }));
  }

  const onFileSelect = (file: File | null) => {
    if (!file) return;

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

    reader.readAsText(file);
  };

  return (
    <div className="my-0 pb-8 md:my-12">
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

          <FileButton onFileSelect={onFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="outline" className="space-x-2 bg-card text-foreground">
            <Upload className="text-xs" />
            <span className="text-xs">Upload your SDL</span>
          </FileButton>
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
              <Link href={UrlService.templates()} className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground">
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
