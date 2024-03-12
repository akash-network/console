import { Alert, Box, Button, CircularProgress, Grid, Paper, Typography } from "@mui/material";
import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { ApiTemplate, ProfileGpuModel, RentGpusFormValues, Service } from "@src/types";
import { defaultAnyRegion, defaultRentGpuService } from "@src/utils/sdl/data";
import { useRouter } from "next/router";
import sdlStore from "@src/store/sdlStore";
import { useAtom } from "jotai";
import { RegionSelect } from "./RegionSelect";
import { AdvancedConfig } from "./AdvancedConfig";
import { GpuFormControl } from "./GpuFormControl";
import { CpuFormControl } from "./CpuFormControl";
import { MemoryFormControl } from "./MemoryFormControl";
import { StorageFormControl } from "./StorageFormControl";
import { TokenFormControl } from "./TokenFormControl";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { UrlService, handleDocClick } from "@src/utils/urlUtils";
import { RouteStepKeys, defaultInitialDeposit } from "@src/utils/constants";
import { deploymentData } from "@src/utils/deploymentData";
import { useCertificate } from "@src/context/CertificateProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { generateCertificate } from "@src/utils/certificateUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { updateWallet } from "@src/utils/walletUtils";
import { saveDeploymentManifestAndName } from "@src/utils/deploymentLocalDataUtils";
import { DeploymentDepositModal } from "../deploymentDetail/DeploymentDepositModal";
import { LinkTo } from "../shared/LinkTo";
import { PrerequisiteList } from "../../app/new-deployment/PrerequisiteList";
import { ProviderAttributeSchemaDetailValue } from "@src/types/providerAttributes";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { ImageSelect } from "./ImageSelect";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useChainParam } from "@src/context/ChainParamProvider";
import { useGpuModels } from "@src/queries/useGpuQuery";

type Props = {};

export const RentGpusForm: React.FunctionComponent<Props> = ({}) => {
  const [error, setError] = useState(null);
  // const [templateMetadata, setTemplateMetadata] = useState<ITemplate>(null);
  const [isQueryInit, setIsQuertInit] = useState(false);
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(false);
  const formRef = useRef<HTMLFormElement>();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [rentGpuSdl, setRentGpuSdl] = useAtom(sdlStore.rentGpuSdl);
  const { data: gpuModels } = useGpuModels();
  const { handleSubmit, control, watch, setValue, trigger } = useForm<RentGpusFormValues>({
    defaultValues: {
      services: [{ ...defaultRentGpuService }],
      region: { ...defaultAnyRegion }
    }
  });
  const { services: _services } = watch();
  const router = useRouter();
  const currentService: Service = _services[0] || ({} as any);
  const { settings } = useSettings();
  const { address, signAndBroadcastTx } = useWallet();
  const { loadValidCertificates, localCert, isLocalCertMatching, loadLocalCert, setSelectedCertificate } = useCertificate();
  const [sdlDenom, setSdlDenom] = useState("uakt");
  const { minDeposit } = useChainParam();

  useEffect(() => {
    if (rentGpuSdl && rentGpuSdl.services) {
      setValue("services", structuredClone(rentGpuSdl.services));
      setValue("region", rentGpuSdl.region || { ...defaultAnyRegion });

      // Set the value of gpu models specifically because nested value doesn't re-render correctly
      // https://github.com/react-hook-form/react-hook-form/issues/7758
      setValue("services.0.profile.gpuModels", rentGpuSdl.services[0].profile.gpuModels || []);
    }

    const subscription = watch(({ services, region }) => {
      setRentGpuSdl({ services: services as Service[], region: region as ProviderAttributeSchemaDetailValue });
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (router.query.vendor && router.query.gpu && gpuModels && !isQueryInit) {
      // Example query: ?vendor=nvidia&gpu=h100&vram=80Gi&interface=sxm
      const vendorQuery = router.query.vendor as string;
      const gpuQuery = router.query.gpu as string;
      const gpuModel = gpuModels.find(x => x.name === vendorQuery)?.models.find(x => x.name === gpuQuery);

      if (gpuModel) {
        const memoryQuery = router.query.vram as string;
        const interfaceQuery = router.query.interface as string;

        const model: ProfileGpuModel = {
          vendor: vendorQuery,
          name: gpuModel.name,
          memory: gpuModel.memory.find(x => x === memoryQuery) || "",
          interface: gpuModel.interface.find(x => x === interfaceQuery) || ""
        };
        setValue("services.0.profile.gpuModels", [model]);
      } else {
        console.log("GPU model not found", gpuQuery);
      }

      setIsQuertInit(true);
    }
  }, [router.query, gpuModels, isQueryInit]);

  async function createAndValidateDeploymentData(yamlStr: string, dseq = null, deposit = defaultInitialDeposit, depositorAddress = null) {
    try {
      if (!yamlStr) return null;

      const dd = await deploymentData.NewDeploymentData(settings.apiEndpoint, yamlStr, dseq, address, deposit, depositorAddress);
      validateDeploymentData(dd);

      setSdlDenom(dd.deposit.denom);

      return dd;
    } catch (err) {
      console.error(err);
    }
  }

  const createAndValidateSdl = (yamlStr: string) => {
    try {
      if (!yamlStr) return null;

      const services = importSimpleSdl(yamlStr);

      setError(null);

      return services;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        setError(err.message);
      } else if (err.name === "TemplateValidation") {
        setError(err.message);
      } else {
        setError("Error while parsing SDL file");
        // setParsingError(err.message);
        console.error(err);
      }
    }
  };

  const onSelectTemplate = (template: ApiTemplate) => {
    const result = createAndValidateSdl(template?.deploy);

    if (!result) return;

    // Filter out invalid gpu models
    const _gpuModels = (result[0].profile.gpuModels || []).map(templateModel => {
      const isValid = gpuModels?.find(x => x.name === templateModel.vendor)?.models.some(x => x.name === templateModel.name);
      return {
        vendor: isValid ? templateModel.vendor : "nvidia",
        name: isValid ? templateModel.name : "",
        memory: isValid ? templateModel.memory : "",
        interface: isValid ? templateModel.interface : ""
      };
    });

    setValue("services", result as Service[]);
    setValue("services.0.profile.gpuModels", _gpuModels);
    trigger();
  };

  const onPrerequisiteContinue = () => {
    setIsCheckingPrerequisites(false);
    setIsDepositingDeployment(true);
  };

  const onDeploymentDeposit = async (deposit: number, depositorAddress: string) => {
    setIsDepositingDeployment(false);
    await handleCreateClick(deposit, depositorAddress);
  };

  const onSubmit = async (data: RentGpusFormValues) => {
    setRentGpuSdl(data);
    setIsCheckingPrerequisites(true);
  };

  async function handleCreateClick(deposit: number, depositorAddress: string) {
    setError(null);

    try {
      const sdl = generateSdl(rentGpuSdl.services, rentGpuSdl.region.key);

      setIsCreatingDeployment(true);

      const dd = await createAndValidateDeploymentData(sdl, null, deposit, depositorAddress);
      const validCertificates = await loadValidCertificates();
      const currentCert = validCertificates.find(x => x.parsed === localCert?.certPem);
      const isCertificateValidated = currentCert?.certificate?.state === "valid";
      const isLocalCertificateValidated = !!localCert && isLocalCertMatching;

      if (!dd) return;

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
        saveDeploymentManifestAndName(dd.deploymentId.dseq, sdl, dd.version, address, currentService.image);
        router.push(UrlService.newDeployment({ step: RouteStepKeys.createLeases, dseq: dd.deploymentId.dseq }));

        event(AnalyticsEvents.CREATE_GPU_DEPLOYMENT, {
          category: "deployments",
          label: "Create deployment rent gpu form"
        });
      } else {
        setIsCreatingDeployment(false);
      }
    } catch (error) {
      setIsCreatingDeployment(false);
      setError(error.message);
    }
  }

  return (
    <>
      {isDepositingDeployment && (
        <DeploymentDepositModal
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
          denom={currentService?.placement?.pricing?.denom || sdlDenom}
          infoText={
            <Alert severity="info" sx={{ marginBottom: "1rem" }} variant="outlined">
              <Typography variant="caption">
                To create a deployment, you need to have at least <b>{minDeposit.akt} AKT</b> or <b>{minDeposit.usdc} USDC</b> in an escrow account.{" "}
                <LinkTo onClick={ev => handleDocClick(ev, "https://docs.akash.network/glossary/escrow#escrow-accounts")}>
                  <strong>Learn more.</strong>
                </LinkTo>
              </Typography>
            </Alert>
          }
        />
      )}
      {isCheckingPrerequisites && <PrerequisiteList onClose={() => setIsCheckingPrerequisites(false)} onContinue={onPrerequisiteContinue} />}

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <Paper sx={{ marginTop: "1rem", padding: "1rem" }} elevation={2}>
          <ImageSelect control={control as any} currentService={currentService} onSelectTemplate={onSelectTemplate} />

          <Box sx={{ marginTop: "1rem" }}>
            <GpuFormControl
              control={control as any}
              gpuModels={gpuModels}
              serviceIndex={0}
              hasGpu
              currentService={currentService}
              setValue={setValue}
              hideHasGpu
            />
          </Box>

          <Box sx={{ marginTop: "1rem" }}>
            <CpuFormControl control={control as any} currentService={currentService} serviceIndex={0} />
          </Box>

          <Box sx={{ marginTop: "1rem" }}>
            <MemoryFormControl control={control as any} currentService={currentService} serviceIndex={0} />
          </Box>

          <Box sx={{ marginTop: "1rem" }}>
            <StorageFormControl control={control as any} currentService={currentService} serviceIndex={0} />
          </Box>

          <Grid container spacing={2} sx={{ marginTop: "1rem" }}>
            <Grid item xs={6}>
              <RegionSelect control={control} />
            </Grid>
            <Grid item xs={6}>
              <TokenFormControl control={control} name="services.0.placement.pricing.denom" />
            </Grid>
          </Grid>
        </Paper>

        <AdvancedConfig control={control} currentService={currentService} />

        {error && (
          <Alert severity="error" variant="outlined" sx={{ marginTop: "1rem" }}>
            {error}
          </Alert>
        )}

        {currentService?.env?.some(x => !!x.key && !x.value) && (
          <Alert severity="warning" variant="outlined" sx={{ marginTop: "1rem" }}>
            Some of the environment variables are empty. Please fill them in the advanced configuration before deploying.
          </Alert>
        )}

        <Box sx={{ paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button size="large" color="secondary" variant="contained" type="submit" disabled={isCreatingDeployment || !!error}>
              {isCreatingDeployment ? (
                <CircularProgress size="24px" color="secondary" />
              ) : (
                <>
                  Deploy{" "}
                  <Box component="span" marginLeft=".5rem" display="flex" alignItems="center">
                    <RocketLaunchIcon fontSize="small" />
                  </Box>
                </>
              )}
            </Button>
          </Box>
        </Box>
      </form>
    </>
  );
};
