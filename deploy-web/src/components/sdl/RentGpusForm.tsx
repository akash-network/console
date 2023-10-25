import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { useRef, useState } from "react";
import { ITemplate, RentGpusFormValues } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { useRouter } from "next/router";
import Link from "next/link";
import { useSnackbar } from "notistack";
import { maxGroupMemory, maxMemory, maxStorage, memoryUnits, minMemory, minStorage, storageUnits } from "../shared/akash/units";
import sdlStore from "@src/store/sdlStore";
import { useAtom } from "jotai";
import { useProviderAttributesSchema } from "@src/queries/useProvidersQuery";
import { FormPaper } from "./FormPaper";
import { cx } from "@emotion/css";
import { makeStyles } from "tss-react/mui";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoIcon from "@mui/icons-material/Info";
import { CustomTooltip } from "../shared/CustomTooltip";
import { gpuVendors } from "../shared/akash/gpu";
import { FormSelect } from "./FormSelect";
import Image from "next/legacy/image";
import { useSdlDenoms } from "@src/hooks/useDenom";
import { RegionSelect } from "./RegionSelect";
import { AdvancedConfig } from "./AdvancedConfig";
import { GpuFormControl } from "./GpuFormControl";
import { CpuFormControl } from "./CpuFormControl";
import { MemoryFormControl } from "./MemoryFormControl";
import { StorageFormControl } from "./StorageFormControl";

type Props = {};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const RentGpusForm: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const [error, setError] = useState(null);
  const [templateMetadata, setTemplateMetadata] = useState<ITemplate>(null);
  const formRef = useRef<HTMLFormElement>();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  // const [sdlBuilderSdl, setSdlBuilderSdl] = useAtom(sdlStore.sdlBuilderSdl);
  const { data: providerAttributesSchema } = useProviderAttributesSchema();
  const { enqueueSnackbar } = useSnackbar();
  const {
    handleSubmit,
    reset,
    control,
    formState: { isValid },
    trigger,
    watch,
    setValue
  } = useForm<RentGpusFormValues>({
    defaultValues: {
      services: [{ ...defaultService }],
      region: {
        key: "any",
        value: "any",
        description: "Any region"
      }
    }
  });
  const { services: _services } = watch();
  const router = useRouter();
  const supportedSdlDenoms = useSdlDenoms();
  const currentService = _services[0] || ({} as any);

  // useEffect(() => {
  //   if (sdlBuilderSdl && sdlBuilderSdl.services) {
  //     setValue("services", sdlBuilderSdl.services);
  //   }
  // }, []);

  // useEffect(() => {
  //   if (_services) {
  //     setSdlBuilderSdl({ services: _services });
  //   }
  // }, [_services]);

  const onSubmit = async (data: RentGpusFormValues) => {
    setError(null);

    try {
      // const sdl = generateSdl(data);
      // setDeploySdl({
      //   title: "",
      //   category: "",
      //   code: "",
      //   description: "",
      //   content: sdl
      // });
      // router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
      // event(AnalyticsEvents.DEPLOY_SDL, {
      //   category: "sdl_builder",
      //   label: "Deploy SDL from create page"
      // });
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <Paper sx={{ marginTop: "1rem", padding: "1rem" }} elevation={2}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Controller
              control={control}
              name={`services.0.image`}
              rules={{
                required: "Docker image name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9\-_/:.]+$/.test(value);

                  if (!hasValidChars) {
                    return "Invalid docker image name.";
                  }

                  return true;
                }
              }}
              render={({ field, fieldState }) => (
                <TextField
                  type="text"
                  variant="outlined"
                  label={`Docker Image / OS`}
                  placeholder="Example: mydockerimage:1.01"
                  color="secondary"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                  size="small"
                  value={field.value}
                  onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                          component={Link}
                          size="small"
                          target="_blank"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <CustomTooltip
              arrow
              title={
                <>
                  Docker image of the container.
                  <br />
                  <br />
                  Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                </>
              }
            >
              <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: ".5rem" }} />
            </CustomTooltip>
          </Box>

          <Box sx={{ marginTop: "1rem" }}>
            <GpuFormControl control={control as any} providerAttributesSchema={providerAttributesSchema} serviceIndex={0} hasGpu />
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
              <RegionSelect control={control} providerAttributesSchema={providerAttributesSchema} />
            </Grid>
            <Grid item xs={6}>
              <FormControl className={classes.formControl} fullWidth sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
                <InputLabel id="grant-token">Token</InputLabel>
                <Controller
                  control={control}
                  name={`services.0.placement.pricing.denom`}
                  defaultValue=""
                  rules={{
                    required: true
                  }}
                  render={({ fieldState, field }) => {
                    return (
                      <Select {...field} labelId="sdl-token" label="Token" size="small" error={!!fieldState.error} fullWidth>
                        {supportedSdlDenoms.map(token => (
                          <MenuItem key={token.id} value={token.value}>
                            {token.tokenLabel}
                          </MenuItem>
                        ))}
                      </Select>
                    );
                  }}
                />
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        <AdvancedConfig control={control} currentService={currentService} providerAttributesSchema={providerAttributesSchema} />

        <Box sx={{ paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button color="secondary" variant="contained" type="submit">
              Deploy
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" variant="outlined" sx={{ marginTop: "1rem" }}>
            {error}
          </Alert>
        )}
      </form>
    </>
  );
};
