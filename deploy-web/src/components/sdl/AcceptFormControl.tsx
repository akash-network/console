import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Button, IconButton, Paper, TextField, Typography, useTheme } from "@mui/material";
import { Accept, SdlBuilderFormValues } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  accept: Accept[];
};

export type AcceptRefType = {
  _removeAccept: (index: number | number[]) => void;
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

export const AcceptFormControl = forwardRef<AcceptRefType, Props>(({ control, serviceIndex, exposeIndex, accept: _accept }, ref) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const {
    fields: accept,
    remove: removeAccept,
    append: appendAccept
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose.${exposeIndex}.accept`,
    keyName: "id"
  });

  const onAddAccept = () => {
    appendAccept({ id: nanoid(), value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeAccept(index: number | number[]) {
      removeAccept(index);
    }
  }));

  return (
    <Paper elevation={1} className={classes.root}>
      <div>
        <Box sx={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <Typography variant="body2">
            <strong>Accept</strong>
          </Typography>

          <CustomTooltip arrow title={<>List of hosts/domains to accept connections for.</>}>
            <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
          </CustomTooltip>
        </Box>

        {accept.map((acc, accIndex) => {
          return (
            <Box key={acc.id} sx={{ marginBottom: accIndex + 1 === accept.length ? 0 : ".5rem" }}>
              <Box sx={{ display: "flex" }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${exposeIndex}.accept.${accIndex}.value`}
                    render={({ field }) => (
                      <TextField
                        type="text"
                        variant="outlined"
                        label="Value"
                        color="secondary"
                        placeholder="example.com"
                        fullWidth
                        value={field.value}
                        size="small"
                        onChange={event => field.onChange(event.target.value)}
                      />
                    )}
                  />
                </Box>

                <Box sx={{ paddingLeft: ".5rem" }}>
                  <IconButton onClick={() => removeAccept(accIndex)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </div>

      <Box sx={{ marginTop: _accept && _accept.length > 0 ? "1rem" : 0, diplay: "flex", alignItems: "center" }}>
        <Button color="secondary" variant="contained" size="small" onClick={onAddAccept}>
          Add Accept
        </Button>
      </Box>
    </Paper>
  );
});
