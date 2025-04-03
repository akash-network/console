import { useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import type { ActionButton } from "@akashnetwork/ui/components";
import { Button, Form, FormField, FormInput, Input, Popup, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { useCreateApiKey } from "@src/queries";
import { analyticsService } from "@src/services/analytics/analytics.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required."
    })
    .max(40, {
      message: "Name must be less than 40 characters."
    })
});

export const CreateApiKeyModal = ({ isOpen, onClose }: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { mutate: createApiKey, data: createdApiKey, isPending } = useCreateApiKey();
  const formRef = useRef<HTMLFormElement | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      name: ""
    },
    resolver: zodResolver(formSchema)
  });
  const {
    handleSubmit,
    control,
    formState: { errors }
  } = form;
  const isCreatingNewKey = !createdApiKey;
  const apiKey = createdApiKey?.apiKey || "";
  const actions: ActionButton[] = useMemo(
    () =>
      isCreatingNewKey
        ? [
            {
              label: "Cancel",
              color: "primary",
              variant: "secondary",
              side: "left",
              onClick: onClose
            },
            {
              label: "Create Key",
              color: "secondary",
              variant: "default",
              side: "right",
              disabled: !!errors.name || isPending,
              isLoading: isPending,
              onClick: event => {
                event.preventDefault();
                formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
              }
            }
          ]
        : [
            {
              label: "Done",
              color: "primary",
              variant: "secondary",
              side: "right",
              onClick: onClose
            }
          ],
    [isCreatingNewKey, isPending, errors.name, onClose]
  );

  const onCopyClick = () => {
    copyTextToClipboard(apiKey);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  const createApiKeyTracked = async ({ name }: { name: string }) => {
    analyticsService.track("create_api_key", {
      category: "settings",
      label: "Create API key"
    });

    createApiKey(name);
  };

  return (
    <Popup
      fullWidth
      open={isOpen}
      variant="custom"
      title={isCreatingNewKey ? "Create new secret key" : "Save your key"}
      actions={actions}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      {isCreatingNewKey ? (
        <Form {...form}>
          <form onSubmit={handleSubmit(createApiKeyTracked)} ref={formRef}>
            <div className="py-4">
              <FormField
                control={control}
                name="name"
                render={({ field }) => {
                  return <FormInput {...field} type="text" label="Name" autoFocus placeholder="My Test Key" />;
                }}
              />
            </div>
          </form>
        </Form>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            Please save your secret key in a safe place since <b>you won't be able to view it again.</b> Keep it secure, as anyone with your API key can make
            requests on your behalf. If you lose it, you'll need to create a new one.
          </p>

          <div className="mb-2 mt-8 flex w-full items-center gap-2">
            <Input type="text" value={apiKey} className="flex-grow" autoFocus onFocus={event => event.target.select()} readOnly />
            <Button variant="default" size="sm" onClick={onCopyClick}>
              Copy
            </Button>
          </div>
        </div>
      )}
    </Popup>
  );
};
