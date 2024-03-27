import { ReactNode, useState } from "react";
import { makeStyles } from "tss-react/mui";
import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  ClickAwayListener,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";
import { Control, Controller, useFieldArray } from "react-hook-form";
import SpeedIcon from "@mui/icons-material/Speed";
import { cx } from "@emotion/css";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { gpuVendors } from "../shared/akash/gpu";
import { FormSelect } from "./FormSelect";
import { validationConfig } from "../shared/akash/units";
import { GpuModel, GpuVendor } from "@src/types/gpu";

type Props = {
  serviceIndex: number;
  hasGpu: boolean;
  hideHasGpu?: boolean;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  gpuModels: GpuVendor[];
  currentService: Service;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const GpuFormControl: React.FunctionComponent<Props> = ({ gpuModels, control, serviceIndex, hasGpu, currentService, hideHasGpu }) => {
  const {
    fields: formGpuModels,
    remove: removeFormGpuModel,
    append: appendFormGpuModel
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.profile.gpuModels`,
    keyName: "id"
  });
  const { classes } = useStyles();
  const theme = useTheme();
  // const vendor = currentService.profile.gpuVendor;
  // const models = gpuModels ? gpuModels.find(u => u.name === vendor)?.models : [];

  const onAddGpuModel = () => {
    appendFormGpuModel({ unit: 1, vendor: "nvidia", name: "", memory: "", interface: "" });
  };

  return (
    <>
      {formGpuModels.map((formGpu, formGpuIndex) => {
        const currentGpu = currentService.profile.gpuModels[formGpuIndex];
        const models = gpuModels?.find(u => u.name === currentGpu.vendor)?.models || [];
        const interfaces = models.find(m => m.name === currentGpu.name)?.interface || [];
        const memorySizes = models.find(m => m.name === currentGpu.name)?.memory || [];

        return (
          <FormPaper elevation={1} sx={{ padding: hasGpu ? ".5rem 1rem 1rem" : ".5rem 1rem" }} key={`${formGpu.vendor}${formGpu.name}${formGpu.name}`}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.unit`}
              rules={{
                validate: v => {
                  if (!v) return "GPU amount is required.";

                  const _value = v || 0;

                  if (_value < 1) return "GPU amount must be greater than 0.";
                  else if (currentService.count === 1 && _value > validationConfig.maxGpuAmount) {
                    return `Maximum amount of GPU for a single service instance is ${validationConfig.maxGpuAmount}.`;
                  } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupGpuCount) {
                    return `Maximum total amount of GPU for a single service instance group is ${validationConfig.maxGroupGpuCount}.`;
                  }
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
                      display: "flex",
                      alignItems: "center"
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
                              <br />
                              <br />
                              <a href="https://docs.akash.network/testnet/example-gpu-sdls/specific-gpu-vendor" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                        </CustomTooltip>
                      </Typography>

                      {!hideHasGpu && (
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.hasGpu`}
                          render={({ field }) => (
                            <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />
                          )}
                        />
                      )}
                    </Box>

                    {hasGpu && (
                      <Box sx={{ marginLeft: "1rem" }}>
                        <TextField
                          type="number"
                          variant="outlined"
                          color="secondary"
                          value={field.value || ""}
                          error={!!fieldState.error}
                          onChange={event => field.onChange(parseFloat(event.target.value))}
                          inputProps={{ min: 1, step: 1, max: validationConfig.maxGpuAmount }}
                          size="small"
                          sx={{ width: "100px" }}
                        />
                      </Box>
                    )}
                  </Box>

                  {hasGpu && (
                    <Slider
                      value={field.value || 0}
                      min={1}
                      max={validationConfig.maxGpuAmount}
                      step={1}
                      color="secondary"
                      aria-label="GPUs"
                      valueLabelDisplay="auto"
                      onChange={(event, newValue) => field.onChange(newValue)}
                    />
                  )}

                  {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                </FormControl>
              )}
            />

            {hasGpu && (
              <div>
                <Box sx={{ marginTop: "1rem" }}></Box>

                <Box sx={{ marginTop: "1rem", display: "flex", alignItems: "center" }}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.vendor`}
                    rules={{ required: "GPU vendor is required." }}
                    defaultValue=""
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel id="gpu-vendor-select-label">Vendor</InputLabel>
                        <Select
                          labelId="gpu-vendor-select-label"
                          value={field.value || ""}
                          onChange={field.onChange}
                          variant="outlined"
                          label="Vendor"
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
                      </FormControl>
                    )}
                  />

                  {gpuModels ? (
                    <>
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.name`}
                        render={({ field }) => (
                          <FormControl fullWidth sx={{ ml: 1 }}>
                            <InputLabel id="gpu-model-select-label">GPU Model</InputLabel>
                            <Select
                              labelId="gpu-model-select-label"
                              value={field.value || ""}
                              onChange={field.onChange}
                              variant="outlined"
                              size="small"
                              label="GPU Model"
                              fullWidth
                              MenuProps={{ disableScrollLock: true }}
                            >
                              {models.map(gpu => (
                                <MenuItem key={gpu.name} value={gpu.name}>
                                  {gpu.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`}
                        disabled={!currentGpu.name}
                        render={({ field }) => (
                          <FormControl fullWidth sx={{ ml: 1 }}>
                            <InputLabel id="gpu-memory-select-label">Memory Size</InputLabel>
                            <Select
                              labelId="gpu-memory-select-label"
                              value={field.value || ""}
                              onChange={field.onChange}
                              variant="outlined"
                              size="small"
                              label="Memory Size"
                              fullWidth
                              MenuProps={{ disableScrollLock: true }}
                            >
                              {memorySizes.map(x => (
                                <MenuItem key={x} value={x}>
                                  {x}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`}
                        disabled={!currentGpu.name}
                        render={({ field }) => (
                          <FormControl fullWidth sx={{ ml: 1 }}>
                            <InputLabel id="gpu-interface-select-label">Interface</InputLabel>
                            <Select
                              labelId="gpu-interface-select-label"
                              value={field.value || ""}
                              onChange={field.onChange}
                              variant="outlined"
                              size="small"
                              label="Interface"
                              fullWidth
                              MenuProps={{ disableScrollLock: true }}
                            >
                              {interfaces.map(x => (
                                <MenuItem key={x} value={x}>
                                  {x}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                    </>
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
            )}
          </FormPaper>
        );
      })}
    </>
  );
};
