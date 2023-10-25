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
import { EnvVarList } from "./EnvVarList";
import { CommandList } from "./CommandList";
import { ExposeList } from "./ExposeList";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { PersistentStorage } from "./PersistentStorage";

type Props = {
  providerAttributesSchema: ProviderAttributesSchema;
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

export const AdvancedConfig = forwardRef<AdvancedConfigRefType, Props>(({ control, currentService, providerAttributesSchema }, ref) => {
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
      <CommandFormModal control={control as any} onClose={() => setIsEditingCommands(null)} open={isEditingCommands} serviceIndex={0} />
      {/** Edit Expose */}
      <ExposeFormModal
        control={control as any}
        onClose={() => setIsEditingExpose(null)}
        open={isEditingExpose}
        serviceIndex={0}
        expose={currentService.expose}
        services={[currentService]}
        providerAttributesSchema={providerAttributesSchema}
      />

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
          <Box sx={{ marginBottom: "1rem" }}>
            <PersistentStorage control={control as any} currentService={currentService} serviceIndex={0} />
          </Box>

          <Box sx={{ marginBottom: "1rem" }}>
            <ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} />
          </Box>
          <Box sx={{ marginBottom: "1rem" }}>
            <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} />
          </Box>
          <Box sx={{ marginBottom: "1rem" }}>
            <CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} />
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
});
