import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Button, IconButton, Paper, TextField, Typography, useTheme } from "@mui/material";
import { SdlBuilderFormValues, SignedBy } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  signedByAnyOf: SignedBy[];
  signedByAllOf: SignedBy[];
};

export type SignedByRefType = {
  _removeSignedByAnyOf: (index: number | number[]) => void;
  _removeSignedByAllOf: (index: number | number[]) => void;
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

export const SignedByFormControl = forwardRef<SignedByRefType, Props>(
  ({ control, serviceIndex, signedByAnyOf: _signedByAnyOf = [], signedByAllOf: _signedByAllOf = [] }, ref) => {
    const { classes } = useStyles();
    const theme = useTheme();
    const {
      fields: signedByAnyOf,
      remove: removeAnyOf,
      append: appendAnyOf
    } = useFieldArray({
      control,
      name: `services.${serviceIndex}.placement.signedBy.anyOf`,
      keyName: "id"
    });
    const {
      fields: signedByAllOf,
      remove: removeAllOf,
      append: appendAllOf
    } = useFieldArray({
      control,
      name: `services.${serviceIndex}.placement.signedBy.allOf`,
      keyName: "id"
    });

    const onAddSignedAnyOf = () => {
      appendAnyOf({ id: nanoid(), value: "" });
    };

    const onAddSignedAllOf = () => {
      appendAllOf({ id: nanoid(), value: "" });
    };

    useImperativeHandle(ref, () => ({
      _removeSignedByAnyOf(index: number | number[]) {
        removeAnyOf(index);
      },
      _removeSignedByAllOf(index: number | number[]) {
        removeAllOf(index);
      }
    }));

    return (
      <Paper elevation={1} className={classes.root}>
        <div>
          <Box sx={{ marginBottom: "1rem", display: "flex", alignItems: "center" }}>
            <Typography variant="body2">
              <strong>Signed By</strong>
            </Typography>

            <CustomTooltip
              arrow
              title={
                <>
                  This will filter bids based on which address (auditor) audited the provider.
                  <br />
                  <br />
                  This allows for requiring a third-party certification of any provider that you deploy to.
                  <br />
                  <br />
                  <a href="https://docs.akash.network/readme/stack-definition-language#profiles.placement.signedby" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
            </CustomTooltip>
          </Box>

          <Box sx={{ marginBottom: _signedByAnyOf.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="caption">
                <strong>Any of</strong>
              </Typography>
              <CustomTooltip arrow title={<>Filter providers that have been audited by ANY of these accounts.</>}>
                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
              </CustomTooltip>
            </Box>

            <Button color="secondary" variant="contained" size="small" onClick={onAddSignedAnyOf}>
              Add Any Of
            </Button>
          </Box>

          {signedByAnyOf.length > 0 ? (
            signedByAnyOf.map((anyOf, anyOfIndex) => {
              return (
                <Box key={anyOf.id} sx={{ marginBottom: anyOfIndex + 1 === _signedByAnyOf.length ? "1rem" : ".5rem" }}>
                  <Box sx={{ display: "flex" }}>
                    <Box sx={{ flexGrow: 1 }}>
                      {/** TODO Add list of auditors */}
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.signedBy.anyOf.${anyOfIndex}.value`}
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

                    <Box sx={{ paddingLeft: ".5rem" }}>
                      <IconButton onClick={() => removeAnyOf(anyOfIndex)} size="small">
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

          <Box sx={{ marginBottom: _signedByAllOf.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="caption">
                <strong>All of</strong>
              </Typography>
              <CustomTooltip arrow title={<>Filter providers that have been audited by ALL of these accounts.</>}>
                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
              </CustomTooltip>
            </Box>

            <Button color="secondary" variant="contained" size="small" onClick={onAddSignedAllOf}>
              Add All Of
            </Button>
          </Box>

          {signedByAllOf.length > 0 ? (
            signedByAllOf.map((allOf, allOfIndex) => {
              return (
                <Box key={allOf.id} sx={{ marginBottom: allOfIndex + 1 === _signedByAllOf.length ? 0 : ".5rem" }}>
                  <Box sx={{ display: "flex" }}>
                    <Box sx={{ flexGrow: 1 }}>
                      {/** TODO Add list of auditors */}
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.signedBy.allOf.${allOfIndex}.value`}
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

                    <Box sx={{ paddingLeft: ".5rem" }}>
                      <IconButton onClick={() => removeAllOf(allOfIndex)} size="small">
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
  }
);
