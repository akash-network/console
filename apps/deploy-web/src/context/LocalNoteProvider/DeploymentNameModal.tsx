"use client";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSnackbar } from "notistack";

import { Popup } from "@src/components/shared/Popup";
import { Snackbar } from "@src/components/shared/Snackbar";
import { InputWithIcon } from "@src/components/ui/input";
import { updateDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";

export const DeploymentNameModal = ({ dseq, onClose, onSaved, getDeploymentName }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
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
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  function onSubmit({ name }) {
    updateDeploymentLocalData(dseq, { name: name });

    enqueueSnackbar(<Snackbar title="Success!" iconVariant="success" />, { variant: "success", autoHideDuration: 1000 });

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
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => {
            return <InputWithIcon {...field} label="Name" autoFocus type="text" />;
          }}
        />
      </form>
    </Popup>
  );
};
