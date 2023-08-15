import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Popup } from "../shared/Popup";
import { Control, Controller } from "react-hook-form";
import { Box, InputLabel, Paper, TextareaAutosize, TextField, useTheme } from "@mui/material";
import { SdlBuilderFormValues } from "@src/types";

type Props = {
  open: boolean;
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
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

export const CommandFormModal: React.FunctionComponent<Props> = ({ open, control, serviceIndex, onClose }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title="Edit Commands"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "right",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <Paper elevation={2} sx={{ display: "flex", padding: "1rem" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Controller
            control={control}
            name={`services.${serviceIndex}.command.command`}
            render={({ field }) => (
              <TextField
                type="text"
                variant="outlined"
                label="Command"
                color="secondary"
                fullWidth
                value={field.value}
                placeholder="Example: bash -c"
                size="small"
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />

          <Controller
            control={control}
            name={`services.${serviceIndex}.command.arg`}
            render={({ field }) => (
              <Box sx={{ marginTop: ".5rem" }}>
                <InputLabel sx={{ marginBottom: ".2rem", fontSize: ".8rem" }}>Arguments</InputLabel>
                <TextareaAutosize
                  aria-label="Args"
                  minRows={4}
                  placeholder="Example: apt-get update; apt-get install -y --no-install-recommends -- ssh;"
                  style={{ width: "100%", padding: ".5rem 1rem", fontFamily: "inherit", fontSize: ".8rem" }}
                  value={field.value}
                  spellCheck={false}
                  onChange={field.onChange}
                />
              </Box>
            )}
          />
        </Box>
      </Paper>
    </Popup>
  );
};
