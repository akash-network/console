"use client";
import { useEffect, useState } from "react";
import { Alert, Button, CustomTooltip, Snackbar } from "@akashnetwork/ui/components";
import { InfoCircle, WarningCircle } from "iconoir-react";
import yaml from "js-yaml";
import { useSnackbar } from "notistack";

import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { LinkTo } from "@src/components/shared/LinkTo";
import ViewPanel from "@src/components/shared/ViewPanel";
import { useCertificate } from "@src/context/CertificateProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import networkStore from "@src/store/networkStore";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { deploymentData } from "@src/utils/deploymentData";
import { getDeploymentLocalData, saveDeploymentManifest } from "@src/utils/deploymentLocalDataUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import RemoteDeployUpdate from "../remote-deploy/update/RemoteDeployUpdate";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { Title } from "../shared/Title";
import { CreateCertificateButton } from "./CreateCertificateButton/CreateCertificateButton";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[];
  closeManifestEditor: () => void;
  isRemoteDeploy: boolean;
  editedManifest: string;
  onManifestChange: (value: string) => void;
};

export const ManifestUpdate: React.FunctionComponent<Props> = ({
  deployment,
  leases,
  closeManifestEditor,
  isRemoteDeploy,
  editedManifest,
  onManifestChange
}) => {
  const { providerProxy } = useServices();
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentVersion, setDeploymentVersion] = useState<string | null>(null);
  const [showOutsideDeploymentMessage, setShowOutsideDeploymentMessage] = useState(false);
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const { settings } = useSettings();
  const { address, signAndBroadcastTx, isManaged: isManagedWallet } = useWallet();
  const { data: providers } = useProviderList();
  const { localCert, isLocalCertMatching } = useCertificate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  useEffect(() => {
    const init = async () => {
      const localDeploymentData = getDeploymentLocalData(deployment.dseq);

      if (localDeploymentData?.manifest) {
        onManifestChange(localDeploymentData.manifest);

        try {
          const yamlVersion = yaml.load(localDeploymentData.manifest);
          const version = await deploymentData.getManifestVersion(yamlVersion);
          setDeploymentVersion(version);
        } catch (error) {
          console.error(error);
          setParsingError("Error getting manifest version.");
        }
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
    async function createAndValidateDeploymentData(yamlStr: string, dseq: string) {
      try {
        if (!editedManifest) return null;

        await deploymentData.NewDeploymentData(settings.apiEndpoint, yamlStr, dseq, address);

        setParsingError(null);
      } catch (err: any) {
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

  function handleTextChange(value: string | undefined) {
    onManifestChange(value || "");

    if (deploymentVersion) {
      setDeploymentVersion(null);
    }
  }

  function handleUpdateDocClick(ev: React.MouseEvent) {
    ev.preventDefault();

    window.open("https://akash.network/docs/deployments/akash-cli/installation/#update-the-deployment", "_blank");
  }

  const chainNetwork = networkStore.useSelectedNetworkId();
  async function sendManifest(providerInfo: ApiProviderList, manifest: any) {
    try {
      return await providerProxy.sendManifest(providerInfo, manifest, {
        dseq: deployment.dseq,
        localCert,
        chainNetwork
      });
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

        analyticsService.track("update_deployment", {
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
                  <CreateCertificateButton containerClassName="flex items-center space-x-4 text-sm" className="" size="sm" />
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

            <ViewPanel stickToBottom style={{ overflow: isRemoteDeploy ? "unset" : "hidden" }}>
              {isRemoteDeploy ? (
                <RemoteDeployUpdate sdlString={editedManifest} onManifestChange={onManifestChange} />
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
