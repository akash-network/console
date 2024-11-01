"use client";
import React, { useEffect, useState } from "react";
import { buttonVariants, Card } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CardContent } from "@mui/material";
import { ArrowRight, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { useTemplates } from "@src/context/TemplatesProvider";
import sdlStore from "@src/store/sdlStore";
import { ApiTemplate } from "@src/types";
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
};
export const TemplateList: React.FunctionComponent<Props> = ({ onChangeGitProvider }) => {
  const { templates } = useTemplates();
  const router = useRouter();
  const [previewTemplates, setPreviewTemplates] = useState<ApiTemplate[]>([]);
  const [, setSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);

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

  return (
    <>
      <CustomNextSeo title="Create Deployment - Template List" url={`${domainName}${UrlService.newDeployment({ step: RouteStep.chooseTemplate })}`} />

      <div className="mb-8 grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4">
        <div className="col-span-1 grid grid-cols-1 gap-2 md:gap-4">
          <DeployOptionBox
            title="Build & Deploy"
            description="Build & Deploy directly from a code repository (VCS)"
            topIcons={["/images/ubuntu.png", "/images/ubuntu.png", "/images/ubuntu.png"]}
            bottomIcons={["/images/ubuntu.png", "/images/ubuntu.png"]}
            onClick={handleGithubTemplate}
            testId="build-and-deploy-card"
          />

          <DeployOptionBox
            title="Launch Your Container-VM"
            description="Deploy and work with a plain-linux vm-like container"
            topIcons={["/images/docker.png", "/images/ubuntu.png"]}
            bottomIcons={["/images/ubuntu.png", "/images/ubuntu.png"]}
            onClick={() => onSDLBuilderClick("deploy-linux")}
            testId="plain-linux-card"
          />

          <DeployOptionBox
            title="Run Custom Container"
            description="Deploy and run your own docker container stored in a private or public container registry"
            topIcons={["/images/ubuntu.png"]}
            onClick={() => onSDLBuilderClick()}
            testId="custom-container-card"
          />

          <Link
            href={UrlService.newDeployment({ step: RouteStep.editDeployment })}
            className={cn(buttonVariants({ variant: "outline" }), "space-x-2 bg-card text-foreground")}
            onClick={() => setSdlEditMode("builder")}
          >
            <Upload className="text-xs" />
            <span className="text-sm">Upload SDL</span>
          </Link>
        </div>

        <Card className="col-span-3">
          <CardContent>
            <div className="mb-4">
              <h3 className="mb-2 text-xl font-bold tracking-tight">Explore Templates</h3>

              <p className="text-sm text-muted-foreground">
                Browse through the marketplace of pre-made solutions with categories like AI&ML, Blockchain nodes and more!
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

              {/* <DeployOptionBox
                title={helloWorldTemplate.title}
                description={helloWorldTemplate.description}
                icon={<Rocket className="rotate-45" />}
                testId="hello-world-card"
                onClick={() => router.push(UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: helloWorldTemplate.code }))}
              /> */}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
