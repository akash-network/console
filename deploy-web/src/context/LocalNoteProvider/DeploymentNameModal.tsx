"use client";
import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { updateDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { useToast } from "@src/components/ui/use-toast";
import { Popup } from "@src/components/shared/Popup";
import { Card, CardContent } from "@src/components/ui/card";
import { Input } from "@src/components/ui/input";
import { FormControl, FormLabel } from "@src/components/ui/form";

export const DeploymentNameModal = ({ dseq, onClose, onSaved, getDeploymentName }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { toast } = useToast();
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
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  function onSubmit({ name }) {
    updateDeploymentLocalData(dseq, { name: name });

    toast({
      title: "Success!",
      variant: "success"
    });
    // enqueueSnackbar(<Snackbar title="Success!" iconVariant="success" />, { variant: "success", autoHideDuration: 1000 });

    onSaved();
  }

  return (
    <Popup
      fullWidth
      open={!!dseq}
      variant="custom"
      title={`Change Deployment Name ${dseq ? `(${dseq})` : ""}`}
      actions={[
        {
          label: "Close",
          color: "secondary",
          variant: "ghost",
          side: "left",
          onClick: onClose
        },
        {
          label: "Save",
          color: "primary",
          variant: "default",
          side: "right",
          onClick: onSaveClick
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
    >
      <Card className="flex p-4">
        <CardContent className="flex-grow">
          <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
            <FormControl>
              <FormLabel>Name</FormLabel>
              <Controller
                control={control}
                name="name"
                render={({ field }) => {
                  return <Input {...field} autoFocus type="text" />;
                }}
              />
            </FormControl>
          </form>
        </CardContent>
      </Card>
    </Popup>
  );

  // return (
  //   <Dialog open={!!dseq} onClose={onClose} maxWidth="xs" fullWidth>
  //     <DialogTitle>Change Deployment Name {dseq ? `(${dseq})` : ""}</DialogTitle>
  //     <DialogContent dividers className={classes.dialogContent}>
  //       <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
  //         <FormControl fullWidth>
  //           <Controller
  //             control={control}
  //             name="name"
  //             render={({ field }) => {
  //               return <TextField {...field} autoFocus type="text" variant="outlined" label="Name" />;
  //             }}
  //           />
  //         </FormControl>
  //       </form>
  //     </DialogContent>
  //     <DialogActions className={classes.dialogActions}>
  //       <Button onClick={onClose}>Close</Button>
  //       <Button variant="contained" color="secondary" onClick={onSaveClick}>
  //         Save
  //       </Button>
  //     </DialogActions>
  //   </Dialog>

  // );
};
