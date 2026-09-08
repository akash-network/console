"use client";
import { useEffect, useState } from "react";
import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import { Alert, Button, CustomTooltip, Snackbar } from "@akashnetwork/ui/components";
import { InfoCircle, Upload, WarningCircle } from "iconoir-react";
import yaml from "js-yaml";
import { useSnackbar as useSnackbarOriginal } from "notistack";

import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import { LinkTo } from "@src/components/shared/LinkTo";
import { ViewPanel } from "@src/components/shared/ViewPanel";
import { useBlockchainStatus as useBlockchainStatusOriginal } from "@src/context/BlockchainStatusProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet as useWalletOriginal } from "@src/context/WalletProvider";
import { AddCreditsSnackbarContent } from "@src/context/WalletProvider/useSignAndBroadcast";
import { useProviderCredentials as useProviderCredentialsOriginal } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useBalances as useBalancesOriginal } from "@src/queries/useBalancesQuery";
import type { DeploymentDto } from "@src/types/deployment";
import { deploymentData as deploymentDataOriginal } from "@src/utils/deploymentData";
import RemoteDeployUpdate from "../../remote-deploy/update/RemoteDeployUpdate";
import { SDLEditor } from "../../sdl/SDLEditor/SDLEditor";
import { DeploymentTabHeader } from "../DeploymentDetail/DeploymentTabHeader";

export const DEPENDENCIES = {
  Alert,
  Button,
  CustomTooltip,
  Snackbar,
  AddCreditsSnackbarContent,
  LinearLoadingSkeleton,
  LinkTo,
  ViewPanel,
  RemoteDeployUpdate,
  SDLEditor,
  InfoCircle,
  WarningCircle,
  useWallet: useWalletOriginal,
  useBalances: useBalancesOriginal,
  useProviderCredentials: useProviderCredentialsOriginal,
  useSnackbar: useSnackbarOriginal,
  useBlockchainStatus: useBlockchainStatusOriginal,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  deploymentData: deploymentDataOriginal
};

const REFUSED_SDL_MESSAGE = "The console could not accept this SDL.";
const UPDATE_FAILURE_MESSAGE = "Something went wrong while updating the deployment. Please try again.";
const ADD_CREDITS_TITLE = "Add credits to continue";

type Props = {
  deployment: DeploymentDto;
  closeManifestEditor: () => void;
  isRemoteDeploy: boolean;
  editedManifest: string;
  onManifestChange: (value: string) => void;
  /** Supplied only by the redesigned detail page; the legacy page omits it and renders no Redeploy action. */
  onRedeploy?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ManifestUpdate: React.FunctionComponent<Props> = ({
  deployment,
  closeManifestEditor,
  isRemoteDeploy,
  editedManifest,
  onManifestChange,
  onRedeploy,
  dependencies: d = DEPENDENCIES
}) => {
  const { api, analyticsService, deploymentLocalStorage } = useServices();
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentVersion, setDeploymentVersion] = useState<string | null>(null);
  const [showOutsideDeploymentMessage, setShowOutsideDeploymentMessage] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { address } = d.useWallet();
  const { refetch: refetchBalances } = d.useBalances(address);
  const providerCredentials = d.useProviderCredentials();
  const { enqueueSnackbar } = d.useSnackbar();
  const { isBlockchainDown } = d.useBlockchainStatus();
  const updateDeployment = api.v1.updateDeployment.useMutation();

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

  function handleUpdateClick() {
    setParsingError(null);
    setIsUpdating(true);
    updateDeployment.mutate({ dseq: deployment.dseq, data: { sdl: editedManifest } }, { onSuccess: finishUpdate, onError: reportUpdateFailure });
  }

  function finishUpdate() {
    deploymentLocalStorage.update(address, deployment.dseq, { manifest: editedManifest });
    analyticsService.track("update_deployment", { category: "deployments", label: "Update deployment" });
    analyticsService.track("successful_tx", { category: "transactions", label: "Successful transaction" });
    refetchBalances();
    setIsUpdating(false);
    closeManifestEditor();
  }

  function reportUpdateFailure(cause: unknown) {
    setIsUpdating(false);
    analyticsService.track("failed_tx", { category: "transactions", label: "Failed transaction" });

    if (isApiError(cause) && cause.status === 400) {
      setParsingError(extractApiErrorMessage(cause) ?? REFUSED_SDL_MESSAGE);
      return;
    }

    if (isApiError(cause) && cause.status === 402) {
      offerCredits(cause);
      return;
    }

    enqueueSnackbar(<d.Snackbar title="Couldn't update deployment" subTitle={extractApiErrorMessage(cause) ?? UPDATE_FAILURE_MESSAGE} iconVariant="error" />, {
      variant: "error",
      autoHideDuration: null
    });
  }

  function offerCredits(cause: unknown) {
    const [title, message] = (extractApiErrorMessage(cause) ?? "").split(": ");

    enqueueSnackbar(
      <d.Snackbar title={title || message || ADD_CREDITS_TITLE} subTitle={<d.AddCreditsSnackbarContent message={message} />} iconVariant="warning" />,
      {
        variant: "warning",
        autoHideDuration: 10000
      }
    );
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
            <DeploymentTabHeader
              title="Update Deployment"
              actions={
                <div className="flex items-center gap-2">
                  {onRedeploy && (
                    <d.Button variant="outline" size="md" className="gap-1" type="button" disabled={isUpdating} onClick={onRedeploy}>
                      <Upload className="text-xs" />
                      Redeploy
                    </d.Button>
                  )}
                  <d.Button
                    disabled={
                      !providerCredentials.details.usable ||
                      !!parsingError ||
                      !editedManifest ||
                      isUpdating ||
                      deployment.state !== "active" ||
                      isBlockchainDown
                    }
                    onClick={() => handleUpdateClick()}
                    size="md"
                    type="button"
                  >
                    Update Deployment
                  </d.Button>
                </div>
              }
            >
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
            </DeploymentTabHeader>

            {parsingError && <d.Alert variant="warning">{parsingError}</d.Alert>}

            <d.LinearLoadingSkeleton isLoading={isUpdating} />

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
