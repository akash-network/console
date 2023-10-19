import { useState, useEffect, Dispatch, useRef } from "react";
import { Box, Typography, Button, TextField, CircularProgress, Tooltip, Alert, useMediaQuery, useTheme, ButtonGroup } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForward";
import { useSettings } from "../../context/SettingsProvider";
import { makeStyles } from "tss-react/mui";
import { useWallet } from "@src/context/WalletProvider";
import { useRouter } from "next/router";
import { Timer } from "@src/utils/timer";
import { defaultInitialDeposit, RouteStepKeys } from "@src/utils/constants";
import { deploymentData } from "@src/utils/deploymentData";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { LinkTo } from "../shared/LinkTo";
import { DynamicMonacoEditor } from "../shared/DynamicMonacoEditor";
import ViewPanel from "../shared/ViewPanel";
import { DeploymentDepositModal } from "../deploymentDetail/DeploymentDepositModal";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { saveDeploymentManifestAndName } from "@src/utils/deploymentLocalDataUtils";
import { UrlService } from "@src/utils/urlUtils";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { PrerequisiteList } from "./PrerequisiteList";
import { TemplateCreation } from "@src/types";
import { useCertificate } from "@src/context/CertificateProvider";
import { generateCertificate } from "@src/utils/certificateUtils";
import { updateWallet } from "@src/utils/walletUtils";
import sdlStore from "@src/store/sdlStore";
import { useAtom } from "jotai";
import { SdlBuilder, SdlBuilderRefType } from "./SdlBuilder";

const yaml = require("js-yaml");

const useStyles = makeStyles()(theme => ({
  tooltip: {
    fontSize: "1rem"
  },
  tooltipIcon: {
    fontSize: "1.5rem",
    marginRight: "1rem",
    color: theme.palette.text.secondary
  },
  alert: {
    marginBottom: "1rem"
  }
}));

type Props = {
  selectedTemplate: TemplateCreation;
  editedManifest: string;
  setEditedManifest: Dispatch<string>;
};

export const ManifestEdit: React.FunctionComponent<Props> = ({ editedManifest, setEditedManifest, selectedTemplate }) => {
  const [parsingError, setParsingError] = useState(null);
  const [deploymentName, setDeploymentName] = useState("");
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(false);
  const [selectedSdlEditMode, setSelectedSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);
  const [sdlDenom, setSdlDenom] = useState("uakt");
  const { settings } = useSettings();
  const { address, signAndBroadcastTx } = useWallet();
  const router = useRouter();
  const { classes } = useStyles();
  const { loadValidCertificates, localCert, isLocalCertMatching, loadLocalCert, setSelectedCertificate } = useCertificate();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const sdlBuilderRef = useRef<SdlBuilderRefType>(null);

  useEffect(() => {
    if (selectedTemplate?.name) {
      setDeploymentName(selectedTemplate.name);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = Timer(500);

    timer.start().then(() => {
      createAndValidateDeploymentData(editedManifest, "TEST_DSEQ_VALIDATION");
    });

    return () => {
      if (timer) {
        timer.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedManifest]);

  async function handleTextChange(value) {
    setEditedManifest(value);
  }

  async function createAndValidateDeploymentData(yamlStr, dseq = null, deposit = defaultInitialDeposit, depositorAddress = null) {
    try {
      if (!yamlStr) return null;

      const doc = yaml.load(yamlStr);
      const dd = await deploymentData.NewDeploymentData(settings.apiEndpoint, doc, dseq, address, deposit, depositorAddress);
      validateDeploymentData(dd);

      setSdlDenom(dd.deposit.denom);

      setParsingError(null);

      return dd;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        setParsingError(err.message);
      } else if (err.name === "TemplateValidation") {
        setParsingError(err.message);
      } else {
        setParsingError("Error while parsing SDL file");
        console.error(err);
      }
    }
  }

  function handleDocClick(ev, url) {
    ev.preventDefault();

    window.open(url, "_blank");
  }

  /**
   * Validate values to change in the template
   */
  function validateDeploymentData(deploymentData) {
    if (selectedTemplate?.valuesToChange) {
      for (const valueToChange of selectedTemplate.valuesToChange) {
        if (valueToChange.field === "accept" || valueToChange.field === "env") {
          const serviceNames = Object.keys(deploymentData.sdl.services);
          for (const serviceName of serviceNames) {
            if (
              deploymentData.sdl.services[serviceName].expose?.some(e => e.accept?.includes(valueToChange.initialValue)) ||
              deploymentData.sdl.services[serviceName].env?.some(e => e?.includes(valueToChange.initialValue))
            ) {
              let error = new Error(`Template value of "${valueToChange.initialValue}" needs to be changed`);
              error.name = "TemplateValidation";

              throw error;
            }
          }
        }
      }
    }
  }

  const onPrerequisiteContinue = () => {
    setIsCheckingPrerequisites(false);
    setIsDepositingDeployment(true);
  };

  const onDeploymentDeposit = async (deposit: number, depositorAddress: string) => {
    setIsDepositingDeployment(false);
    await handleCreateClick(deposit, depositorAddress);
  };

  async function handleCreateClick(deposit: number, depositorAddress: string) {
    setIsCreatingDeployment(true);

    const sdl = selectedSdlEditMode === "yaml" ? editedManifest : sdlBuilderRef.current?.getSdl();
    const dd = await createAndValidateDeploymentData(sdl, null, deposit, depositorAddress);

    const validCertificates = await loadValidCertificates();
    const currentCert = validCertificates.find(x => x.parsed === localCert?.certPem);
    const isCertificateValidated = currentCert?.certificate?.state === "valid";
    const isLocalCertificateValidated = !!localCert && isLocalCertMatching;

    if (!dd) return;

    try {
      const messages = [];
      const hasValidCert = isCertificateValidated && isLocalCertificateValidated;
      let _crtpem: string;
      let _encryptedKey: string;

      // Create a cert if the user doesn't have one
      if (!hasValidCert) {
        const { crtpem, pubpem, encryptedKey } = generateCertificate(address);
        _crtpem = crtpem;
        _encryptedKey = encryptedKey;
        messages.push(TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem));
      }

      messages.push(TransactionMessageData.getCreateDeploymentMsg(dd));
      const response = await signAndBroadcastTx(messages);

      if (response) {
        // Set the new cert in storage
        if (!hasValidCert) {
          updateWallet(address, wallet => {
            return {
              ...wallet,
              cert: _crtpem,
              certKey: _encryptedKey
            };
          });
          const validCerts = await loadValidCertificates();
          loadLocalCert();
          const currentCert = validCerts.find(x => x.parsed === _crtpem);
          setSelectedCertificate(currentCert);
        }

        setDeploySdl(null);

        // Save the manifest
        saveDeploymentManifestAndName(dd.deploymentId.dseq, sdl, dd.version, address, deploymentName);
        router.replace(UrlService.newDeployment({ step: RouteStepKeys.createLeases, dseq: dd.deploymentId.dseq }));

        event(AnalyticsEvents.CREATE_DEPLOYMENT, {
          category: "deployments",
          label: "Create deployment in wizard"
        });
      } else {
        setIsCreatingDeployment(false);
      }
    } catch (error) {
      setIsCreatingDeployment(false);
      throw error;
    }
  }

  const onModeChange = (mode: "yaml" | "builder") => {
    if (mode === selectedSdlEditMode) return;

    if (mode === "yaml") {
      const sdl = sdlBuilderRef.current?.getSdl();
      setEditedManifest(sdl);
    }

    setSelectedSdlEditMode(mode);
  };

  return (
    <>
      <CustomNextSeo
        title="Create Deployment - Manifest Edit"
        url={`https://deploy.cloudmos.io${UrlService.newDeployment({ step: RouteStepKeys.editDeployment })}`}
      />

      <Box sx={{ marginBottom: ".5rem" }}>
        <Box
          sx={{
            marginBottom: ".5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "column", md: "row" }
          }}
        >
          <Box sx={{ flexGrow: 1, paddingRight: { xs: 0, sm: 0, md: "1rem" }, width: "100%" }}>
            <TextField
              value={deploymentName}
              onChange={ev => setDeploymentName(ev.target.value)}
              fullWidth
              label="Name your deployment (optional)"
              variant="outlined"
              size="small"
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", width: { xs: "100%", sm: "100%", md: "auto" }, paddingTop: { xs: ".5rem", md: 0 } }}>
            <Tooltip
              classes={{ tooltip: classes.tooltip }}
              arrow
              title={
                <>
                  <Typography>
                    You may use the sample deployment file as-is or modify it for your own needs as described in the{" "}
                    <LinkTo onClick={ev => handleDocClick(ev, "https://docs.akash.network/intro-to-akash/stack-definition-language")}>
                      SDL (Stack Definition Language)
                    </LinkTo>{" "}
                    documentation. A typical modification would be to reference your own image instead of the demo app image.
                  </Typography>
                </>
              }
            >
              <InfoIcon className={classes.tooltipIcon} />
            </Tooltip>

            <Button
              variant="contained"
              color="secondary"
              disabled={isCreatingDeployment || !!parsingError || !editedManifest}
              onClick={() => setIsCheckingPrerequisites(true)}
              sx={{ whiteSpace: "nowrap", width: { xs: "100%", sm: "auto" } }}
            >
              {isCreatingDeployment ? (
                <CircularProgress size="24px" color="secondary" />
              ) : (
                <>
                  Create Deployment{" "}
                  <Box component="span" marginLeft=".5rem" display="flex" alignItems="center">
                    <ArrowForwardIosIcon fontSize="small" />
                  </Box>
                </>
              )}
            </Button>
          </Box>
        </Box>

        <ButtonGroup size="small">
          <Button
            variant={selectedSdlEditMode === "builder" ? "contained" : "outlined"}
            color={selectedSdlEditMode === "builder" ? "secondary" : "primary"}
            onClick={() => onModeChange("builder")}
          >
            Builder
          </Button>
          <Button
            variant={selectedSdlEditMode === "yaml" ? "contained" : "outlined"}
            color={selectedSdlEditMode === "yaml" ? "secondary" : "primary"}
            onClick={() => onModeChange("yaml")}
          >
            YAML
          </Button>
        </ButtonGroup>
      </Box>

      {parsingError && <Alert severity="warning">{parsingError}</Alert>}

      {selectedSdlEditMode === "yaml" && (
        <ViewPanel stickToBottom style={{ overflow: "hidden", margin: smallScreen ? "0 -1rem" : 0 }}>
          <DynamicMonacoEditor value={editedManifest} onChange={handleTextChange} />
        </ViewPanel>
      )}
      {selectedSdlEditMode === "builder" && <SdlBuilder sdlString={editedManifest} ref={sdlBuilderRef} setEditedManifest={setEditedManifest} />}

      {isDepositingDeployment && (
        <DeploymentDepositModal
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
          min={5} // TODO Query from chain params
          denom={sdlDenom}
          infoText={
            <Alert severity="info" className={classes.alert} variant="outlined">
              <Typography variant="caption">
                To create a deployment, you need to have at least <b>5 AKT</b> or <b>5 USDC</b> in an escrow account.{" "}
                <LinkTo onClick={ev => handleDocClick(ev, "https://docs.akash.network/glossary/escrow#escrow-accounts")}>
                  <strong>Learn more.</strong>
                </LinkTo>
              </Typography>
            </Alert>
          }
        />
      )}
      {isCheckingPrerequisites && <PrerequisiteList onClose={() => setIsCheckingPrerequisites(false)} onContinue={onPrerequisiteContinue} />}
    </>
  );
};
