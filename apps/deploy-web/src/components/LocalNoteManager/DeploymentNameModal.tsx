"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormInput, Popup, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useSnackbar, useQueryClient, useResolvedDeploymentName };

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for this deployment")
    .max(MAX_DEPLOYMENT_NAME_LENGTH, `Use at most ${MAX_DEPLOYMENT_NAME_LENGTH} characters`)
});

type Props = {
  dseq: string | number | null | undefined;
  onClose: () => void;
  onSaved: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentNameModal: React.FC<Props> = ({ dseq, onClose, onSaved, dependencies: d = DEPENDENCIES }) => {
  const { api, deploymentLocalStorage } = useServices();
  const [address] = useAtom(settingsIdAtom);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { enqueueSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const resolvedName = d.useResolvedDeploymentName(dseq ? String(dseq) : null);
  const renameDeployment = api.v1.patchDeployment.useMutation();
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      name: ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, reset, formState } = form;
  const isEdited = formState.isDirty;
  /** One modal instance serves every deployment, so a name typed for one must never be carried into another's field. */
  const seededDseqRef = useRef<string | null>(null);

  useEffect(
    function seedFromTheNameOnShow() {
      if (!dseq) {
        seededDseqRef.current = null;
        return;
      }

      const shown = String(dseq);
      if (seededDseqRef.current !== shown || !isEdited) {
        seededDseqRef.current = shown;
        reset({ name: resolvedName ?? "" });
      }
    },
    [dseq, resolvedName, isEdited, reset]
  );

  const onSaveClick = (event: React.MouseEvent) => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  /** The deployments list still resolves names from this browser alone, so the record is kept in step until it reads the api too — and a full or blocked store must not strand a rename the api has already accepted. */
  function recordNameInThisBrowser(name: string) {
    try {
      deploymentLocalStorage.update(address, dseq, { name });
    } catch {
      return;
    }
  }

  function onSubmit({ name }: z.infer<typeof formSchema>) {
    if (!dseq || renameDeployment.isPending) return;

    renameDeployment.mutate(
      { dseq: String(dseq), data: { name } },
      {
        onSuccess: function recordRename() {
          recordNameInThisBrowser(name);
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
          disabled: renameDeployment.isPending,
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
              return <FormInput {...field} label="Name" autoFocus type="text" maxLength={MAX_DEPLOYMENT_NAME_LENGTH} />;
            }}
          />
        </form>
      </Form>
    </Popup>
  );
};
