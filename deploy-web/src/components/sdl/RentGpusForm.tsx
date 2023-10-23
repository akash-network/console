import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { ITemplate, SdlBuilderFormValues, Service } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { defaultService } from "@src/utils/sdl/data";
import { SimpleServiceFormControl } from "./SimpleServiceFormControl";
import { ImportSdlModal } from "./ImportSdlModal";
import { useRouter } from "next/router";
import axios from "axios";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { SaveTemplateModal } from "./SaveTemplateModal";
import { useSnackbar } from "notistack";
import { Snackbar } from "../shared/Snackbar";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { memoryUnits, storageUnits } from "../shared/akash/units";
import sdlStore from "@src/store/sdlStore";
import { RouteStepKeys } from "@src/utils/constants";
import { useAtom } from "jotai";
import { useProviderAttributesSchema } from "@src/queries/useProvidersQuery";
import { PreviewSdl } from "./PreviewSdl";
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
  } = useForm<SdlBuilderFormValues>({
    defaultValues: {
      services: [{ ...defaultService }]
    }
  });
  const { services: _services } = watch();
  const router = useRouter();

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

  const onSubmit = async (data: SdlBuilderFormValues) => {
    setError(null);

    try {
      const sdl = generateSdl(data);

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
        <Paper sx={{ marginTop: "1rem" }}>
          <FormPaper elevation={1} sx={{ padding: ".5rem 1rem 1rem" }}>
            <Controller
              control={control}
              name={`services.0.profile.gpu`}
              rules={{
                validate: v => {
                  if (!v) return "GPU amount is required.";
                  else if (v < 1) return "GPU amount must be greater than 0.";
                  return true;
                }
              }}
              render={({ field, fieldState }) => (
                <FormControl
                  className={cx(classes.formControl, classes.textField)}
                  variant="standard"
                  sx={{ marginBottom: "0 !important" }}
                  error={!!fieldState.error}
                >
                  <Box
                    sx={{
                      display: "flex"
                      // alignItems: { xs: "flex-start", sm: "center" },
                      // flexDirection: { xs: "column", sm: "row" }
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                        <SpeedIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                        <strong>GPU</strong>

                        <CustomTooltip
                          arrow
                          title={
                            <>
                              The amount of GPUs required for this workload.
                              <br />
                              <br />
                              You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any GPU model
                              will bid on your workload.
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                        </CustomTooltip>
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        // marginTop: { xs: ".5rem", sm: 0 }
                        marginLeft: "1rem"
                      }}
                    >
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
                    </Box>
                  </Box>

                  <Slider
                    value={field.value || 0}
                    min={1}
                    max={100}
                    step={1}
                    color="secondary"
                    aria-label="GPUs"
                    valueLabelDisplay="auto"
                    onChange={(event, newValue) => field.onChange(newValue)}
                  />

                  {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                </FormControl>
              )}
            />

            <div>
              <Box sx={{ marginTop: "1rem" }}>
                <Controller
                  control={control}
                  name={`services.0.profile.gpuVendor`}
                  rules={{ required: "GPU vendor is required." }}
                  defaultValue=""
                  render={({ field }) => (
                    <Select
                      value={field.value || ""}
                      onChange={field.onChange}
                      variant="outlined"
                      fullWidth
                      size="small"
                      MenuProps={{ disableScrollLock: true }}
                    >
                      {gpuVendors.map(u => (
                        <MenuItem key={u.id} value={u.value}>
                          {u.value}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </Box>

              <Box sx={{ marginTop: "1rem" }}>
                {providerAttributesSchema ? (
                  <FormSelect
                    control={control}
                    label="GPU models"
                    optionName="hardware-gpu-model"
                    name={`services.0.profile.gpuModels`}
                    providerAttributesSchema={providerAttributesSchema}
                    required={false}
                    multiple
                  />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <CircularProgress size="1rem" color="secondary" />
                    <Typography color="textSecondary" variant="caption" sx={{ marginLeft: ".5rem" }}>
                      Loading GPU models...
                    </Typography>
                  </Box>
                )}
              </Box>
            </div>
          </FormPaper>
        </Paper>

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
