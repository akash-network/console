"use client";
import { Dispatch, useEffect, useState } from "react";
import { Alert, Button, CustomTooltip, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { InfoCircle, WarningCircle } from "iconoir-react";
import yaml from "js-yaml";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { LinkTo } from "@src/components/shared/LinkTo";
import ViewPanel from "@src/components/shared/ViewPanel";
import { useCertificate } from "@src/context/CertificateProvider";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { AnalyticsEvents } from "@src/utils/analytics";
import { deploymentData } from "@src/utils/deploymentData";
import { saveDeploymentManifest } from "@src/utils/deploymentLocalDataUtils";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import RemoteDeployUpdate from "../remote-deploy/update/RemoteDeployUpdate";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { Title } from "../shared/Title";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[];
  closeManifestEditor: () => void;
  remoteDeploy: boolean;
  showOutsideDeploymentMessage: boolean;
  editedManifest: string;
  deploymentVersion: string | null;
  setDeploymentVersion: Dispatch<React.SetStateAction<string | null>>;
  setEditedManifest: Dispatch<React.SetStateAction<string>>;
  setShowOutsideDeploymentMessage: Dispatch<React.SetStateAction<boolean>>;
};

export const ManifestUpdate: React.FunctionComponent<Props> = ({
  deployment,
  leases,
  closeManifestEditor,
  remoteDeploy,
  showOutsideDeploymentMessage,
  editedManifest,
  deploymentVersion,
  setDeploymentVersion,
  setEditedManifest,
  setShowOutsideDeploymentMessage
}) => {
  const [parsingError, setParsingError] = useState<string | null>(null);

  const [isSendingManifest, setIsSendingManifest] = useState(false);

  const { settings } = useSettings();
  const { address, signAndBroadcastTx, isManaged: isManagedWallet } = useWallet();
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching, createCertificate, isCreatingCert } = useCertificate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  /**
   * Validate the manifest periodically
   */
  useEffect(() => {
    async function createAndValidateDeploymentData(yamlStr: string, dseq: string) {
      try {
        if (!editedManifest) return null;

        await deploymentData.NewDeploymentData(settings.apiEndpoint, yamlStr, dseq, address);

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

    window.open("https://akash.network/docs/deployments/akash-cli/installation/#update-the-deployment", "_blank");
  }

  async function sendManifest(providerInfo: ApiProviderList, manifest: any) {
    try {
      return await sendManifestToProvider(providerInfo, manifest, deployment.dseq, localCert as LocalCert);
    } catch (err) {
      enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      throw err;
    }
  }

  async function handleUpdateClick() {
    let response, sendManifestKey;

    try {
      const doc = yaml.load(editedManifest);

      const dd = await deploymentData.NewDeploymentData(settings.apiEndpoint, editedManifest, deployment.dseq, address); // TODO Flags
      const mani = deploymentData.getManifest(doc, true);

      // If it's actual update, send a transaction, else just send the manifest
      if (Buffer.from(dd.version).toString("base64") !== deployment.version) {
        const message = TransactionMessageData.getUpdateDeploymentMsg(dd);
        response = await signAndBroadcastTx([message]);
      } else {
        response = true;
      }

      if (response) {
        setIsSendingManifest(true);

        saveDeploymentManifest(dd.deploymentId.dseq, editedManifest, dd.version, address);

        sendManifestKey =
          !isManagedWallet &&
          enqueueSnackbar(<Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
            variant: "info",
            autoHideDuration: null
          });

        const leaseProviders = leases.map(lease => lease.provider).filter((v, i, s) => s.indexOf(v) === i);

        for (const provider of leaseProviders) {
          const providerInfo = providers?.find(x => x.owner === provider);
          await sendManifest(providerInfo as ApiProviderList, mani);
        }

        event(AnalyticsEvents.UPDATE_DEPLOYMENT, {
          category: "deployments",
          label: "Update deployment"
        });

        setIsSendingManifest(false);

        if (sendManifestKey) {
          closeSnackbar(sendManifestKey);
        }

        closeManifestEditor();
      }
    } catch (error) {
      console.error(error);
      setIsSendingManifest(false);

      if (sendManifestKey) {
        closeSnackbar(sendManifestKey);
      }
    }
  }

  return (
    <>
      {showOutsideDeploymentMessage ? (
        <div className="p-2">
          <Alert>
            It looks like this deployment was created using another deploy tool. We can't show you the configuration file that was used initially, but you can
            still update it. Simply continue and enter the configuration you want to use.
            <div className="mt-1">
              <Button onClick={() => setShowOutsideDeploymentMessage(false)} size="sm">
                Continue
              </Button>
            </div>
          </Alert>
        </div>
      ) : (
        <>
          <div>
            <div className="flex h-[50px] items-center justify-between space-x-2 px-2 py-1">
              <div className="flex items-center space-x-2">
                <Title subTitle className="!text-base">
                  Update Deployment
                </Title>

                <CustomTooltip
                  title={
                    <div>
                      Akash Groups are translated into Kubernetes Deployments, this means that only a few fields from the Akash SDL are mutable. For example
                      image, command, args, env and exposed ports can be modified, but compute resources and placement criteria cannot. (
                      <LinkTo onClick={handleUpdateDocClick}>View doc</LinkTo>)
                    </div>
                  }
                >
                  <InfoCircle className="text-xs text-muted-foreground" />
                </CustomTooltip>

                {!!deploymentVersion && deploymentVersion !== deployment.version && (
                  <CustomTooltip
                    title={
                      <Alert variant="warning">
                        Your local deployment file version doesn't match the one on-chain. If you click update, you will override the deployed version.
                      </Alert>
                    }
                  >
                    <WarningCircle className="text-xs text-warning" />
                  </CustomTooltip>
                )}
              </div>

              <div>
                {!localCert || !isLocalCertMatching ? (
                  <div className="flex items-center space-x-4">
                    <Alert variant="warning" className="py-2 text-sm">
                      You do not have a valid certificate. You need to create a new one to update an existing deployment.
                    </Alert>

                    <Button size="sm" disabled={isCreatingCert} onClick={() => createCertificate()}>
                      {isCreatingCert ? <Spinner size="small" /> : "Create Certificate"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={!!parsingError || !editedManifest || !providers || isSendingManifest || deployment.state !== "active"}
                    onClick={() => handleUpdateClick()}
                    size="sm"
                    type="button"
                  >
                    Update Deployment
                  </Button>
                )}
              </div>
            </div>

            {parsingError && <Alert variant="warning">{parsingError}</Alert>}

            <LinearLoadingSkeleton isLoading={isSendingManifest} />

            <ViewPanel stickToBottom style={{ overflow: remoteDeploy ? "unset" : "hidden" }}>
              {remoteDeploy ? (
                <RemoteDeployUpdate sdlString={editedManifest} setEditedManifest={setEditedManifest} />
              ) : (
                <DynamicMonacoEditor value={editedManifest} onChange={handleTextChange} />
              )}
            </ViewPanel>
          </div>
        </>
      )}
    </>
  );
};
