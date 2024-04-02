import { ReactNode, useState } from "react";
import { Control } from "react-hook-form";
import { RentGpusFormValues, Service } from "@src/types";
import { ExpandMore } from "../shared/ExpandMore";
import { EnvFormModal } from "./EnvFormModal";
import { CommandFormModal } from "./CommandFormModal";
import { ExposeFormModal } from "./ExposeFormModal";
import { EnvVarList } from "./EnvVarList";
import { CommandList } from "./CommandList";
import { ExposeList } from "./ExposeList";
import { PersistentStorage } from "./PersistentStorage";

type Props = {
  currentService: Service;
  control: Control<RentGpusFormValues, any>;
  children?: ReactNode;
};

export const AdvancedConfig: React.FunctionComponent<Props> = ({ control, currentService }) => {
  const theme = useTheme();
  const [expanded, setIsAdvancedOpen] = useState(false);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [isEditingExpose, setIsEditingExpose] = useState(false);

  return (
    <Paper elevation={2} sx={{ marginTop: "1rem" }}>
      {/** Edit Environment Variables */}
      {isEditingEnv && (
        <EnvFormModal control={control as any} onClose={() => setIsEditingEnv(null)} serviceIndex={0} envs={currentService.env} hasSecretOption={false} />
      )}
      {/** Edit Commands */}
      {isEditingCommands && <CommandFormModal control={control as any} onClose={() => setIsEditingCommands(null)} serviceIndex={0} />}
      {/** Edit Expose */}
      {isEditingExpose && (
        <ExposeFormModal
          control={control as any}
          onClose={() => setIsEditingExpose(null)}
          serviceIndex={0}
          expose={currentService.expose}
          services={[currentService]}
        />
      )}

      <Button
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
          borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "none",
          textTransform: "none"
        }}
        fullWidth
        onClick={() => setIsAdvancedOpen(prev => !prev)}
      >
        <Box>
          <Typography variant="body2">Advanced Configuration</Typography>
        </Box>

        <ExpandMore expand={expanded} aria-expanded={expanded} aria-label="show more" sx={{ marginLeft: ".5rem" }} />
      </Button>
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
};
