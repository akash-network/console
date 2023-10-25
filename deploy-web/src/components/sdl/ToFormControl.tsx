import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Paper, Select, Typography, useTheme } from "@mui/material";
import { SdlBuilderFormValues, Service } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import InfoIcon from "@mui/icons-material/Info";
import { CustomTooltip } from "../shared/CustomTooltip";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: Service[];
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

export type ToRefType = {
  _removeTo: (index: number | number[]) => void;
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
  }
}));

export const ToFormControl = forwardRef<ToRefType, Props>(({ control, serviceIndex, exposeIndex, services }, ref) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const {
    fields: accept,
    remove: removeTo,
    append: appendTo
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose.${exposeIndex}.to`,
    keyName: "id"
  });
  const currentService = services[serviceIndex];
  const otherServices = services.filter(s => currentService?.id !== s.id);

  const onAddTo = () => {
    appendTo({ id: nanoid(), value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeTo(index: number | number[]) {
      removeTo(index);
    }
  }));

  return (
    <Paper elevation={1} className={classes.root}>
      <div>
        <Box sx={{ display: "flex", alignItems: "center", marginBottom: "1rem", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body2">
              <strong>To</strong>
            </Typography>

            <CustomTooltip
              arrow
              title={
                <>
                  List of entities allowed to connect.
                  <br />
                  <br />
                  If the service is marked as global, it will allow connections from outside the datacenter.
                  <br />
                  <br />
                  <a href="https://docs.akash.network/readme/stack-definition-language#services.expose.to" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
            </CustomTooltip>
          </Box>

          
        </Box>

        {accept.map((acc, accIndex) => {
          return (
            <Box key={acc.id} sx={{ marginBottom: accIndex + 1 === accept.length ? 0 : ".5rem" }}>
              <Box sx={{ display: "flex" }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${exposeIndex}.to.${accIndex}.value`}
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onChange={field.onChange}
                        variant="outlined"
                        size="small"
                        fullWidth
                        MenuProps={{ disableScrollLock: true }}
                      >
                        {otherServices.map(t => (
                          <MenuItem key={t.id} value={t.title}>
                            {t.title}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </Box>

                <Box sx={{ paddingLeft: ".5rem" }}>
                  <IconButton onClick={() => removeTo(accIndex)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}

        {otherServices.length === 0 && (
          <Typography variant="caption" sx={{ color: theme.palette.grey[500] }}>
            There's no other service to expose to.
          </Typography>
        )}
      </div>

      <Box sx={{ diplay: "flex", alignItems: "center" }}>
        <Button color="secondary" variant="contained" size="small" onClick={onAddTo} disabled={otherServices.length === 0}>
          Add To
        </Button>
      </Box>
    </Paper>
  );
});
