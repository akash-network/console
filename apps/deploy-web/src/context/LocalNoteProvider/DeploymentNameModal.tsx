"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormInput, Popup, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { updateDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";

const formSchema = z.object({
  name: z.string()
});

type Props = {
  dseq: string | number | null | undefined;
  onClose: () => void;
  onSaved: () => void;
  getDeploymentName: (dseq: string | number | null) => string | null;
};

export const DeploymentNameModal: React.FC<Props> = ({ dseq, onClose, onSaved, getDeploymentName }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      name: ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, setValue } = form;

  useEffect(() => {
    if (dseq) {
      const name = getDeploymentName(dseq);
      setValue("name", name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dseq, getDeploymentName]);

  const onSaveClick = (event: React.MouseEvent) => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  function onSubmit({ name }: z.infer<typeof formSchema>) {
    updateDeploymentLocalData(String(dseq), { name: name });

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
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <FormField
            control={control}
            name="name"
            render={({ field }) => {
              return <FormInput {...field} label="Name" autoFocus type="text" />;
            }}
          />
        </form>
      </Form>
    </Popup>
  );
};
