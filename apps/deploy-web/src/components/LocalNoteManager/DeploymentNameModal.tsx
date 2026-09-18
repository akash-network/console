"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormInput, Popup, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import { settingsIdAtom } from "@src/store/settingsStore";

export const DEPENDENCIES = { useSnackbar, useQueryClient, useResolvedDeploymentName };

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for this deployment").max(MAX_DEPLOYMENT_NAME_LENGTH, `Use at most ${MAX_DEPLOYMENT_NAME_LENGTH} characters`)
});

type Props = {
  dseq: string | number | null | undefined;
  onClose: () => void;
  onSaved: (dseq: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentNameModal: React.FC<Props> = ({ dseq, onClose, onSaved, dependencies: d = DEPENDENCIES }) => {
  const { api, deploymentNameBackfill } = useServices();
  const formRef = useRef<HTMLFormElement | null>(null);
  const { enqueueSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const resolvedName = d.useResolvedDeploymentName(dseq ? String(dseq) : null);
  /** Read from the store rather than `useWallet`, since this dialog mounts outside the wallet provider and would resolve no address there at all. */
  const owner = useAtomValue(settingsIdAtom);
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
  /** `isPending` only turns true once the mutation starts, leaving a resubmit free to pass while the backfill being preempted is still settling. */
  const isRenamingRef = useRef(false);

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

  async function onSubmit({ name }: z.infer<typeof formSchema>) {
    if (!dseq || isRenamingRef.current || renameDeployment.isPending) return;

    isRenamingRef.current = true;
    const renamedDseq = String(dseq);

    if (owner) await deploymentNameBackfill.preempt(owner, renamedDseq);

    renameDeployment.mutate(
      { dseq: renamedDseq, data: { name } },
      {
        onSuccess: function reportRenameSaved() {
          queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq: renamedDseq }) });
          queryClient.invalidateQueries({ queryKey: api.v1.listDeploymentNames.getKey() });
          queryClient.invalidateQueries({ queryKey: api.v1.listDeployments.getKey() });
          enqueueSnackbar(<Snackbar title="Success!" iconVariant="success" />, { variant: "success", autoHideDuration: 1000 });
          onSaved(renamedDseq);
        },
        onError: function reportRenameFailure() {
          enqueueSnackbar(<Snackbar title="Couldn't rename this deployment" iconVariant="error" />, { variant: "error" });
        },
        onSettled: function allowAnotherRename() {
          isRenamingRef.current = false;
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
          disabled: renameDeployment.isPending || formState.isSubmitting,
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
