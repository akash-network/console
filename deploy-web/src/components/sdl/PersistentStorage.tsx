import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Box, Checkbox, FormControl, FormHelperText, InputAdornment, InputLabel, MenuItem, Select, Slider, TextField, Typography, useTheme } from "@mui/material";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";
import { Control, Controller } from "react-hook-form";
import { cx } from "@emotion/css";
import StorageIcon from "@mui/icons-material/Storage";
import { persistentStorageTypes, storageUnits } from "../shared/akash/units";


type Props = {
  currentService: Service;
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const PersistentStorage: React.FunctionComponent<Props> = ({ currentService, serviceIndex, control }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <FormPaper elevation={1} sx={{ padding: currentService.profile.hasPersistentStorage ? ".5rem 1rem 1rem" : ".5rem 1rem" }}>
      <Controller
        control={control}
        name={`services.${serviceIndex}.profile.persistentStorage`}
        rules={{
          min: 1,
          validate: v => {
            if (!v) return "Storage amount is required.";
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
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" }
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                  <StorageIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                  <strong>Persistent Storage</strong>

                  <CustomTooltip
                    arrow
                    title={
                      <>
                        The amount of persistent storage required for this workload.
                        <br />
                        <br />
                        This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
                        <br />
                        <br />
                        <a href="https://docs.akash.network/features/persistent-storage" target="_blank" rel="noopener">
                          View official documentation.
                        </a>
                      </>
                    }
                  >
                    <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                  </CustomTooltip>
                </Typography>

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.hasPersistentStorage`}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />
                  )}
                />
              </Box>

              {currentService.profile.hasPersistentStorage && (
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
                    name={`services.${serviceIndex}.profile.persistentStorageUnit`}
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
              )}
            </Box>

            {currentService.profile.hasPersistentStorage && (
              <Slider
                value={field.value || 0}
                min={1}
                max={512}
                step={1}
                color="secondary"
                aria-label="Persistent Storage"
                valueLabelDisplay="auto"
                onChange={(event, newValue) => field.onChange(newValue)}
              />
            )}

            {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
          </FormControl>
        )}
      />

      {currentService.profile.hasPersistentStorage && (
        <div>
          <Box sx={{ display: "flex", alignItems: "flex-start", marginTop: "1rem" }}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.name`}
              rules={{
                required: "Name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                  const hasValidStartingChar = /^[a-z]/.test(value);
                  const hasValidEndingChar = !value.endsWith("-");

                  if (!hasValidChars) {
                    return "Invalid storage name. It must only be lower case letters, numbers and dashes.";
                  } else if (!hasValidStartingChar) {
                    return "Invalid starting character. It can only start with a lowercase letter.";
                  } else if (!hasValidEndingChar) {
                    return "Invalid ending character. It can only end with a lowercase letter or number";
                  }

                  return true;
                }
              }}
              render={({ field, fieldState }) => (
                <TextField
                  type="text"
                  variant="outlined"
                  color="secondary"
                  label="Name"
                  value={field.value}
                  error={!!fieldState.error}
                  onChange={event => field.onChange(event.target.value)}
                  size="small"
                  sx={{ width: "100%" }}
                  helperText={!!fieldState.error && fieldState.error.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip
                          arrow
                          title={
                            <>
                              The name of the persistent volume.
                              <br />
                              <br />
                              Multiple services can gain access to the same volume by name.
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />
            <Box sx={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                <strong>Read only</strong>
              </Typography>

              <Controller
                control={control}
                name={`services.${serviceIndex}.profile.persistentStorageParam.readOnly`}
                render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-start", marginTop: "1rem" }}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.type`}
              render={({ field }) => (
                <FormControl fullWidth sx={{ flexBasis: "40%" }}>
                  <InputLabel id={`persistent-storage-type-${currentService.id}`}>Type</InputLabel>
                  <Select
                    labelId={`persistent-storage-type-${currentService.id}`}
                    value={field.value || ""}
                    onChange={field.onChange}
                    variant="outlined"
                    size="small"
                    sx={{ width: "100%" }}
                    label="Type"
                    MenuProps={{ disableScrollLock: true }}
                  >
                    {persistentStorageTypes.map(u => (
                      <MenuItem key={u.id} value={u.className}>
                        {u.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.mount`}
              rules={{ required: "Mount is required.", pattern: { value: /^\/.*$/, message: "Mount must be an absolute path." } }}
              render={({ field, fieldState }) => (
                <TextField
                  type="text"
                  variant="outlined"
                  color="secondary"
                  label="Mount"
                  placeholder="Example: /mnt/data"
                  value={field.value}
                  error={!!fieldState.error}
                  onChange={event => field.onChange(event.target.value)}
                  size="small"
                  sx={{ width: "100%", marginLeft: ".5rem" }}
                  helperText={!!fieldState.error && fieldState.error.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip
                          arrow
                          title={
                            <>
                              The path to mount the persistent volume to.
                              <br />
                              <br />
                              Example: /mnt/data
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />
          </Box>
        </div>
      )}
    </FormPaper>
  );
};
