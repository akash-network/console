"use client";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, CustomTooltip, FileButton, Input, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ArrowRight, InfoCircle, Upload } from "iconoir-react";
import { useAtom } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { useCertificate } from "@src/context/CertificateProvider";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useImportSimpleSdl } from "@src/hooks/useImportSimpleSdl";
import { useManagedWalletDenom } from "@src/hooks/useManagedWalletDenom";
import { useWhen } from "@src/hooks/useWhen";
import { useDepositParams } from "@src/queries/useSaveSettings";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import type { DepositParams } from "@src/types/deployment";
import { RouteStep } from "@src/types/route-steps.type";
import { deploymentData } from "@src/utils/deploymentData";
import { appendAuditorRequirement } from "@src/utils/deploymentData/v1beta3";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { Timer } from "@src/utils/timer";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { domainName, handleDocClick, UrlService } from "@src/utils/urlUtils";
import { useSettings } from "../../context/SettingsProvider";
import { DeploymentDepositModal } from "../deployments/DeploymentDepositModal";
import { DeploymentMinimumEscrowAlertText } from "../sdl/DeploymentMinimumEscrowAlertText";
import { TrialDeploymentBadge } from "../shared";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { DynamicMonacoEditor } from "../shared/DynamicMonacoEditor";
import { LinkTo } from "../shared/LinkTo";
import { PrerequisiteList } from "../shared/PrerequisiteList";
import ViewPanel from "../shared/ViewPanel";
import type { SdlBuilderRefType } from "./SdlBuilder";
import { SdlBuilder } from "./SdlBuilder";

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

  const { analyticsService, chainApiHttpClient, publicConfig: appConfig, deploymentLocalStorage } = useServices();
  const { settings } = useSettings();
  const { address, signAndBroadcastTx, isManaged, isTrialing } = useWallet();
  const router = useRouter();
  const { updateSelectedCertificate, genNewCertificateIfLocalIsInvalid } = useCertificate();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const sdlBuilderRef = useRef<SdlBuilderRefType>(null);
  const { hasComponent } = useSdlBuilder();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const { data: depositParams } = useDepositParams();
  const defaultDeposit = depositParams || appConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
  const wallet = useWallet();
  const managedDenom = useManagedWalletDenom();
  const { enqueueSnackbar } = useSnackbar();
  const services = useImportSimpleSdl(editedManifest);

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
      analyticsService.track("sdl_uploaded", "Amplitude");
    };

    reader.readAsText(file);
  };

  async function handleTextChange(value: string | undefined) {
    setEditedManifest(value || "");
  }

  async function createAndValidateDeploymentData(yamlStr: string, dseq: string | null = null, deposit = defaultDeposit) {
    try {
      if (!yamlStr) return null;

      const dd = await deploymentData.NewDeploymentData(chainApiHttpClient, yamlStr, dseq, address, deposit);
      validateDeploymentData(dd, selectedTemplate);

      setSdlDenom(dd.deposit.denom);

      setParsingError(null);

      return dd;
    } catch (err: any) {
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
    analyticsService.track("create_deployment_btn_clk", "Amplitude");

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
      if (!services || services?.length === 0) {
        setParsingError("Error while parsing SDL file");
        return;
      }

      setIsDepositingDeployment(true);
    } else {
      setIsCheckingPrerequisites(true);
    }
  };

  const onPrerequisiteContinue = () => {
    setIsCheckingPrerequisites(false);

    if (isManaged) {
      handleCreateClick(defaultDeposit);
    } else {
      setIsDepositingDeployment(true);
    }
  };

  const onDeploymentDeposit = async (deposit: number) => {
    setIsDepositingDeployment(false);
    await handleCreateClick(deposit);
  };

  async function handleCreateClick(deposit: number | DepositParams[]) {
    try {
      setIsCreatingDeployment(true);

      let sdl = selectedSdlEditMode === "yaml" ? editedManifest : sdlBuilderRef.current?.getSdl();
      if (!sdl) {
        setIsCreatingDeployment(false);
        return;
      }

      if (isManaged) {
        sdl = appendAuditorRequirement(sdl);
      }

      const [dd, newCert] = await Promise.all([createAndValidateDeploymentData(sdl, null, deposit), genNewCertificateIfLocalIsInvalid()]);

      if (!dd) return;

      const messages: EncodeObject[] = [];

      // Create a cert if the user doesn't have one
      if (newCert) {
        messages.push(TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
      }

      messages.push(TransactionMessageData.getCreateDeploymentMsg(dd));
      const response = await signAndBroadcastTx(messages);

      if (response) {
        // Set the new cert in storage
        if (newCert) {
          await updateSelectedCertificate(newCert);
        }

        setDeploySdl(null);

        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
          manifest: sdl,
          manifestVersion: dd.hash,
          name: deploymentName
        });
        router.replace(UrlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));

        analyticsService.track("create_deployment", {
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
                disabled={settings.isBlockchainDown || isCreatingDeployment || !!parsingError || !editedManifest}
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
                onClick={() => {
                  changeMode("builder");
                  analyticsService.track("builder_mode_btn_clk", "Amplitude");
                }}
                size="sm"
                className={cn("flex-grow sm:flex-grow-0", { "rounded-e-none": hasComponent("yml-editor") })}
                disabled={!!parsingError && selectedSdlEditMode === "yaml"}
              >
                Builder
              </Button>
              <Button
                variant={selectedSdlEditMode === "yaml" ? "default" : "outline"}
                color={selectedSdlEditMode === "yaml" ? "secondary" : "primary"}
                onClick={() => {
                  changeMode("yaml");
                  analyticsService.track("yml_mode_btn_clk", "Amplitude");
                }}
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
          title="Confirm deployment creation?"
          infoText={
            <Alert className="mb-6 text-xs" variant="default">
              <DeploymentMinimumEscrowAlertText />
              <LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/getting-started/intro-to-akash/payments/#escrow-accounts")}>
                <strong>Learn more.</strong>
              </LinkTo>

              {isTrialing && (
                <div className="mt-2">
                  <TrialDeploymentBadge />
                </div>
              )}
            </Alert>
          }
          services={services}
        />
      )}
      {isCheckingPrerequisites && <PrerequisiteList onClose={() => setIsCheckingPrerequisites(false)} onContinue={onPrerequisiteContinue} />}
    </>
  );
};
