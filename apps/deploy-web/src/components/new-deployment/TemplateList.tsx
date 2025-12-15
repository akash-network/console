"use client";
import React, { useEffect, useState } from "react";
import { buttonVariants, Card, CardContent, CardHeader, FileButton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { OpenNewWindow, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { helloWorldTemplate } from "@src/utils/templates";
import type { NewDeploymentParams } from "@src/utils/urlUtils";
import { domainName, UrlService } from "@src/utils/urlUtils";
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
    analyticsService.track("build_n_deploy_btn_clk", "Amplitude");
    onChangeGitProvider(true);
    router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, gitProvider: "github", templateId: CI_CD_TEMPLATE_ID }));
  };

  useEffect(() => {
    if (templates) {
      const _previewTemplates = previewTemplateIds
        .map(id => templates.find(template => template.id === id))
        .filter((template): template is TemplateOutputSummaryWithCategory => template !== undefined);
      setPreviewTemplates(_previewTemplates);
    }
  }, [templates]);

  function onSDLBuilderClick(page: NewDeploymentParams["page"] = "new-deployment") {
    analyticsService.track(page === "deploy-linux" ? "launch_container_vm_btn_clk" : "run_custom_container_btn_clk", "Amplitude");
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
    <div className="my-0 pb-8">
      <CustomNextSeo title="Create Deployment - Template List" url={`${domainName}${UrlService.newDeployment({ step: RouteStep.chooseTemplate })}`} />

      {/* Build Your Own Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Build Your Own</h3>
            <p className="text-sm text-muted-foreground">Select a type or upload your own SDL.</p>
          </div>
          <FileButton onFileSelect={onFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="default" className="space-x-2">
            <Upload className="text-xs" />
            <span>Upload SDL</span>
          </FileButton>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DeployOptionBox
            title="Build and Deploy"
            description="Build & Deploy directly from a code repository (VCS)"
            topIcons={[{ light: "/images/github.png", dark: "/images/github-dark.svg" }, "/images/gitlab.png", "/images/bitbucket.png"]}
            bottomIcons={[
              { light: "/images/nextjs.png", dark: "/images/nextjs-dark.svg" },
              "/images/vuejs.png",
              { light: "/images/astrojs.png", dark: "/images/astrojs-dark.svg" },
              "/images/python.png"
            ]}
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
        </CardContent>
      </Card>

      {/* Explore Templates Section */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Explore Templates</h3>
            <p className="text-sm text-muted-foreground">
              Browse through the marketplace of pre-made solutions with categories like AI & ML, Blockchain nodes and more!{" "}
              <Link
                href={UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: helloWorldTemplate.code })}
                className="text-inherit underline"
                prefetch={false}
                data-testid="hello-world-card"
              >
                Try hello world app!
              </Link>
            </p>
          </div>
          <Link href={UrlService.templates()} prefetch={false} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "space-x-2")}>
            <OpenNewWindow className="text-xs" />
            <span>View All</span>
          </Link>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Template list">
          {previewTemplates.map(template => (
            <TemplateBox
              key={template.id}
              template={template}
              linkHref={UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: template?.id })}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
