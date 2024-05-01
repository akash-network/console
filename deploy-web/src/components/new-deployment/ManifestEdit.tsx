"use client";
import { useState, useEffect, Dispatch, useRef } from "react";
import { useSettings } from "../../context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useRouter } from "next/navigation";
import { Timer } from "@src/utils/timer";
import { defaultInitialDeposit, RouteStepKeys } from "@src/utils/constants";
import { deploymentData } from "@src/utils/deploymentData";
import { LinkTo } from "../shared/LinkTo";
import { DynamicMonacoEditor } from "../shared/DynamicMonacoEditor";
import ViewPanel from "../shared/ViewPanel";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { saveDeploymentManifestAndName } from "@src/utils/deploymentLocalDataUtils";
import { UrlService, handleDocClick } from "@src/utils/urlUtils";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { PrerequisiteList } from "../shared/PrerequisiteList";
import { TemplateCreation } from "@src/types";
import { useCertificate } from "@src/context/CertificateProvider";
import { generateCertificate } from "@src/utils/certificateUtils";
import { updateWallet } from "@src/utils/walletUtils";
import sdlStore from "@src/store/sdlStore";
import { useAtom } from "jotai";
import { SdlBuilder, SdlBuilderRefType } from "./SdlBuilder";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { useChainParam } from "@src/context/ChainParamProvider";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import { EncodeObject } from "@cosmjs/proto-signing";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { ArrowRight, InfoCircle } from "iconoir-react";
import Spinner from "../shared/Spinner";
import { CustomTooltip } from "../shared/CustomTooltip";
import { InputWithIcon } from "../ui/input";
import { DeploymentDepositModal } from "../deployments/DeploymentDepositModal";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { cn } from "@src/utils/styleUtils";
import useMediaQuery from "@mui/material/useMediaQuery";

type Props = {
  selectedTemplate: TemplateCreation;
  editedManifest: string;
  setEditedManifest: Dispatch<string>;
};

export const ManifestEdit: React.FunctionComponent<Props> = ({ editedManifest, setEditedManifest, selectedTemplate }) => {
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [deploymentName, setDeploymentName] = useState("");
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(false);
  const [selectedSdlEditMode, setSelectedSdlEditMode] = useAtom(sdlStore.selectedSdlEditMode);
  const [sdlDenom, setSdlDenom] = useState("uakt");
  const { settings } = useSettings();
  const { address, signAndBroadcastTx } = useWallet();
  const router = useRouter();
  const { loadValidCertificates, localCert, isLocalCertMatching, loadLocalCert, setSelectedCertificate } = useCertificate();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const sdlBuilderRef = useRef<SdlBuilderRefType>(null);
  const { minDeposit } = useChainParam();

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

  async function createAndValidateDeploymentData(
    yamlStr: string,
    dseq: string | null = null,
    deposit: number = defaultInitialDeposit,
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
    if (selectedSdlEditMode === "builder") {
      const valid = await sdlBuilderRef.current?.validate();
      if (!valid) return;
    }

    setIsCheckingPrerequisites(true);
  };

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

    const sdl = selectedSdlEditMode === "yaml" ? editedManifest : (sdlBuilderRef.current?.getSdl() as string);
    const dd = await createAndValidateDeploymentData(sdl, null, deposit, depositorAddress);

    const validCertificates = await loadValidCertificates();
    const currentCert = validCertificates.find(x => x.parsed === localCert?.certPem);
    const isCertificateValidated = currentCert?.certificate?.state === "valid";
    const isLocalCertificateValidated = !!localCert && isLocalCertMatching;

    if (!dd) return;

    try {
      const messages: EncodeObject[] = [];
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
      const sdl = sdlBuilderRef.current?.getSdl() as string;
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

      <div className="mb-2 pt-4">
        <div className="mb-2 flex flex-col items-end justify-between md:flex-row">
          <div className="flex-grow">
            <InputWithIcon value={deploymentName} onChange={ev => setDeploymentName(ev.target.value)} label="Name your deployment (optional)" />
          </div>

          <div className="flex w-full min-w-0 items-center pt-2 md:w-auto md:pt-0">
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
              <InfoCircle className="mx-4 text-sm text-muted-foreground" />
            </CustomTooltip>

            <div>
              <Button
                variant="default"
                disabled={isCreatingDeployment || !!parsingError || !editedManifest}
                onClick={() => handleCreateDeployment()}
                className="w-full whitespace-nowrap sm:w-auto"
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

        <Button variant={selectedSdlEditMode === "builder" ? "default" : "outline"} onClick={() => onModeChange("builder")} size="sm">
          Builder
        </Button>
        <Button
          variant={selectedSdlEditMode === "yaml" ? "default" : "outline"}
          color={selectedSdlEditMode === "yaml" ? "secondary" : "primary"}
          onClick={() => onModeChange("yaml")}
          size="sm"
        >
          YAML
        </Button>
      </div>

      {parsingError && <Alert variant="warning">{parsingError}</Alert>}

      {selectedSdlEditMode === "yaml" && (
        <ViewPanel stickToBottom className={cn("overflow-hidden", { ["-mx-4"]: smallScreen })}>
          <DynamicMonacoEditor value={editedManifest} onChange={handleTextChange} />
        </ViewPanel>
      )}
      {selectedSdlEditMode === "builder" && <SdlBuilder sdlString={editedManifest} ref={sdlBuilderRef} setEditedManifest={setEditedManifest} />}

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
