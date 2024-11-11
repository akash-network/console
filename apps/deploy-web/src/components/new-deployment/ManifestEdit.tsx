"use client";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { Alert, Button, CustomTooltip, FileButton, Input, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { EncodeObject } from "@cosmjs/proto-signing";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ArrowRight, InfoCircle, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useCertificate } from "@src/context/CertificateProvider";
import { useChainParam } from "@src/context/ChainParamProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useManagedWalletDenom } from "@src/hooks/useManagedWalletDenom";
import { useWhen } from "@src/hooks/useWhen";
import { useDepositParams } from "@src/queries/useSettings";
import sdlStore from "@src/store/sdlStore";
import { TemplateCreation } from "@src/types";
import type { DepositParams } from "@src/types/deployment";
import { RouteStep } from "@src/types/route-steps.type";
import { AnalyticsEvents } from "@src/utils/analytics";
import { deploymentData } from "@src/utils/deploymentData";
import { saveDeploymentManifestAndName } from "@src/utils/deploymentLocalDataUtils";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { Timer } from "@src/utils/timer";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { domainName, handleDocClick, UrlService } from "@src/utils/urlUtils";
import { updateWallet } from "@src/utils/walletUtils";
import { useSettings } from "../../context/SettingsProvider";
import { DeploymentDepositModal } from "../deployments/DeploymentDepositModal";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { DynamicMonacoEditor } from "../shared/DynamicMonacoEditor";
import { LinkTo } from "../shared/LinkTo";
import { PrerequisiteList } from "../shared/PrerequisiteList";
import ViewPanel from "../shared/ViewPanel";
import { SdlBuilder, SdlBuilderRefType } from "./SdlBuilder";
import { appendTrialAttribute } from "@src/utils/deploymentData/v1beta3";

type Props = {
  onTemplateSelected: Dispatch<TemplateCreation | null>;
  selectedTemplate: TemplateCreation | null;
  editedManifest: string | null;
  setEditedManifest: Dispatch<SetStateAction<string>>;
  isGitProviderTemplate?: boolean;
};

export const ManifestEdit: React.FunctionComponent<Props> = ({
  editedManifest,
  setEditedManifest,
  onTemplateSelected,
  selectedTemplate,
  isGitProviderTemplate
}) => {
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentName, setDeploymentName] = useState("");
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(false);
  const [selectedSdlEditMode, setSelectedSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);
  const [isRepoInputValid, setIsRepoInputValid] = useState(false);
  const [sdlDenom, setSdlDenom] = useState("uakt");
  const { settings } = useSettings();
  const { address, signAndBroadcastTx, isManaged, isTrialing } = useWallet();
  const router = useRouter();
  const { loadValidCertificates, localCert, isLocalCertMatching, loadLocalCert, setSelectedCertificate } = useCertificate();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const sdlBuilderRef = useRef<SdlBuilderRefType>(null);
  const { minDeposit } = useChainParam();
  const { hasComponent } = useSdlBuilder();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const { data: depositParams } = useDepositParams();
  const defaultDeposit = depositParams || browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
  const wallet = useWallet();
  const managedDenom = useManagedWalletDenom();
  const { createDeploymentConfirm } = useManagedDeploymentConfirm();
  const { enqueueSnackbar } = useSnackbar();

  useWhen(
    wallet.isManaged && sdlDenom === "uakt" && editedManifest,
    () => {
      setEditedManifest(prev => (prev ? prev.replace(/uakt/g, managedDenom) : prev));
      setSdlDenom(managedDenom);
    },
    [editedManifest, wallet.isManaged, sdlDenom]
  );
  useWhen(hasComponent("ssh"), () => {
    setSelectedSdlEditMode("builder");
  });

  useWhen(isGitProviderTemplate, () => {
    setSelectedSdlEditMode("builder");
  }, [isGitProviderTemplate]);

  useEffect(() => {
    if (selectedTemplate?.name) {
      setDeploymentName(selectedTemplate.name);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = Timer(500);

    timer.start().then(() => {
      if (editedManifest) createAndValidateDeploymentData(editedManifest, "TEST_DSEQ_VALIDATION");
    });

    return () => {
      if (timer) {
        timer.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedManifest]);

  const onFileSelect = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = event => {
      onTemplateSelected({
        title: "From file",
        code: "from-file",
        category: "General",
        description: "Custom uploaded file",
        content: event.target?.result as string
      });
      setEditedManifest(event.target?.result as string);
      setSelectedSdlEditMode("yaml");
    };

    reader.readAsText(file);
  };

  async function handleTextChange(value) {
    setEditedManifest(value);
  }

  async function createAndValidateDeploymentData(
    yamlStr: string,
    dseq: string | null = null,
    deposit = defaultDeposit,
    depositorAddress: string | null = null
  ) {
    try {
      if (!yamlStr) return null;

      const dd = await deploymentData.NewDeploymentData(settings.apiEndpoint, yamlStr, dseq, address, deposit, depositorAddress);
      validateDeploymentData(dd, selectedTemplate);

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

  const handleCreateDeployment = async () => {
    if (isGitProviderTemplate && !isRepoInputValid) {
      enqueueSnackbar(<Snackbar title={"Please Fill All Required Fields"} subTitle="You need fill repo url and branch to deploy" iconVariant="error" />, {
        variant: "error"
      });
      return;
    }

    if (selectedSdlEditMode === "builder") {
      const valid = await sdlBuilderRef.current?.validate();
      if (!valid) return;
    }

    if (isManaged) {
      const services = importSimpleSdl(editedManifest as string);

      if (!services) {
        setParsingError("Error while parsing SDL file");
        return;
      }

      const isConfirmed = await createDeploymentConfirm(services);

      if (isConfirmed) {
        await handleCreateClick(defaultDeposit, browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS);
      }
    } else {
      setIsCheckingPrerequisites(true);
    }
  };

  const onPrerequisiteContinue = () => {
    setIsCheckingPrerequisites(false);

    if (isManaged) {
      handleCreateClick(defaultDeposit, browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS);
    } else {
      setIsDepositingDeployment(true);
    }
  };

  const onDeploymentDeposit = async (deposit: number, depositorAddress: string) => {
    setIsDepositingDeployment(false);
    await handleCreateClick(deposit, depositorAddress);
  };

  async function handleCreateClick(deposit: number | DepositParams[], depositorAddress: string) {
    try {
      setIsCreatingDeployment(true);

      let sdl = selectedSdlEditMode === "yaml" ? editedManifest : sdlBuilderRef.current?.getSdl();
      if (!sdl) {
        setIsCreatingDeployment(false);
        return;
      }

      if (isTrialing) {
        sdl = appendTrialAttribute(sdl);
      }

      const dd = await createAndValidateDeploymentData(sdl, null, deposit, depositorAddress);

      const validCertificates = await loadValidCertificates();
      const currentCert = validCertificates.find(x => x.parsed === localCert?.certPem);
      const isCertificateValidated = currentCert?.certificate?.state === "valid";
      const isLocalCertificateValidated = !!localCert && isLocalCertMatching;

      if (!dd) return;

      const messages: EncodeObject[] = [];
      const hasValidCert = isCertificateValidated && isLocalCertificateValidated;
      let _crtpem: string;
      let _encryptedKey: string;

      // Create a cert if the user doesn't have one
      if (!hasValidCert) {
        const { cert: crtpem, publicKey: pubpem, privateKey: encryptedKey } = certificateManager.generatePEM(address);
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
        router.replace(UrlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));

        event(AnalyticsEvents.CREATE_DEPLOYMENT, {
          category: "deployments",
          label: "Create deployment in wizard"
        });
      } else {
        setIsCreatingDeployment(false);
      }
    } finally {
      setIsCreatingDeployment(false);
    }
  }

  const changeMode = (mode: "yaml" | "builder") => {
    if (mode === selectedSdlEditMode) return;

    if (mode === "yaml") {
      if (editedManifest) {
        setEditedManifest(editedManifest);
      }
    } else {
      const sdl = sdlBuilderRef.current?.getSdl();

      if (sdl) {
        setEditedManifest(sdl);
      }
    }

    setSelectedSdlEditMode(mode);
  };

  return (
    <>
      <CustomNextSeo title="Create Deployment - Manifest Edit" url={`${domainName}${UrlService.newDeployment({ step: RouteStep.editDeployment })}`} />

      <div className="mb-2 pt-4">
        <div className="mb-2 flex flex-col items-end justify-between md:flex-row">
          <div className="w-full flex-grow">
            <Input value={deploymentName} onChange={ev => setDeploymentName(ev.target.value)} label="Name your deployment (optional)" />
          </div>

          <div className="flex w-full min-w-0 flex-shrink-0 items-center pt-2 md:w-auto md:pt-0">
            <CustomTooltip
              title={
                <p>
                  You may use the sample deployment file as-is or modify it for your own needs as described in the{" "}
                  <LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/getting-started/stack-definition-language/")}>
                    SDL (Stack Definition Language)
                  </LinkTo>{" "}
                  documentation. A typical modification would be to reference your own image instead of the demo app image.
                </p>
              }
            >
              <InfoCircle className="mr-4 text-sm text-muted-foreground md:ml-4" />
            </CustomTooltip>

            <div className="flex-grow">
              <Button
                variant="default"
                disabled={isCreatingDeployment || !!parsingError || !editedManifest}
                onClick={() => handleCreateDeployment()}
                className="w-full whitespace-nowrap sm:w-auto"
                data-testid="create-deployment-btn"
              >
                {isCreatingDeployment ? (
                  <Spinner size="small" />
                ) : (
                  <>
                    Create Deployment{" "}
                    <span className="ml-2 flex items-center">
                      <ArrowRight fontSize="small" />
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!isGitProviderTemplate && (
        <div className="mb-2 flex gap-2">
          {hasComponent("yml-editor") && (
            <div className="flex items-center">
              <Button
                variant={selectedSdlEditMode === "builder" ? "default" : "outline"}
                onClick={() => changeMode("builder")}
                size="sm"
                className={cn("flex-grow sm:flex-grow-0", { "rounded-e-none": hasComponent("yml-editor") })}
                disabled={!!parsingError && selectedSdlEditMode === "yaml"}
              >
                Builder
              </Button>
              <Button
                variant={selectedSdlEditMode === "yaml" ? "default" : "outline"}
                color={selectedSdlEditMode === "yaml" ? "secondary" : "primary"}
                onClick={() => changeMode("yaml")}
                size="sm"
                className="flex-grow rounded-s-none sm:flex-grow-0"
              >
                YAML
              </Button>
            </div>
          )}
          {hasComponent("yml-uploader") && !templateId && (
            <>
              <FileButton
                onFileSelect={onFileSelect}
                accept=".yml,.yaml,.txt"
                size="sm"
                variant="outline"
                className="flex-grow hover:bg-primary hover:text-white sm:flex-grow-0"
              >
                <Upload className="text-xs" />
                <span className="text-xs">Upload your SDL</span>
              </FileButton>
            </>
          )}
        </div>
      )}

      {parsingError && <Alert variant="warning">{parsingError}</Alert>}

      {hasComponent("yml-editor") && selectedSdlEditMode === "yaml" && (
        <ViewPanel stickToBottom className={cn("overflow-hidden", { ["-mx-4"]: smallScreen })}>
          <DynamicMonacoEditor value={editedManifest || ""} onChange={handleTextChange} />
        </ViewPanel>
      )}
      {(hasComponent("ssh") || selectedSdlEditMode === "builder") && (
        <SdlBuilder
          sdlString={editedManifest}
          ref={sdlBuilderRef}
          isGitProviderTemplate={isGitProviderTemplate}
          setEditedManifest={setEditedManifest}
          setDeploymentName={setDeploymentName}
          deploymentName={deploymentName}
          setIsRepoInputValid={setIsRepoInputValid}
        />
      )}

      {isDepositingDeployment && (
        <DeploymentDepositModal
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
          denom={sdlDenom}
          infoText={
            <Alert className="mb-4 text-xs" variant="default">
              To create a deployment, you need to have at least <b>{minDeposit.akt} AKT</b> or <b>{minDeposit.usdc} USDC</b> in an escrow account.{" "}
              <LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/other-resources/payments/")}>
                <strong>Learn more.</strong>
              </LinkTo>
            </Alert>
          }
        />
      )}
      {isCheckingPrerequisites && <PrerequisiteList onClose={() => setIsCheckingPrerequisites(false)} onContinue={onPrerequisiteContinue} />}
    </>
  );
};
