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

// const useStyles = makeStyles()(theme => ({
//   root: {
//     "& img": {
//       maxWidth: "100%"
//     }
//   },
//   titleContainer: {
//     display: "flex",
//     padding: "0.5rem 1rem"
//   },
//   tabsRoot: {
//     minHeight: "36px",
//     borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[200],
//     "& button": {
//       minHeight: "36px"
//     }
//   },
//   selectedTab: {
//     fontWeight: "bold"
//   },
//   tabsContainer: {
//     justifyContent: "center"
//   }
// }));

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
          <TabsTrigger value="README">README</TabsTrigger>
          <TabsTrigger value="SDL">View SDL</TabsTrigger>
          {_template?.guide && <TabsTrigger value="GUIDE">Guide</TabsTrigger>}
        </TabsList>
        {/* <Tabs
        value={activeTab}
        onChange={(ev, value) => setActiveTab(value)}
        classes={{ root: classes.tabsRoot, flexContainer: classes.tabsContainer }}
        indicatorColor="secondary"
        textColor="secondary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="README" label="README" classes={{ selected: classes.selectedTab }} />
        <Tab value="SDL" label="View SDL" classes={{ selected: classes.selectedTab }} />
        {_template?.guide && <Tab value="GUIDE" label="GUIDE" />}
      </Tabs> */}
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
