import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Button, IconButton, Paper, TextField, Typography, useTheme } from "@mui/material";
import { PlacementAttribute, SdlBuilderFormValues } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  attributes: PlacementAttribute[];
};

export type AttributesRefType = {
  _removeAttribute: (index: number | number[]) => void;
};

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: "1rem",
    padding: "1rem",
    paddingBottom: 0,
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
  },
  none: {
    fontSize: ".7rem",
    color: theme.palette.grey[500],
    marginBottom: ".5rem"
  }
}));

export const AttributesFormControl = forwardRef<AttributesRefType, Props>(({ control, serviceIndex, attributes: _attributes = [] }, ref) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const {
    fields: attributes,
    remove: removeAttribute,
    append: appendAttribute
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.placement.attributes`,
    keyName: "id"
  });

  const onAddAttribute = () => {
    appendAttribute({ id: nanoid(), key: "", value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeAttribute(index: number | number[]) {
      removeAttribute(index);
    }
  }));

  return (
    <Paper elevation={1} className={classes.root}>
      <div>
        <Box sx={{ marginBottom: _attributes.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="caption">
              <strong>Attributes</strong>
            </Typography>
            <CustomTooltip arrow title={<>Filter providers that have these attributes.</>}>
              <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
            </CustomTooltip>
          </Box>

          <Button color="secondary" variant="contained" size="small" onClick={onAddAttribute}>
            Add Attribute
          </Button>
        </Box>

        {attributes.length > 0 ? (
          attributes.map((att, attIndex) => {
            return (
              <Box key={att.id} sx={{ marginBottom: attIndex + 1 === _attributes.length ? 0 : ".5rem" }}>
                <Box sx={{ display: "flex" }}>
                  <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
                    {/** TODO All list of attribute keys and values from pre-defined provider attributes */}
                    <Box>
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.attributes.${attIndex}.key`}
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
                    </Box>

                    <Box sx={{ marginLeft: ".5rem" }}>
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.attributes.${attIndex}.value`}
                        render={({ field }) => (
                          <TextField
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
                  </Box>

                  <Box sx={{ paddingLeft: ".5rem" }}>
                    <IconButton onClick={() => removeAttribute(attIndex)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            );
          })
        ) : (
          <div className={classes.none}>None</div>
        )}
      </div>
    </Paper>
  );
});
