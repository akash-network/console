"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@src/context/WalletProvider";
import { useCertificate } from "@src/context/CertificateProvider";
import { getDeploymentLocalData, saveDeploymentManifest } from "@src/utils/deploymentLocalDataUtils";
import { deploymentData } from "@src/utils/deploymentData";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import yaml from "js-yaml";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { ApiProviderList } from "@src/types/provider";
import { useSettings } from "@src/context/SettingsProvider";
import { useToast } from "@src/components/ui/use-toast";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { Alert } from "@src/components/ui/alert";
import { Button } from "@src/components/ui/button";
import { LinearLoadingSkeleton } from "@src/components/shared/LinearLoadingSkeleton";
import ViewPanel from "@src/components/shared/ViewPanel";
import { DynamicMonacoEditor } from "@src/components/shared/DynamicMonacoEditor";
import Spinner from "@src/components/shared/Spinner";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { InfoCircle, WarningCircle } from "iconoir-react";
import { LinkTo } from "@src/components/shared/LinkTo";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[];
  closeManifestEditor: () => void;
};

// export const useStyles = makeStyles()(theme => ({
//   title: {
//     fontSize: "1rem"
//   }
// }));

export const ManifestUpdate: React.FunctionComponent<Props> = ({ deployment, leases, closeManifestEditor }) => {
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentVersion, setDeploymentVersion] = useState(null);
  const [editedManifest, setEditedManifest] = useState("");
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const [showOutsideDeploymentMessage, setShowOutsideDeploymentMessage] = useState(false);
  const { settings } = useSettings();
  const { address, signAndBroadcastTx } = useWallet();
  const { toast, dismiss } = useToast();
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

    window.open("https://docs.akash.network/guides/cli/detailed-steps/part-11.-update-the-deployment", "_blank");
  }

  async function sendManifest(providerInfo: ApiProviderList, manifest: any) {
    try {
      const response = await sendManifestToProvider(providerInfo, manifest, deployment.dseq, localCert as LocalCert);

      return response;
    } catch (err) {
      toast({ title: "Error", description: `Error while sending manifest to provider. ${err}`, variant: "destructive" });
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

        const { id: sendManifestKey } = toast({ title: "Deploying! 🚀", description: "Please wait a few seconds...", loading: true, variant: "default" });

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

        dismiss(sendManifestKey);

        closeManifestEditor();
      }
    } catch (error) {
      console.error(error);
      setIsSendingManifest(false);
      dismiss(sendManifestKey);
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
            <div className="flex h-[50px] items-center justify-center px-2 py-1">
              <div className="flex items-center">
                <h6 className="text-sm">Update Deployment</h6>

                <CustomTooltip
                  title={
                    <Alert>
                      Akash Groups are translated into Kubernetes Deployments, this means that only a few fields from the Akash SDL are mutable. For example
                      image, command, args, env and exposed ports can be modified, but compute resources and placement criteria cannot. (
                      <LinkTo onClick={handleUpdateDocClick}>View doc</LinkTo>)
                    </Alert>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>

                {!!deploymentVersion && deploymentVersion !== deployment.version && (
                  <CustomTooltip
                    title={
                      <Alert variant="warning">
                        Your local deployment file version doesn't match the one on-chain. If you click update, you will override the deployed version.
                      </Alert>
                    }
                  >
                    <WarningCircle className="text-warning ml-2 text-xs" />
                  </CustomTooltip>
                )}
              </div>

              <div>
                {!localCert || !isLocalCertMatching ? (
                  <div className="flex items-center p-4">
                    <Alert variant="warning">You do not have a valid certificate. You need to create a new one to update an existing deployment.</Alert>

                    <Button className="ml-4" disabled={isCreatingCert} onClick={() => createCertificate()}>
                      {isCreatingCert ? <Spinner /> : "Create Certificate"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={!!parsingError || !editedManifest || !providers || isSendingManifest || deployment.state !== "active"}
                    onClick={() => handleUpdateClick()}
                  >
                    Update Deployment
                  </Button>
                )}
              </div>
            </div>

            {parsingError && <Alert variant="warning">{parsingError}</Alert>}

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
