"use client";
import { useEffect, useState } from "react";
import type { Manifest } from "@akashnetwork/chain-sdk/web";
import { Alert, Button, CustomTooltip, Snackbar } from "@akashnetwork/ui/components";
import { InfoCircle, WarningCircle } from "iconoir-react";
import yaml from "js-yaml";
import { useSnackbar as useSnackbarOriginal } from "notistack";

import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { LinkTo } from "@src/components/shared/LinkTo";
import { ViewPanel } from "@src/components/shared/ViewPanel";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings as useSettingsOriginal } from "@src/context/SettingsProvider";
import { useWallet as useWalletOriginal } from "@src/context/WalletProvider";
import { useProviderCredentials as useProviderCredentialsOriginal } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useProviderList as useProviderListOriginal } from "@src/queries/useProvidersQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { deploymentData as deploymentDataOriginal } from "@src/utils/deploymentData";
import { TransactionMessageData as TransactionMessageDataOriginal } from "@src/utils/TransactionMessageData";
import RemoteDeployUpdate from "../../remote-deploy/update/RemoteDeployUpdate";
import { SDLEditor } from "../../sdl/SDLEditor/SDLEditor";
import { ManifestErrorSnackbar } from "../../shared/ManifestErrorSnackbar/ManifestErrorSnackbar";
import { Title } from "../../shared/Title";
import { CreateCredentialsButton } from "../CreateCredentialsButton/CreateCredentialsButton";

export const DEPENDENCIES = {
  Alert,
  Button,
  CustomTooltip,
  Snackbar,
  LinearLoadingSkeleton,
  LinkTo,
  ViewPanel,
  RemoteDeployUpdate,
  SDLEditor,
  ManifestErrorSnackbar,
  Title,
  CreateCredentialsButton,
  InfoCircle,
  WarningCircle,
  useWallet: useWalletOriginal,
  useProviderList: useProviderListOriginal,
  useProviderCredentials: useProviderCredentialsOriginal,
  useSnackbar: useSnackbarOriginal,
  useSettings: useSettingsOriginal,
  deploymentData: deploymentDataOriginal,
  TransactionMessageData: TransactionMessageDataOriginal
};

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[];
  closeManifestEditor: () => void;
  isRemoteDeploy: boolean;
  editedManifest: string;
  onManifestChange: (value: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ManifestUpdate: React.FunctionComponent<Props> = ({
  deployment,
  leases,
  closeManifestEditor,
  isRemoteDeploy,
  editedManifest,
  onManifestChange,
  dependencies: d = DEPENDENCIES
}) => {
  const { providerProxy, analyticsService, chainApiHttpClient, deploymentLocalStorage } = useServices();
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentVersion, setDeploymentVersion] = useState<string | null>(null);
  const [showOutsideDeploymentMessage, setShowOutsideDeploymentMessage] = useState(false);
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const { address, signAndBroadcastTx, isManaged: isManagedWallet } = d.useWallet();
  const { data: providers } = d.useProviderList();
  const providerCredentials = d.useProviderCredentials();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const { settings } = d.useSettings();

  useEffect(() => {
    const init = async () => {
      const localDeploymentData = deploymentLocalStorage.get(address, deployment.dseq);

      if (localDeploymentData?.manifest) {
        onManifestChange(localDeploymentData.manifest);

        try {
          const yamlVersion = yaml.load(localDeploymentData.manifest);
          const version = await d.deploymentData.getManifestVersion(yamlVersion);
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
  }, [deployment, address, deploymentLocalStorage]);

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

  async function sendManifest(providerInfo: ApiProviderList, manifest: Manifest) {
    try {
      return await providerProxy.sendManifest(providerInfo, manifest, {
        dseq: deployment.dseq,
        credentials: providerCredentials.details
      });
    } catch (err) {
      enqueueSnackbar(<d.ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      throw err;
    }
  }

  async function handleUpdateClick() {
    let response, sendManifestKey;

    try {
      const doc = yaml.load(editedManifest);

      const dd = await d.deploymentData.NewDeploymentData(chainApiHttpClient, editedManifest, deployment.dseq, address); // TODO Flags
      const mani = d.deploymentData.getManifest(doc);

      // If it's actual update, send a transaction, else just send the manifest
      if (Buffer.from(dd.hash).toString("base64") !== deployment.hash) {
        const message = d.TransactionMessageData.getUpdateDeploymentMsg(dd);
        response = await signAndBroadcastTx([message]);
      } else {
        response = true;
      }

      if (response) {
        setIsSendingManifest(true);

        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
          manifest: editedManifest,
          manifestVersion: dd.hash
        });

        sendManifestKey =
          !isManagedWallet &&
          enqueueSnackbar(<d.Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
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
    } catch (error: any) {
      if (error.name === "YAMLException" || error.name === "CustomValidationError") {
        setParsingError(error.message);
      } else {
        setParsingError("Error while parsing SDL file");
        console.error(error);
      }
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
          <d.Alert>
            It looks like this deployment was created using another deploy tool. We can't show you the configuration file that was used initially, but you can
            still update it. Simply continue and enter the configuration you want to use.
            <div className="mt-1">
              <d.Button onClick={() => setShowOutsideDeploymentMessage(false)} size="sm">
                Continue
              </d.Button>
            </div>
          </d.Alert>
        </div>
      ) : (
        <>
          <div>
            <div className="flex h-[50px] items-center justify-between space-x-2 px-2 py-1">
              <div className="flex items-center space-x-2">
                <d.Title subTitle className="!text-base">
                  Update Deployment
                </d.Title>

                <d.CustomTooltip
                  title={
                    <div>
                      Akash Groups are translated into Kubernetes Deployments, this means that only a few fields from the Akash SDL are mutable. For example
                      image, command, args, env and exposed ports can be modified, but compute resources and placement criteria cannot. (
                      <d.LinkTo onClick={handleUpdateDocClick}>View doc</d.LinkTo>)
                    </div>
                  }
                >
                  <d.InfoCircle className="text-xs text-muted-foreground" />
                </d.CustomTooltip>

                {!!deploymentVersion && deploymentVersion !== deployment.hash && (
                  <d.CustomTooltip
                    title={
                      <d.Alert variant="warning">
                        Your local deployment file version doesn't match the one on-chain. If you click update, you will override the deployed version.
                      </d.Alert>
                    }
                  >
                    <d.WarningCircle className="text-xs text-warning" />
                  </d.CustomTooltip>
                )}
              </div>

              <div>
                {!providerCredentials.details.usable ? (
                  <d.CreateCredentialsButton containerClassName="flex items-center space-x-4 text-sm" className="" size="sm" />
                ) : (
                  <d.Button
                    disabled={
                      !!parsingError || !editedManifest || !providers || isSendingManifest || deployment.state !== "active" || settings.isBlockchainDown
                    }
                    onClick={() => handleUpdateClick()}
                    size="sm"
                    type="button"
                  >
                    Update Deployment
                  </d.Button>
                )}
              </div>
            </div>

            {parsingError && <d.Alert variant="warning">{parsingError}</d.Alert>}

            <d.LinearLoadingSkeleton isLoading={isSendingManifest} />

            <d.ViewPanel stickToBottom style={{ overflow: isRemoteDeploy ? "unset" : "hidden" }}>
              {isRemoteDeploy ? (
                <d.RemoteDeployUpdate sdlString={editedManifest} onManifestChange={onManifestChange} />
              ) : (
                <d.SDLEditor value={editedManifest} onChange={handleTextChange} onValidate={() => setParsingError(null)} />
              )}
            </d.ViewPanel>
          </div>
        </>
      )}
    </>
  );
};
