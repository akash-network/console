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
import { Control, Controller } from "react-hook-form";
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
  const { classes } = useStyles();
  const theme = useTheme();
  const vendor = currentService.profile.gpuVendor;
  const models = gpuModels ? gpuModels.find(u => u.name === vendor)?.models : [];

  return (
    <FormPaper elevation={1} sx={{ padding: hasGpu ? ".5rem 1rem 1rem" : ".5rem 1rem" }}>
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

      {hasGpu && (
        <div>
          <Box sx={{ marginTop: "1rem" }}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.gpuVendor`}
              rules={{ required: "GPU vendor is required." }}
              defaultValue=""
              render={({ field }) => (
                <Select value={field.value || ""} onChange={field.onChange} variant="outlined" fullWidth size="small" MenuProps={{ disableScrollLock: true }}>
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
            {gpuModels ? (
              <GpuModelSelect control={control} serviceIndex={serviceIndex} gpuModels={models} />
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
};

type GpuModelSelectProps = {
  control: Control<any, any>;
  serviceIndex: number;
  gpuModels: GpuModel[];
};

export const GpuModelSelect: React.FunctionComponent<GpuModelSelectProps> = ({ control, serviceIndex, gpuModels }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.gpuModels`}
      render={({ field, fieldState }) => (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {/* <FormSelect
                control={control}
                label="GPU models (any if empty)"
                optionName="hardware-gpu-model"
                name={`services.${serviceIndex}.profile.gpuModels`}
                providerAttributesSchema={providerAttributesSchema}
                required={false}
                multiple
              /> */}

          <Autocomplete
            disableClearable
            open={isOpen}
            options={gpuModels}
            value={field.value || ([] as any)}
            getOptionLabel={option => option.name || ""}
            defaultValue={[]}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            filterSelectedOptions
            fullWidth
            multiple
            ChipProps={{ size: "small" }}
            onChange={(event, newValue: GpuModel[]) => {
              field.onChange(newValue);
            }}
            renderInput={params => (
              <ClickAwayListener onClickAway={() => setIsOpen(false)}>
                <TextField
                  {...params}
                  label="GPU models (any if empty)"
                  variant="outlined"
                  color="secondary"
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onClick={() => setIsOpen(prev => !prev)}
                  sx={{ minHeight: "42px" }}
                />
              </ClickAwayListener>
            )}
            renderOption={(props, option) => {
              return (
                <Box
                  component="li"
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between !important", width: "100%", padding: ".2rem .5rem" }}
                  {...props}
                  key={option.name}
                >
                  <div>{option.name}</div>
                </Box>
              );
            }}
          />
        </Box>
      )}
    />
  );
};
