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

          <Controller
            control={control}
            name={`services.0.profile.cpu`}
            rules={{
              validate: v => {
                if (!v) return "CPU amount is required.";

                const _value = v || 0;

                if (currentService.count === 1 && _value < 0.1) {
                  return "Minimum amount of CPU for a single service instance is 0.1.";
                } else if (currentService.count === 1 && _value > 256) {
                  return "Maximum amount of CPU for a single service instance is 256.";
                } else if (currentService.count > 1 && currentService.count * _value > 512) {
                  return "Maximum total amount of CPU for a single service instance group is 512.";
                }

                return true;
              }
            }}
            render={({ field, fieldState }) => (
              <FormPaper
                elevation={1}
                sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}`, marginTop: "1rem" }}
              >
                <FormControl
                  className={cx(classes.formControl, classes.textField)}
                  variant="standard"
                  sx={{ marginBottom: "0 !important" }}
                  error={!!fieldState.error}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" }
                    }}
                  >
                    <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                      <SpeedIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                      <strong>CPU</strong>

                      <CustomTooltip
                        arrow
                        title={
                          <>
                            The amount of vCPU's required for this workload.
                            <br />
                            <br />
                            The maximum for a single instance is 256 vCPU's.
                            <br />
                            <br />
                            The maximum total multiplied by the count of instances is 512 vCPU's.
                          </>
                        }
                      >
                        <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                      </CustomTooltip>
                    </Typography>

                    <TextField
                      type="number"
                      variant="outlined"
                      color="secondary"
                      error={!!fieldState.error}
                      value={field.value || ""}
                      onChange={event => field.onChange(parseFloat(event.target.value))}
                      inputProps={{ min: 0.1, max: 256, step: 0.1 }}
                      size="small"
                      sx={{ width: "100px", marginTop: { xs: ".5rem", sm: 0 } }}
                    />
                  </Box>

                  <Slider
                    value={field.value || 0}
                    min={0.1}
                    max={256}
                    step={1}
                    color="secondary"
                    aria-label="CPU"
                    valueLabelDisplay="auto"
                    onChange={(event, newValue) => field.onChange(newValue)}
                  />

                  {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                </FormControl>
              </FormPaper>
            )}
          />

          <Controller
            control={control}
            name={`services.0.profile.ram`}
            rules={{
              validate: v => {
                if (!v) return "Memory amount is required.";

                const currentUnit = memoryUnits.find(u => currentService.profile.ramUnit === u.suffix);
                const _value = (v || 0) * currentUnit.value;

                if (currentService.count === 1 && _value < minMemory) {
                  return "Minimum amount of memory for a single service instance is 1 Mi.";
                } else if (currentService.count === 1 && currentService.count * _value > maxMemory) {
                  return "Maximum amount of memory for a single service instance is 512 Gi.";
                } else if (currentService.count > 1 && currentService.count * _value > maxGroupMemory) {
                  return "Maximum total amount of memory for a single service instance group is 1024 Gi.";
                }

                return true;
              }
            }}
            render={({ field, fieldState }) => (
              <FormPaper
                elevation={1}
                sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}`, marginTop: "1rem" }}
              >
                <FormControl
                  className={cx(classes.formControl, classes.textField)}
                  variant="standard"
                  sx={{ marginBottom: "0 !important" }}
                  error={!!fieldState.error}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" }
                    }}
                  >
                    <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                      <MemoryIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                      <strong>Memory</strong>

                      <CustomTooltip
                        arrow
                        title={
                          <>
                            The amount of memory required for this workload.
                            <br />
                            <br />
                            The maximum for a single instance is 512 Gi.
                            <br />
                            <br />
                            The maximum total multiplied by the count of instances is 1024 Gi.
                          </>
                        }
                      >
                        <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                      </CustomTooltip>
                    </Typography>

                    <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                      <TextField
                        type="number"
                        variant="outlined"
                        error={!!fieldState.error}
                        color="secondary"
                        value={field.value || ""}
                        onChange={event => field.onChange(parseFloat(event.target.value))}
                        inputProps={{ min: 1, step: 1 }}
                        size="small"
                        sx={{ width: "100px" }}
                      />

                      <Controller
                        control={control}
                        name={`services.0.profile.ramUnit`}
                        rules={{ required: "Ram unit is required." }}
                        defaultValue=""
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onChange={field.onChange}
                            variant="outlined"
                            size="small"
                            sx={{ width: "75px", marginLeft: ".25rem" }}
                            MenuProps={{ disableScrollLock: true }}
                          >
                            {memoryUnits.map(u => (
                              <MenuItem key={u.id} value={u.suffix}>
                                {u.suffix}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                    </Box>
                  </Box>

                  <Slider
                    value={field.value || 0}
                    min={1}
                    max={512}
                    step={1}
                    color="secondary"
                    aria-label="RAM"
                    valueLabelDisplay="auto"
                    onChange={(event, newValue) => field.onChange(newValue)}
                  />

                  {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                </FormControl>
              </FormPaper>
            )}
          />

          <Controller
            control={control}
            rules={{
              validate: v => {
                if (!v) return "Storage amount is required.";

                const currentUnit = storageUnits.find(u => currentService.profile.storageUnit === u.suffix);
                const _value = (v || 0) * currentUnit.value;

                if (currentService.count * _value < minStorage) {
                  return "Minimum amount of storage for a single service instance is 5 Mi.";
                } else if (currentService.count * _value > maxStorage) {
                  return "Maximum amount of storage for a single service instance is 32 Ti.";
                }

                return true;
              }
            }}
            name={`services.0.profile.storage`}
            render={({ field, fieldState }) => (
              <FormPaper
                elevation={1}
                sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}`, marginTop: "1rem" }}
              >
                <FormControl
                  className={cx(classes.formControl, classes.textField)}
                  variant="standard"
                  sx={{ marginBottom: "0 !important" }}
                  error={!!fieldState.error}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" }
                    }}
                  >
                    <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                      <StorageIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                      <strong>Ephemeral Storage</strong>

                      <CustomTooltip
                        arrow
                        title={
                          <>
                            The amount of ephemeral disk storage required for this workload.
                            <br />
                            <br />
                            This disk storage is ephemeral, meaning it will be wiped out on every deployment update or provider reboot.
                            <br />
                            <br />
                            The maximum for a single instance is 32 Ti.
                            <br />
                            <br />
                            The maximum total multiplied by the count of instances is also 32 Ti.
                          </>
                        }
                      >
                        <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                      </CustomTooltip>
                    </Typography>

                    <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                      <TextField
                        type="number"
                        variant="outlined"
                        color="secondary"
                        value={field.value || ""}
                        error={!!fieldState.error}
                        onChange={event => field.onChange(parseFloat(event.target.value))}
                        inputProps={{ min: 1, step: 1 }}
                        size="small"
                        sx={{ width: "100px" }}
                      />

                      <Controller
                        control={control}
                        name={`services.0.profile.storageUnit`}
                        rules={{ required: "Storage unit is required." }}
                        defaultValue=""
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onChange={field.onChange}
                            variant="outlined"
                            size="small"
                            sx={{ width: "75px", marginLeft: ".25rem" }}
                            MenuProps={{ disableScrollLock: true }}
                          >
                            {storageUnits.map(u => (
                              <MenuItem key={u.id} value={u.suffix}>
                                {u.suffix}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                    </Box>
                  </Box>

                  <Slider
                    value={field.value || 0}
                    min={1}
                    max={512}
                    step={1}
                    color="secondary"
                    aria-label="Storage"
                    valueLabelDisplay="auto"
                    onChange={(event, newValue) => field.onChange(newValue)}
                  />

                  {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                </FormControl>
              </FormPaper>
            )}
          />

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
