import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
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
import { Control, Controller, UseFormSetValue, useFieldArray } from "react-hook-form";
import SpeedIcon from "@mui/icons-material/Speed";
import { gpuVendors } from "../shared/akash/gpu";
import { validationConfig } from "../shared/akash/units";
import { GpuVendor } from "@src/types/gpu";
import DeleteIcon from "@mui/icons-material/Delete";
import ClearIcon from "@mui/icons-material/Clear";

type Props = {
  serviceIndex: number;
  hasGpu: boolean;
  hideHasGpu?: boolean;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  gpuModels: GpuVendor[];
  currentService: Service;
  setValue: UseFormSetValue<RentGpusFormValues | SdlBuilderFormValues>;
};

export const GpuFormControl: React.FunctionComponent<Props> = ({ gpuModels, control, serviceIndex, hasGpu, currentService, setValue, hideHasGpu }) => {
  const {
    fields: formGpuModels,
    remove: removeFormGpuModel,
    append: appendFormGpuModel
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.profile.gpuModels`,
    keyName: "id"
  });
  const theme = useTheme();

  const onAddGpuModel = () => {
    appendFormGpuModel({ vendor: "nvidia", name: "", memory: "", interface: "" });
  };

  return (
    <FormPaper elevation={1} sx={{ padding: "1rem" }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Controller
          control={control}
          name={`services.${serviceIndex}.profile.gpu`}
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
            <FormControl variant="standard" error={!!fieldState.error} fullWidth>
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
                          You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any GPU model will
                          bid on your workload.
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
      </Box>

      {hasGpu && (
        <>
          <Box sx={{ mb: 3, mt: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Picking specific GPU models below, filters out providers that don't have those GPUs and may reduce the number of bids you receive.
            </Typography>
          </Box>

          {formGpuModels.map((formGpu, formGpuIndex) => {
            const currentGpu = currentService.profile.gpuModels[formGpuIndex];
            const models = gpuModels?.find(u => u.name === currentGpu.vendor)?.models || [];
            const interfaces = models.find(m => m.name === currentGpu.name)?.interface || [];
            const memorySizes = models.find(m => m.name === currentGpu.name)?.memory || [];

            return (
              <Box sx={{ marginBottom: 2 }} key={`${formGpuIndex}${formGpu.vendor}${formGpu.name}${formGpu.memory}${formGpu.interface}`}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.vendor`}
                      rules={{ required: "GPU vendor is required." }}
                      defaultValue=""
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel id="gpu-vendor-select-label" size="small">
                            Vendor
                          </InputLabel>
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
                  </Grid>
                  {gpuModels ? (
                    <>
                      <Grid item xs={12} sm={3}>
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.name`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-model-select-label" size="small">
                                Model
                              </InputLabel>
                              <Select
                                labelId="gpu-model-select-label"
                                value={field.value || ""}
                                onChange={event => {
                                  field.onChange(event);
                                  setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`, "");
                                  setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`, "");
                                }}
                                variant="outlined"
                                size="small"
                                label="Model"
                                fullWidth
                                IconComponent={
                                  field.value?.length > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={e => {
                                            field.onChange("");
                                            setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`, "");
                                            setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`, "");
                                          }}
                                        >
                                          <ClearIcon fontSize="small" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
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
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-memory-select-label" size="small">
                                Memory
                              </InputLabel>
                              <Select
                                labelId="gpu-memory-select-label"
                                value={field.value || ""}
                                onChange={field.onChange}
                                variant="outlined"
                                size="small"
                                disabled={!currentGpu.name}
                                label="Memory"
                                fullWidth
                                IconComponent={
                                  field.value?.length > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={e => {
                                            field.onChange("");
                                          }}
                                        >
                                          <ClearIcon fontSize="small" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
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
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-interface-select-label" size="small">
                                Interface
                              </InputLabel>
                              <Select
                                labelId="gpu-interface-select-label"
                                value={field.value || ""}
                                onChange={field.onChange}
                                variant="outlined"
                                size="small"
                                disabled={!currentGpu.name}
                                label="Interface"
                                fullWidth
                                IconComponent={
                                  field.value?.length > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={e => {
                                            field.onChange("");
                                          }}
                                        >
                                          <ClearIcon fontSize="small" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
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
                      </Grid>

                      <Grid item xs={12} sm={1} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {formGpuIndex !== 0 && (
                          <IconButton onClick={() => removeFormGpuModel(formGpuIndex)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Grid>
                    </>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", ml: 4 }}>
                      <CircularProgress size="1rem" color="secondary" />
                      <Typography color="textSecondary" variant="caption" sx={{ marginLeft: ".5rem" }}>
                        Loading GPU models...
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Box>
            );
          })}
        </>
      )}

      {gpuModels && hasGpu && (
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "end" }}>
          <Button color="secondary" variant="contained" size="small" onClick={onAddGpuModel}>
            Add GPU
          </Button>
        </Box>
      )}
    </FormPaper>
  );
};
