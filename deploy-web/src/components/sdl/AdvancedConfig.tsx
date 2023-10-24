import { ReactNode, useImperativeHandle, forwardRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Box, Button, Collapse, IconButton, Paper, TextField, Typography, useTheme } from "@mui/material";
import { PlacementAttribute, RentGpusFormValues, Service } from "@src/types";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { ExpandMore } from "../shared/ExpandMore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { EnvFormModal } from "./EnvFormModal";
import { CommandFormModal } from "./CommandFormModal";
import { ExposeFormModal } from "./ExposeFormModal";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  control: Control<RentGpusFormValues, any>;
  children?: ReactNode;
};

export type AdvancedConfigRefType = {
  // _removeAttribute: (index: number | number[]) => void;
};

const useStyles = makeStyles()(theme => ({
  editLink: {
    color: theme.palette.secondary.light,
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: "normal",
    fontSize: ".8rem"
  },
  formValue: {
    color: theme.palette.grey[500]
  }
}));

export const AdvancedConfig = forwardRef<AdvancedConfigRefType, Props>(({ control, currentService }, ref) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [expanded, setIsAdvancedOpen] = useState(false);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [isEditingExpose, setIsEditingExpose] = useState(false);
  // const {
  //   fields: attributes,
  //   remove: removeAttribute,
  //   append: appendAttribute
  // } = useFieldArray({
  //   control,
  //   name: `services.${serviceIndex}.placement.attributes`,
  //   keyName: "id"
  // });

  // const onAddAttribute = () => {
  //   appendAttribute({ id: nanoid(), key: "", value: "" });
  // };

  useImperativeHandle(ref, () => ({
    // _removeAttribute(index: number | number[]) {
    //   removeAttribute(index);
    // }
  }));

  return (
    <Paper elevation={2} sx={{ marginTop: "1rem" }}>
      {/** Edit Environment Variables */}
      <EnvFormModal control={control as any} onClose={() => setIsEditingEnv(null)} open={isEditingEnv} serviceIndex={0} envs={currentService.env} />
      {/** Edit Commands */}
      {/* <CommandFormModal control={control} onClose={() => setIsEditingCommands(null)} open={isEditingCommands} serviceIndex={serviceIndex} /> */}
      {/** Edit Expose */}
      {/* <ExposeFormModal
        control={control}
        onClose={() => setIsEditingExpose(null)}
        open={isEditingExpose}
        serviceIndex={serviceIndex}
        expose={currentService.expose}
        services={_services}
        providerAttributesSchema={providerAttributesSchema}
      /> */}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: ".5rem 1rem",
          borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "none"
        }}
      >
        <Box>
          <Typography variant="body2">Advanced Configuration</Typography>
        </Box>

        <ExpandMore
          expand={expanded}
          onClick={() => setIsAdvancedOpen(prev => !prev)}
          aria-expanded={expanded}
          aria-label="show more"
          sx={{ marginLeft: ".5rem" }}
        >
          <ExpandMoreIcon />
        </ExpandMore>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ padding: "1rem" }}>
          <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
              <Typography variant="body1">
                <strong>Environment Variables</strong>
              </Typography>

              <CustomTooltip
                arrow
                title={
                  <>
                    A list of environment variables to expose to the running container.
                    <br />
                    <br />
                    <a href="https://docs.akash.network/readme/stack-definition-language#services.env" target="_blank" rel="noopener">
                      View official documentation.
                    </a>
                  </>
                }
              >
                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
              </CustomTooltip>

              <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingEnv(true)}>
                Edit
              </Box>
            </Box>

            {currentService.env.length > 0 ? (
              currentService.env.map((e, i) => (
                <Box key={i} sx={{ fontSize: ".75rem" }}>
                  <div>
                    {e.key}=
                    <Box component="span" className={classes.formValue}>
                      {e.value}
                    </Box>
                  </div>
                </Box>
              ))
            ) : (
              <Typography variant="caption" color="darkgray">
                None
              </Typography>
            )}
          </FormPaper>
        </Box>
      </Collapse>
    </Paper>
  );
});
