"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormInput, Popup, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useSnackbar, useQueryClient };

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for this deployment")
});

type Props = {
  dseq: string | number | null | undefined;
  onClose: () => void;
  onSaved: () => void;
  getDeploymentName: (dseq: string | number | null) => string | null;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentNameModal: React.FC<Props> = ({ dseq, onClose, onSaved, getDeploymentName, dependencies: d = DEPENDENCIES }) => {
  const { api, deploymentLocalStorage } = useServices();
  const [address] = useAtom(settingsIdAtom);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { enqueueSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const renameDeployment = api.v1.patchDeployment.useMutation();
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
    if (!dseq) return;

    renameDeployment.mutate(
      { dseq: String(dseq), data: { name } },
      {
        onSuccess: function recordRename() {
          /** The deployments list still resolves names from this browser alone, so the record is kept in step until it reads the api too. */
          deploymentLocalStorage.update(address, dseq, { name });
          queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq: String(dseq) }) });
          enqueueSnackbar(<Snackbar title="Success!" iconVariant="success" />, { variant: "success", autoHideDuration: 1000 });
          onSaved();
        },
        onError: function reportRenameFailure() {
          enqueueSnackbar(<Snackbar title="Couldn't rename this deployment" iconVariant="error" />, { variant: "error" });
        }
      }
    );
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
