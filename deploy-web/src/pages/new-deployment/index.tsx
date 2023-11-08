import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import { useEffect, useState } from "react";
import { Box, Container, IconButton } from "@mui/material";
import { useRouter } from "next/router";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { CustomizedSteppers } from "@src/components/newDeploymentWizard/Stepper";
import { TemplateList } from "@src/components/newDeploymentWizard/TemplateList";
import { RouteStepKeys } from "@src/utils/constants";
import { ManifestEdit } from "@src/components/newDeploymentWizard/ManifestEdit";
import { CreateLease } from "@src/components/newDeploymentWizard/CreateLease";
import { useTemplates } from "@src/context/TemplatesProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { UrlService } from "@src/utils/urlUtils";
import { TemplateCreation } from "@src/types";
import { hardcodedTemplates } from "@src/utils/templates";
import sdlStore from "@src/store/sdlStore";
import { useAtomValue } from "jotai";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";

const steps = ["Choose Template", "Create Deployment", "Choose providers"];

type Props = {};

const useStyles = makeStyles()(theme => ({
  root: {
    height: "100%"
  },
  stepContainer: {
    width: "100%",
    display: "flex",
    alignItems: "center"
  }
}));

const NewDeploymentPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const { isLoading: isLoadingTemplates, templates } = useTemplates();
  const [activeStep, setActiveStep] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCreation>(null);
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const [editedManifest, setEditedManifest] = useState(null);
  const { getDeploymentData } = useLocalNotes();
  const { getTemplateById } = useTemplates();
  const router = useRouter();
  const previousRoute = usePreviousRoute();

  useEffect(() => {
    if (!templates) return;

    const redeployTemplate = getRedeployTemplate();
    const galleryTemplate = getGalleryTemplate();

    if (redeployTemplate) {
      // If it's a redeploy, set the template from local storage
      setSelectedTemplate(redeployTemplate);
      setEditedManifest(redeployTemplate.content);
    } else if (galleryTemplate) {
      // If it's a deploy from the template gallery, load from template data
      setSelectedTemplate(galleryTemplate as TemplateCreation);
      setEditedManifest(galleryTemplate.content);
    }

    const _activeStep = getStepIndexByParam(router.query.step);
    setActiveStep(_activeStep);

    if ((redeployTemplate || galleryTemplate) && router.query.step !== RouteStepKeys.editDeployment) {
      router.replace(UrlService.newDeployment({ ...router.query, step: RouteStepKeys.editDeployment }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query, templates]);

  const getRedeployTemplate = () => {
    let template = null;
    if (router.query.redeploy) {
      const deploymentData = getDeploymentData(router.query.redeploy as string);

      if (deploymentData && deploymentData.manifest) {
        template = {
          name: deploymentData.name,
          code: "empty",
          content: deploymentData.manifest
        };
      }
    }

    return template;
  };

  const getGalleryTemplate = () => {
    if (router.query.templateId) {
      const templateById = getTemplateById(router.query.templateId as string);
      if (templateById) {
        return {
          code: "empty",
          name: templateById.name,
          content: templateById.deploy,
          valuesToChange: templateById.valuesToChange || []
        };
      }

      const hardCodedTemplate = hardcodedTemplates.find(t => t.code === router.query.templateId);
      if (hardCodedTemplate) {
        return hardCodedTemplate;
      }
    }

    // Jotai state template
    if (deploySdl) {
      return deploySdl;
    }

    return null;
  };

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.deploymentList());
    }
  }

  function getStepIndexByParam(step) {
    switch (step) {
      case RouteStepKeys.editDeployment:
        return 1;
      case RouteStepKeys.createLeases:
        return 2;
      case RouteStepKeys.chooseTemplate:
      default:
        return 0;
    }
  }

  return (
    <Layout isLoading={isLoadingTemplates} isUsingSettings isUsingWallet>
      <Container className={classes.root}>
        <div className={classes.stepContainer}>
          <Box paddingBottom=".5rem">
            <IconButton aria-label="back" onClick={handleBackClick} size="medium">
              <ChevronLeftIcon />
            </IconButton>
          </Box>

          {activeStep !== null && <CustomizedSteppers steps={steps} activeStep={activeStep} />}
        </div>

        {activeStep === 0 && <TemplateList setSelectedTemplate={setSelectedTemplate} setEditedManifest={setEditedManifest} />}
        {activeStep === 1 && <ManifestEdit selectedTemplate={selectedTemplate} editedManifest={editedManifest} setEditedManifest={setEditedManifest} />}
        {activeStep === 2 && <CreateLease dseq={router.query.dseq as string} />}
      </Container>
    </Layout>
  );
};

export default NewDeploymentPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
