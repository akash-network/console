import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsProvider";
import { useSnackbar } from "notistack";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import { makeStyles } from "tss-react/mui";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { useCertificate } from "@src/context/CertificateProvider";
import { getDeploymentLocalData, saveDeploymentManifest } from "@src/utils/deploymentLocalDataUtils";
import { deploymentData } from "@src/utils/deploymentData";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { Snackbar } from "../shared/Snackbar";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { LinkTo } from "../shared/LinkTo";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import ViewPanel from "../shared/ViewPanel";
import { DynamicMonacoEditor } from "../shared/DynamicMonacoEditor";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { CustomTooltip } from "../shared/CustomTooltip";
import yaml from "js-yaml";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { ApiProviderList } from "@src/types/provider";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[];
  closeManifestEditor: () => void;
};

export const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: "1rem"
  }
}));

export const ManifestUpdate: React.FunctionComponent<Props> = ({ deployment, leases, closeManifestEditor }) => {
  const [parsingError, setParsingError] = useState(null);
  const [deploymentVersion, setDeploymentVersion] = useState(null);
  const [editedManifest, setEditedManifest] = useState("");
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const [showOutsideDeploymentMessage, setShowOutsideDeploymentMessage] = useState(false);
  const { settings } = useSettings();
  const { classes } = useStyles();
  const { address, signAndBroadcastTx } = useKeplr();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, createCertificate, isCreatingCert } = useCertificate();

  useEffect(() => {
    const init = async () => {
      const localDeploymentData = getDeploymentLocalData(deployment.dseq);

      if (localDeploymentData && localDeploymentData.manifest) {
        setEditedManifest(localDeploymentData?.manifest);

        const yamlVersion = yaml.load(localDeploymentData?.manifest);
        const version = await deploymentData.getManifestVersion(yamlVersion, true);

        setDeploymentVersion(version);
      } else {
        setShowOutsideDeploymentMessage(true);
      }
    };

    init();
  }, [deployment]);

  /**
   * Validate the manifest periodically
   */
  useEffect(() => {
    async function createAndValidateDeploymentData(yamlStr, dseq) {
      try {
        if (!editedManifest) return null;

        const yamlJson = yaml.load(yamlStr);

        await deploymentData.NewDeploymentData(settings.apiEndpoint, yamlJson, dseq, address);

        setParsingError(null);
      } catch (err) {
        if (err.name === "YAMLException" || err.name === "CustomValidationError") {
          setParsingError(err.message);
        } else {
          setParsingError("Error while parsing SDL file");
          console.error(err);
        }
      }
    }

    const timeoutId = setTimeout(async () => {
      await createAndValidateDeploymentData(editedManifest, deployment.dseq);
    }, 500);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editedManifest, deployment.dseq, settings.apiEndpoint, address]);

  function handleTextChange(value) {
    setEditedManifest(value);

    if (deploymentVersion) {
      setDeploymentVersion(null);
    }
  }

  function handleUpdateDocClick(ev) {
    ev.preventDefault();

    window.open("https://docs.akash.network/guides/cli/detailed-steps/part-11.-update-the-deployment", "_blank");
  }

  async function sendManifest(providerInfo: ApiProviderList, manifest: any) {
    try {
      const response = await sendManifestToProvider(providerInfo, manifest, deployment.dseq, localCert);

      return response;
    } catch (err) {
      enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      throw err;
    }
  }

  async function handleUpdateClick() {
    let response, sendManifestKey;

    try {
      const doc = yaml.load(editedManifest);

      const dd = await deploymentData.NewDeploymentData(settings.apiEndpoint, doc, parseInt(deployment.dseq), address); // TODO Flags
      const mani = deploymentData.getManifest(doc, true);

      // const sdl = getSdl(doc as any, "beta3");
      // console.log("Sorted Manifest", sdl.manifestSortedJSON());

      // If it's actual update, send a transaction, else just send the manifest
      if (Buffer.from(dd.version).toString("base64") !== deployment.version) {
        const message = TransactionMessageData.getUpdateDeploymentMsg(dd);
        response = await signAndBroadcastTx([message]);
      } else {
        response = true;
      }

      if (response) {
        setIsSendingManifest(true);

        console.log(dd, mani);

        saveDeploymentManifest(dd.deploymentId.dseq, editedManifest, dd.version, address);

        sendManifestKey = showSendManifestSnackbar();

        const leaseProviders = leases.map(lease => lease.provider).filter((v, i, s) => s.indexOf(v) === i);

        for (const provider of leaseProviders) {
          const provider = providers.find(x => x.owner === provider);
          await sendManifest(provider, mani);
        }

        event(AnalyticsEvents.UPDATE_DEPLOYMENT, {
          category: "deployments",
          label: "Update deployment"
        });

        setIsSendingManifest(false);

        closeSnackbar(sendManifestKey);

        closeManifestEditor();
      }
    } catch (error) {
      console.error(error);
      setIsSendingManifest(false);
      closeSnackbar(sendManifestKey);
    }
  }

  const showSendManifestSnackbar = () => {
    return enqueueSnackbar(<Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
      variant: "info",
      autoHideDuration: null
    });
  };

  return (
    <>
      {showOutsideDeploymentMessage ? (
        <Box padding=".5rem">
          <Alert severity="info">
            It looks like this deployment was created using another deploy tool. We can't show you the configuration file that was used initially, but you can
            still update it. Simply continue and enter the configuration you want to use.
            <Box mt={1}>
              <Button variant="contained" color="secondary" onClick={() => setShowOutsideDeploymentMessage(false)} size="small">
                Continue
              </Button>
            </Box>
          </Alert>
        </Box>
      ) : (
        <>
          <div>
            <Box display="flex" alignItems="center" justifyContent="space-between" padding=".2rem .5rem" height="50px">
              <Box display="flex" alignItems="center">
                <Typography variant="h6" className={classes.title}>
                  Update Deployment
                </Typography>

                <CustomTooltip
                  arrow
                  title={
                    <Alert severity="info">
                      Akash Groups are translated into Kubernetes Deployments, this means that only a few fields from the Akash SDL are mutable. For example
                      image, command, args, env and exposed ports can be modified, but compute resources and placement criteria cannot. (
                      <LinkTo onClick={handleUpdateDocClick}>View doc</LinkTo>)
                    </Alert>
                  }
                >
                  <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
                </CustomTooltip>

                {!!deploymentVersion && deploymentVersion !== deployment.version && (
                  <CustomTooltip
                    arrow
                    title={
                      <Alert severity="warning">
                        Your local deployment file version doesn't match the one on-chain. If you click update, you will override the deployed version.
                      </Alert>
                    }
                  >
                    <WarningIcon sx={{ marginLeft: ".5rem" }} fontSize="small" color="warning" />
                  </CustomTooltip>
                )}
              </Box>

              <Box>
                {!localCert || !isLocalCertMatching ? (
                  <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
                    <Alert severity="warning">You do not have a valid certificate. You need to create a new one to update an existing deployment.</Alert>

                    <Button
                      variant="contained"
                      color="secondary"
                      size="medium"
                      sx={{ marginLeft: "1rem" }}
                      disabled={isCreatingCert}
                      onClick={() => createCertificate()}
                    >
                      {isCreatingCert ? <CircularProgress size="1.5rem" color="secondary" /> : "Create Certificate"}
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    disabled={!!parsingError || !editedManifest || !providers || isSendingManifest || deployment.state !== "active"}
                    onClick={() => handleUpdateClick()}
                  >
                    Update Deployment
                  </Button>
                )}
              </Box>
            </Box>

            {parsingError && <Alert severity="warning">{parsingError}</Alert>}

            <LinearLoadingSkeleton isLoading={isSendingManifest} />

            <ViewPanel stickToBottom style={{ overflow: "hidden" }}>
              <DynamicMonacoEditor value={editedManifest} onChange={handleTextChange} />
            </ViewPanel>
          </div>
        </>
      )}
    </>
  );
};
