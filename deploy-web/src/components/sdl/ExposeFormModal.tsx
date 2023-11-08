import { ReactNode, useRef } from "react";
import { Popup } from "../shared/Popup";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Checkbox, FormControlLabel, Grid, IconButton, InputAdornment, MenuItem, Select, TextField } from "@mui/material";
import { Expose, SdlBuilderFormValues, Service } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { AcceptFormControl, AcceptRefType } from "./AcceptFormControl";
import { nanoid } from "nanoid";
import { ToFormControl, ToRefType } from "./ToFormControl";
import { protoTypes } from "@src/utils/sdl/data";
import { FormPaper } from "./FormPaper";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { endpointNameValidationRegex } from "@src/utils/deploymentData/v1beta3";
import { HttpOptionsFormControl } from "./HttpOptionsFormControl";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  services: Service[];
  expose: Expose[];
  providerAttributesSchema: ProviderAttributesSchema;
};

export const ExposeFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, onClose, expose: _expose, services, providerAttributesSchema }) => {
  const acceptRef = useRef<AcceptRefType>();
  const toRef = useRef<ToRefType>();
  const {
    fields: expose,
    remove: removeExpose,
    append: appendExpose
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose`,
    keyName: "id"
  });

  const onAddExpose = () => {
    appendExpose({ id: nanoid(), port: 80, as: 80, global: true });
  };

  const _onClose = () => {
    const acceptToRemove = [];
    const toToRemove = [];

    _expose.forEach((e, i) => {
      e.accept.forEach((a, ii) => {
        if (!a.value.trim()) {
          acceptToRemove.push(ii);
        }
      });

      e.to.forEach((a, ii) => {
        if (!a.value.trim()) {
          toToRemove.push(ii);
        }
      });
    });

    acceptRef.current?._removeAccept(acceptToRemove);
    toRef.current?._removeTo(toToRemove);

    onClose();
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title={
        <Box component="span" sx={{ display: "flex", alignItems: "center" }}>
          Edit Port Expose
          <CustomTooltip
            arrow
            title={
              <>
                Expose is a list of settings describing what can connect to the service.
                <br />
                <br />
                Map container ports to exposed http/https/tcp ports.
                <br />
                <br />
                <a href="https://docs.akash.network/readme/stack-definition-language#services.expose" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>
            }
          >
            <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
          </CustomTooltip>
        </Box>
      }
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: _onClose
        },
        {
          label: "Add Expose",
          color: "secondary",
          variant: "contained",
          side: "right",
          onClick: onAddExpose
        }
      ]}
      onClose={_onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      {expose.map((exp, expIndex) => {
        const currentExpose = _expose[expIndex];

        return (
          <FormPaper
            key={exp.id}
            elevation={2}
            sx={{
              display: "flex",
              padding: "1rem",
              marginBottom: expIndex + 1 === expose.length ? 0 : "1rem",
              paddingBottom: "2rem"
            }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.port`}
                    rules={{ pattern: { value: /^[1-9]d*$/, message: "Port numbers don't allow decimals." } }}
                    render={({ field, fieldState }) => (
                      <TextField
                        type="number"
                        variant="outlined"
                        label="Port"
                        color="secondary"
                        fullWidth
                        value={field.value}
                        error={!!fieldState.error}
                        size="small"
                        onChange={event => field.onChange(parseInt(event.target.value))}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <CustomTooltip arrow title={<>Container port to expose.</>}>
                                <InfoIcon color="disabled" fontSize="small" />
                              </CustomTooltip>
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.as`}
                    rules={{ pattern: { value: /^[1-9]d*$/, message: "Port numbers don't allow decimals." } }}
                    render={({ field, fieldState }) => (
                      <TextField
                        type="number"
                        variant="outlined"
                        label="As"
                        color="secondary"
                        fullWidth
                        value={field.value}
                        error={!!fieldState.error}
                        size="small"
                        onChange={event => field.onChange(parseInt(event.target.value))}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <CustomTooltip arrow title={<>Port number to expose the container port as.</>}>
                                <InfoIcon color="disabled" fontSize="small" />
                              </CustomTooltip>
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.proto`}
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onChange={field.onChange}
                        variant="outlined"
                        size="small"
                        fullWidth
                        MenuProps={{ disableScrollLock: true }}
                      >
                        {protoTypes.map(t => (
                          <MenuItem key={t.id} value={t.name}>
                            {t.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={3}>
                  <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.expose.${expIndex}.global`}
                      render={({ field }) => (
                        <FormControlLabel
                          labelPlacement="start"
                          sx={{ paddingRight: "1rem" }}
                          componentsProps={{ typography: { variant: "body2" } }}
                          control={
                            <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem", padding: 0 }} />
                          }
                          label="Global"
                        />
                      )}
                    />

                    <CustomTooltip arrow title={<>Check if you want this service to be accessible from outside the datacenter.</>}>
                      <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                    </CustomTooltip>
                  </Box>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ paddingBottom: "1rem" }}>
                <Grid item xs={12} sm={6}>
                  <AcceptFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} ref={acceptRef} accept={currentExpose?.accept} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <ToFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} ref={toRef} services={services} />
                </Grid>
              </Grid>

              <Box sx={{ marginTop: "1rem" }}>
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.expose.${expIndex}.ipName`}
                  rules={{
                    validate: value => {
                      const hasValidChars = endpointNameValidationRegex.test(value);
                      const hasValidStartingChar = /^[a-z]/.test(value);
                      const hasValidEndingChar = !value.endsWith("-");

                      if (!hasValidChars) {
                        return "Invalid ip name. It must only be lower case letters, numbers and dashes.";
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
                      label="IP Name"
                      color="secondary"
                      fullWidth
                      value={field.value}
                      error={!!fieldState.error}
                      size="small"
                      onChange={event => field.onChange(event.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <CustomTooltip
                              arrow
                              title={
                                <>
                                  Optional.
                                  <br />
                                  <br />
                                  Option for Tenants to request publicly routable IP addresses for the services they deploy
                                  <br />
                                  <br />
                                  <a href="https://docs.akash.network/features/ip-leases/ip-leases-features-and-limitations" target="_blank" rel="noopener">
                                    View official documentation.
                                  </a>
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

              <Box sx={{ marginTop: "1rem" }}>
                <HttpOptionsFormControl
                  control={control}
                  serviceIndex={serviceIndex}
                  exposeIndex={expIndex}
                  services={services}
                  providerAttributesSchema={providerAttributesSchema}
                />
              </Box>
            </Box>

            {expIndex !== 0 && (
              <Box sx={{ paddingLeft: ".5rem" }}>
                <IconButton onClick={() => removeExpose(expIndex)} size="small">
                  <DeleteIcon />
                </IconButton>
              </Box>
            )}
          </FormPaper>
        );
      })}
    </Popup>
  );
};
