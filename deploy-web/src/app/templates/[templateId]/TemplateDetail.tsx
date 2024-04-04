"use client";
import { useState } from "react";
import { Box, Tabs, Button, Tab, Typography, IconButton, useTheme, Container } from "@mui/material";
import PublishIcon from "@mui/icons-material/Publish";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import GitHubIcon from "@mui/icons-material/GitHub";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import ViewPanel from "@src/components/shared/ViewPanel";
import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { PageContainer } from "@src/components/shared/PageContainer";
import { BASE_API_MAINNET_URL, RouteStepKeys } from "@src/utils/constants";
import axios from "axios";
import { ApiTemplate } from "@src/types";
import Markdown from "@src/components/shared/Markdown";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { getShortText } from "@src/utils/stringUtils";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { useTemplates } from "@src/context/TemplatesProvider";

const useStyles = makeStyles()(theme => ({
  root: {
    "& img": {
      maxWidth: "100%"
    }
  },
  titleContainer: {
    display: "flex",
    padding: "0.5rem 1rem"
  },
  tabsRoot: {
    minHeight: "36px",
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[200],
    "& button": {
      minHeight: "36px"
    }
  },
  selectedTab: {
    fontWeight: "bold"
  },
  tabsContainer: {
    justifyContent: "center"
  }
}));

type Props = {
  templateId: string;
  template: ApiTemplate;
};

export const TemplateDetail: React.FunctionComponent<Props> = ({ templateId, template }) => {
  const [activeTab, setActiveTab] = useState("README");
  const { getTemplateById, isLoading } = useTemplates();
  const router = useRouter();
  const { classes } = useStyles();
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
    <div className={classes.root}>
      <Tabs
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
      </Tabs>
      <LinearLoadingSkeleton isLoading={isLoading} />

      <Container className={classes.titleContainer}>
        <Box display="flex" alignItems="center" className="text-truncate">
          <IconButton aria-label="back" onClick={handleBackClick}>
            <ChevronLeftIcon />
          </IconButton>
          <div className="text-truncate">
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: "1rem", sm: "1.5rem", md: "2rem" },
                fontWeight: "bold",
                marginLeft: "1rem"
              }}
            >
              {_template?.name}
            </Typography>
          </div>

          <Box marginLeft="1rem">
            <IconButton aria-label="View on github" title="View on Github" onClick={handleOpenGithub} size="medium">
              <GitHubIcon fontSize="medium" />
            </IconButton>
          </Box>

          <Button
            href={UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: _template?.id })}
            component={Link}
            sx={{ marginLeft: { xs: "1rem", sm: "1rem", md: "2rem" } }}
            variant="contained"
            size="medium"
            color="secondary"
          >
            <PublishIcon />
            &nbsp;Deploy
          </Button>
        </Box>
      </Container>

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
    </div>
  );
};

// export default TemplateDetailPage;
