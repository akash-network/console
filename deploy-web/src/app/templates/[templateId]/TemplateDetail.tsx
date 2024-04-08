"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import ViewPanel from "@src/components/shared/ViewPanel";
import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { PageContainer } from "@src/components/shared/PageContainer";
import { RouteStepKeys } from "@src/utils/constants";
import { ApiTemplate } from "@src/types";
import Markdown from "@src/components/shared/Markdown";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { useTemplates } from "@src/context/TemplatesProvider";
import { Tabs, TabsList, TabsTrigger } from "@src/components/ui/tabs";
import { NavArrowLeft, Rocket } from "iconoir-react";
import { Button, buttonVariants } from "@src/components/ui/button";
import { cn } from "@src/utils/styleUtils";
import GitHubIcon from "@mui/icons-material/GitHub";

type Props = {
  templateId: string;
  template: ApiTemplate;
};

export const TemplateDetail: React.FunctionComponent<Props> = ({ templateId, template }) => {
  const [activeTab, setActiveTab] = useState("README");
  const { getTemplateById, isLoading } = useTemplates();
  const router = useRouter();
  const _template = template || getTemplateById(templateId);
  const previousRoute = usePreviousRoute();

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.templates());
    }
  }

  function handleOpenGithub() {
    window.open(_template.githubUrl, "_blank");
  }

  return (
    <div className="[&>img]:max-w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="README" className={cn({ ["font-bold"]: activeTab === "README" })}>
            README
          </TabsTrigger>
          <TabsTrigger value="SDL" className={cn({ ["font-bold"]: activeTab === "SDL" })}>
            View SDL
          </TabsTrigger>
          {_template?.guide && (
            <TabsTrigger value="GUIDE" className={cn({ ["font-bold"]: activeTab === "GUIDE" })}>
              Guide
            </TabsTrigger>
          )}
        </TabsList>
        <LinearLoadingSkeleton isLoading={isLoading} />

        <div className="container flex h-full px-4 py-2 sm:pt-8">
          <div className="flex items-center truncate">
            <Button aria-label="back" onClick={handleBackClick} size="icon" variant="ghost">
              <NavArrowLeft />
            </Button>
            <div className="text-truncate">
              <h3 className="ml-4 text-xl font-bold sm:text-2xl md:text-3xl">{_template?.name}</h3>
            </div>

            <div className="ml-4">
              <Button aria-label="View on github" title="View on Github" onClick={handleOpenGithub} size="icon" variant="ghost">
                <GitHubIcon fontSize="medium" />
              </Button>
            </div>

            <Link
              className={cn(buttonVariants({ variant: "default" }), "ml-4 md:ml-8")}
              href={UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: _template?.id })}
            >
              Deploy&nbsp;
              <Rocket className="rotate-45" />
            </Link>
          </div>
        </div>

        {activeTab === "README" && (
          <ViewPanel stickToBottom style={{ overflow: "auto" }}>
            <PageContainer>
              <Markdown>{_template?.readme}</Markdown>
            </PageContainer>
          </ViewPanel>
        )}
        {activeTab === "SDL" && (
          <ViewPanel stickToBottom style={{ overflow: "hidden" }}>
            <PageContainer className="h-full">
              <DynamicMonacoEditor height="100%" language="yaml" value={_template?.deploy || ""} options={{ readOnly: true }} />
            </PageContainer>
          </ViewPanel>
        )}
        {activeTab === "GUIDE" && (
          <ViewPanel stickToBottom style={{ overflow: "auto", padding: "1rem" }}>
            <PageContainer>
              <Markdown>{_template?.guide}</Markdown>
            </PageContainer>
          </ViewPanel>
        )}
      </Tabs>
    </div>
  );
};
