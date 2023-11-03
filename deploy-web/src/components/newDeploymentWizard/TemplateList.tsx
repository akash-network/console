import React, { Dispatch, useEffect, useRef, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DescriptionIcon from "@mui/icons-material/Description";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { RouteStepKeys } from "@src/utils/constants";
import { useTemplates } from "@src/context/TemplatesProvider";
import { TemplateBox } from "../templates/TemplateBox";
import { DeployOptionBox } from "./DeployOptionBox";
import Link from "next/link";
import { BuildCircleTwoTone } from "@mui/icons-material";
import { TemplateCreation } from "@src/types";
import { emptyTemplate, helloWorldTemplate, ubuntuTemplate } from "@src/utils/templates";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";

const useStyles = makeStyles()(theme => ({}));

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
  const { classes } = useStyles();
  const router = useRouter();
  const fileUploadRef = useRef(null);
  const [previewTemplates, setPreviewTemplates] = useState([]);
  const [, setSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);

  useEffect(() => {
    if (templates) {
      const _previewTemplates = templates.filter(x => previewTemplateIds.some(y => x.id === y));
      setPreviewTemplates(_previewTemplates);
    }
  }, [templates]);

  function selectTemplate(template) {
    setSelectedTemplate(template);
    setEditedManifest(template.content);
    router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
  }

  async function fromFile() {
    fileUploadRef.current.click();
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
        content: event.target.result as string
      });
      setEditedManifest(event.target.result as string);
      router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
    };

    reader.readAsText(fileUploaded);
  };

  function onSDLBuilderClick() {
    setSdlEditMode("builder");
    router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
  }

  return (
    <>
      <CustomNextSeo
        title="Create Deployment - Template List"
        url={`https://deploy.cloudmos.io${UrlService.newDeployment({ step: RouteStepKeys.chooseTemplate })}`}
      />

      <Typography variant="h1" sx={{ marginBottom: "2rem", fontSize: "2rem", marginTop: "2rem" }}>
        <strong>What do you want to deploy?</strong>
      </Typography>

      <Box sx={{ marginBottom: "2rem" }}>
        <Box
          sx={{
            gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(2,1fr)", md: "repeat(4,1fr)" },
            display: "grid",
            gap: { xs: ".5rem", sm: ".5rem", md: "1rem" }
          }}
        >
          <DeployOptionBox
            title={helloWorldTemplate.title}
            description={helloWorldTemplate.description}
            icon={<RocketLaunchIcon />}
            onClick={() => router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment, templateId: helloWorldTemplate.code }))}
          />

          <DeployOptionBox
            title={"Build your template"}
            description={"With our new SDL Builder, you can create your own SDL from scratch in a few clicks!"}
            icon={<BuildCircleTwoTone />}
            onClick={onSDLBuilderClick}
          />

          <input type="file" ref={fileUploadRef} onChange={handleFileChange} style={{ display: "none" }} accept=".yml,.yaml,.txt" />
          <DeployOptionBox
            title={"Upload SDL"}
            description={"Upload a deploy.yml file from the computer."}
            icon={<DescriptionIcon />}
            onClick={() => fromFile()}
          />

          <DeployOptionBox
            title={emptyTemplate.title}
            description={emptyTemplate.description}
            icon={<InsertDriveFileIcon />}
            onClick={() => selectTemplate(emptyTemplate)}
          />
        </Box>
      </Box>

      <Box sx={{ display: "flex", alingItems: "center", marginBottom: "1rem" }}>
        <Typography variant="h5">
          <strong>Staff Picks</strong>
        </Typography>

        <Box component={Link} href={UrlService.templates()} sx={{ display: "flex", alignItems: "center", fontSize: "1rem", marginLeft: "1rem" }}>
          Search marketplace <ArrowForwardIcon fontSize="small" sx={{ marginLeft: ".5rem" }} />
        </Box>
      </Box>

      <Box sx={{ marginBottom: "2rem" }}>
        <Box
          sx={{
            gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(2,1fr)", md: "repeat(4,1fr)" },
            display: "grid",
            gap: { xs: ".5rem", sm: ".5rem", md: "1rem" }
          }}
        >
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
        </Box>
      </Box>

      <Box sx={{ textAlign: "center", paddingBottom: "2rem" }}>
        <Button href={UrlService.templates()} component={Link} variant="contained" color="secondary">
          See all categories
        </Button>
      </Box>
    </>
  );
};
