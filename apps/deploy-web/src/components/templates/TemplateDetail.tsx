"use client";

import type { FC } from "react";
import { useCallback, useState } from "react";
import { Button, buttonVariants, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import GitHubIcon from "@mui/icons-material/GitHub";
import { NavArrowLeft, Rocket } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import Markdown from "@src/components/shared/Markdown";
import ViewPanel from "@src/components/shared/ViewPanel";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import type { ApiTemplate } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";

export interface TemplateDetailProps {
  template: ApiTemplate;
}

export const TemplateDetail: FC<TemplateDetailProps> = ({ template }) => {
  const [activeTab, setActiveTab] = useState("README");
  const router = useRouter();
  const previousRoute = usePreviousRoute();

  const goBack = useCallback(() => {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.templates());
    }
  }, [previousRoute, router]);

  const openGithub = useCallback(() => {
    window.open(template.githubUrl, "_blank");
  }, [template]);

  return (
    <Layout disableContainer>
      <div className="[&>img]:max-w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-none">
            <TabsTrigger value="README" className={cn({ ["font-bold"]: activeTab === "README" })}>
              README
            </TabsTrigger>
            <TabsTrigger value="SDL" className={cn({ ["font-bold"]: activeTab === "SDL" })}>
              View SDL
            </TabsTrigger>
            {template.guide && (
              <TabsTrigger value="GUIDE" className={cn({ ["font-bold"]: activeTab === "GUIDE" })}>
                Guide
              </TabsTrigger>
            )}
          </TabsList>

          <div className="container flex h-full px-4 py-2 sm:pt-8">
            <div className="flex items-center truncate">
              <Button aria-label="back" onClick={goBack} size="icon" variant="ghost">
                <NavArrowLeft />
              </Button>
              <div className="text-truncate">
                <h3 className="ml-4 text-xl font-bold sm:text-2xl md:text-3xl">{template.name}</h3>
              </div>

              <div className="ml-4">
                <Button aria-label="View on github" title="View on Github" onClick={openGithub} size="icon" variant="ghost">
                  <GitHubIcon fontSize="medium" />
                </Button>
              </div>

              <Link
                className={cn(buttonVariants({ variant: "default" }), "ml-4 md:ml-8")}
                href={UrlService.newDeployment({ step: RouteStep.editDeployment, templateId: template.id })}
              >
                Deploy&nbsp;
                <Rocket className="rotate-45" />
              </Link>
            </div>
          </div>

          {activeTab === "README" && (
            <ViewPanel stickToBottom className="overflow-auto pb-12">
              <div className="container pb-8 pt-4 sm:pt-8">
                <Markdown hasHtml={template.id?.startsWith("akash-network-awesome-akash")}>{template.readme}</Markdown>
              </div>
            </ViewPanel>
          )}
          {activeTab === "SDL" && (
            <ViewPanel stickToBottom className="overflow-hidden">
              <div className="container h-full pb-8 pt-4 sm:pt-8">
                <DynamicMonacoEditor height="100%" language="yaml" value={template.deploy || ""} options={{ readOnly: true }} />
              </div>
            </ViewPanel>
          )}
          {activeTab === "GUIDE" && (
            <ViewPanel stickToBottom className="overflow-auto p-4 pb-12">
              <div className="container h-full pb-8 pt-4 sm:pt-8">
                <Markdown>{template.guide}</Markdown>
              </div>
            </ViewPanel>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};
