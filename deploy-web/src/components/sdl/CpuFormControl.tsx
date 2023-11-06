import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Box, FormControl, FormHelperText, Slider, TextField, Typography, useTheme } from "@mui/material";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";
import { Control, Controller } from "react-hook-form";
import SpeedIcon from "@mui/icons-material/Speed";
import { cx } from "@emotion/css";
import { validationConfig } from "../shared/akash/units";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
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

export const CpuFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.cpu`}
      rules={{
        validate: v => {
          if (!v) return "CPU amount is required.";

          const _value = v || 0;

          if (currentService.count === 1 && _value < 0.1) {
            return "Minimum amount of CPU for a single service instance is 0.1.";
          } else if (currentService.count === 1 && _value > validationConfig.maxCpuAmount) {
            return `Maximum amount of CPU for a single service instance is ${validationConfig.maxCpuAmount}.`;
          } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupCpuCount) {
            return `Maximum total amount of CPU for a single service instance group is ${validationConfig.maxGroupCpuCount}.`;
          }

          return true;
        }
      }}
      render={({ field, fieldState }) => (
        <FormPaper elevation={1} sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}` }}>
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
                      The maximum for a single instance is {validationConfig.maxCpuAmount} vCPU's.
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
                inputProps={{ min: 0.1, max: validationConfig.maxCpuAmount, step: 0.1 }}
                size="small"
                sx={{ width: "100px", marginLeft: "1rem" }}
              />
            </Box>

            <Slider
              value={field.value || 0}
              min={0.1}
              max={validationConfig.maxCpuAmount}
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
  );
};
