import { ReactNode, useEffect } from "react";
import { makeStyles } from "tss-react/mui";
import { Popup } from "../shared/Popup";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, IconButton, Paper, Switch, TextField, Typography, useTheme } from "@mui/material";
import { EnvironmentVariable, RentGpusFormValues, SdlBuilderFormValues } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariable[];
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const EnvFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, envs: _envs, onClose, hasSecretOption = true }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });

  useEffect(() => {
    if (open && _envs.length === 0) {
      onAddEnv();
    }
  }, [open, _envs]);

  const onAddEnv = () => {
    appendEnv({ id: nanoid(), key: "", value: "", isSecret: false });
  };

  const _onClose = () => {
    const _envToRemove = [];

    _envs.forEach((e, i) => {
      if (!e.key.trim()) {
        _envToRemove.push(i);
      }
    });

    removeEnv(_envToRemove);

    onClose();
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Edit Environment Variables"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: _onClose
        },
        {
          label: "Add Variable",
          color: "secondary",
          variant: "contained",
          side: "right",
          onClick: onAddEnv
        }
      ]}
      onClose={_onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <Box sx={{ paddingTop: "1rem" }}>
        {envs.map((env, envIndex) => {
          return (
            <Paper key={env.id} elevation={2} sx={{ display: "flex", marginBottom: envIndex + 1 === envs.length ? 0 : ".5rem" }}>
              <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", flexDirection: { xs: "column", sm: "row" } }}>
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.env.${envIndex}.key`}
                  render={({ field }) => (
                    <TextField
                      type="text"
                      variant="outlined"
                      label="Key"
                      color="secondary"
                      fullWidth
                      value={field.value}
                      size="small"
                      onChange={event => field.onChange(event.target.value)}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.env.${envIndex}.value`}
                  render={({ field }) => (
                    <TextField
                      sx={{ marginLeft: ".5rem" }}
                      type="text"
                      variant="outlined"
                      label="Value"
                      color="secondary"
                      fullWidth
                      value={field.value}
                      size="small"
                      onChange={event => field.onChange(event.target.value)}
                    />
                  )}
                />
              </Box>

              <Box
                sx={{
                  paddingLeft: ".5rem",
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "column",
                  justifyContent: envIndex > 0 ? "space-around" : "flex-end",
                  width: "45px"
                }}
              >
                {envIndex > 0 && (
                  <IconButton onClick={() => removeEnv(envIndex)} size="small">
                    <DeleteIcon />
                  </IconButton>
                )}

                {hasSecretOption && (
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${envIndex}.isSecret`}
                    render={({ field }) => (
                      <CustomTooltip
                        title={
                          <>
                            <Typography variant="body1">
                              <strong>Secret</strong>
                            </Typography>
                            <Typography variant="body2">
                              This is for secret variables containing sensitive information you don't want to be saved in your template.
                            </Typography>
                          </>
                        }
                      >
                        <Switch checked={field.value || false} onChange={field.onChange} color="secondary" size="small" sx={{ margin: 0 }} />
                      </CustomTooltip>
                    )}
                  />
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Popup>
  );
};
