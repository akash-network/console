import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useSnackbar } from "notistack";
import { makeStyles } from "tss-react/mui";
import { updateDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { Snackbar } from "@src/components/shared/Snackbar";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, TextField } from "@mui/material";

const useStyles = makeStyles()(theme => ({
  dialogContent: {
    padding: "1rem"
  },
  dialogActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }
}));

export const DeploymentNameModal = ({ dseq, onClose, onSaved, getDeploymentName }) => {
  const { classes } = useStyles();
  const formRef = useRef(null);
  const { enqueueSnackbar } = useSnackbar();
  const { handleSubmit, control, setValue } = useForm({
    defaultValues: {
      name: ""
    }
  });

  useEffect(() => {
    if (dseq) {
      const name = getDeploymentName(dseq);
      setValue("name", name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dseq, getDeploymentName]);

  const onSaveClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  function onSubmit({ name }) {
    updateDeploymentLocalData(dseq, { name: name });

    enqueueSnackbar(<Snackbar title="Success!" iconVariant="success" />, { variant: "success", autoHideDuration: 1000 });

    onSaved();
  }

  return (
    <Dialog open={!!dseq} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Deployment Name {dseq ? `(${dseq})` : ""}</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <FormControl fullWidth>
            <Controller
              control={control}
              name="name"
              render={({ field }) => {
                return <TextField {...field} autoFocus type="text" variant="outlined" label="Name" />;
              }}
            />
          </FormControl>
        </form>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" color="secondary" onClick={onSaveClick}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
