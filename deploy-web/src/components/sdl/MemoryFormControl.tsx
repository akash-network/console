import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Box, FormControl, FormHelperText, MenuItem, Select, Slider, TextField, Typography, useTheme } from "@mui/material";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";
import { Control, Controller } from "react-hook-form";
import { cx } from "@emotion/css";
import MemoryIcon from "@mui/icons-material/Memory";
import { validationConfig, memoryUnits } from "../shared/akash/units";

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

export const MemoryFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.ram`}
      rules={{
        validate: v => {
          if (!v) return "Memory amount is required.";

          const currentUnit = memoryUnits.find(u => currentService.profile.ramUnit === u.suffix);
          const _value = (v || 0) * currentUnit.value;

          if (currentService.count === 1 && _value < validationConfig.minMemory) {
            return "Minimum amount of memory for a single service instance is 1 Mi.";
          } else if (currentService.count === 1 && currentService.count * _value > validationConfig.maxMemory) {
            return "Maximum amount of memory for a single service instance is 512 Gi.";
          } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupMemory) {
            return "Maximum total amount of memory for a single service instance group is 1024 Gi.";
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
                alignItems: { xs: "flex-start", sm: "center" },
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

              <Box sx={{ marginTop: { xs: ".5rem", sm: 0 }, marginLeft: { xs: 0, sm: "1rem" } }}>
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
                  name={`services.${serviceIndex}.profile.ramUnit`}
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
  );
};
