import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller } from "react-hook-form";
import { Box, Checkbox, FormControlLabel, InputAdornment, MenuItem, Paper, Select, TextField, Typography, useTheme } from "@mui/material";
import { SdlBuilderFormValues, Service } from "@src/types";
import InfoIcon from "@mui/icons-material/Info";
import { CustomTooltip } from "../shared/CustomTooltip";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { nextCases } from "@src/utils/sdl/data";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: Service[];
  control: Control<SdlBuilderFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: "1rem",
    padding: "1rem",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.grey[300]
  },
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const HttpOptionsFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, exposeIndex, services, providerAttributesSchema }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const currentService = services[serviceIndex];

  return (
    <Paper elevation={1} className={classes.root}>
      <div>
        <Box sx={{ display: "flex", alignItems: "center", marginBottom: currentService.expose[exposeIndex]?.hasCustomHttpOptions ? "2rem" : 0 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body2">
              <strong>HTTP Options</strong>
            </Typography>

            <CustomTooltip
              arrow
              title={
                <>
                  Akash deployment SDL services stanza definitions have been augmented to include “http_options” allowing granular specification of HTTP
                  endpoint parameters. Inclusion of the parameters in this section are optional but will afford detailed definitions of attributes such as
                  body/payload max size where necessary.
                  <br />
                  <br />
                  <a href="https://docs.akash.network/features/deployment-http-options" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
            </CustomTooltip>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", marginLeft: "2rem" }}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.hasCustomHttpOptions`}
              render={({ field }) => (
                <FormControlLabel
                  labelPlacement="end"
                  componentsProps={{ typography: { variant: "body2" } }}
                  control={
                    <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginRight: ".5rem", padding: 0 }} />
                  }
                  label="Custom Options"
                />
              )}
            />
          </Box>
        </Box>

        {currentService.expose[exposeIndex].hasCustomHttpOptions && (
          <>
            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.maxBodySize`}
              render={({ field, fieldState }) => (
                <TextField
                  type="number"
                  variant="outlined"
                  label="Max Body Size"
                  color="secondary"
                  fullWidth
                  value={field.value}
                  error={!!fieldState.error}
                  className={classes.formControl}
                  size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip arrow title="Sets the maximum size of an individual HTTP request body.">
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.readTimeout`}
              render={({ field, fieldState }) => (
                <TextField
                  type="number"
                  variant="outlined"
                  label="Read Timeout"
                  color="secondary"
                  fullWidth
                  value={field.value}
                  error={!!fieldState.error}
                  className={classes.formControl}
                  size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip arrow title="Duration the proxy will wait for a response from the service.">
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.sendTimeout`}
              render={({ field, fieldState }) => (
                <TextField
                  type="number"
                  variant="outlined"
                  label="Send Timeout"
                  color="secondary"
                  fullWidth
                  value={field.value}
                  error={!!fieldState.error}
                  className={classes.formControl}
                  size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip arrow title="Duration the proxy will wait for the service to accept a request.">
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTries`}
              render={({ field, fieldState }) => (
                <TextField
                  type="number"
                  variant="outlined"
                  label="Next Tries"
                  color="secondary"
                  fullWidth
                  value={field.value}
                  error={!!fieldState.error}
                  className={classes.formControl}
                  size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip arrow title="Number of attempts the proxy will attempt another replica.">
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTimeout`}
              render={({ field, fieldState }) => (
                <TextField
                  type="number"
                  variant="outlined"
                  label="Next Timeout"
                  color="secondary"
                  fullWidth
                  value={field.value}
                  error={!!fieldState.error}
                  className={classes.formControl}
                  size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <CustomTooltip arrow title="Duration the proxy will wait for the service to connect to another replica.">
                          <InfoIcon color="disabled" fontSize="small" />
                        </CustomTooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextCases`}
              defaultValue={[]}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onChange={field.onChange}
                  variant="outlined"
                  size="small"
                  fullWidth
                  multiple
                  MenuProps={{ disableScrollLock: true }}
                >
                  {nextCases.map(u => (
                    <MenuItem key={u.id} value={u.value}>
                      {u.value}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </>
        )}
      </div>
    </Paper>
  );
};
