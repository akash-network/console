"use client";
import type { FC } from "react";
import { useId } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Form,
  FormControl,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  LoadingButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar
} from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, CopyIcon, KeyRoundIcon, TriangleAlertIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { z } from "zod";

import type { ApiKeyLifetimeDays } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { API_KEY_LIFETIMES, DEFAULT_API_KEY_LIFETIME_DAYS, getApiKeyExpiryDate } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { useServices } from "@src/context/ServicesProvider";
import { useCreateApiKey } from "@src/queries/useApiKeysQuery";

export const DEPENDENCIES = {
  useCreateApiKey,
  useSnackbar
};

export const MAX_API_KEY_NAME_LENGTH = 40;

const newApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required." })
    .max(MAX_API_KEY_NAME_LENGTH, { message: `Name must be ${MAX_API_KEY_NAME_LENGTH} characters or fewer.` }),
  lifetimeDays: z.custom<ApiKeyLifetimeDays>()
});

type NewApiKeyValues = z.infer<typeof newApiKeySchema>;

type Props = {
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const CreateApiKeyDialog: FC<Props> = ({ onClose, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: createApiKey, data: createdApiKey, isPending } = d.useCreateApiKey();
  const isDismissible = !isPending && !createdApiKey?.apiKey;

  const createKey = ({ name, lifetimeDays }: NewApiKeyValues) => {
    analyticsService.track("create_api_key", {
      category: "settings",
      label: "Create API key"
    });

    createApiKey(
      { name, expiresAt: getApiKeyExpiryDate(lifetimeDays, new Date()) },
      {
        onError: () => {
          enqueueSnackbar(<Snackbar title="Couldn't create the API key" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
        }
      }
    );
  };

  const copySecret = async (secret: string) => {
    const isCopied = await copyTextToClipboard(secret);

    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Key copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the key" subTitle="Select it and copy it yourself." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && isDismissible ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[520px]" hideCloseButton={!isDismissible}>
        {createdApiKey?.apiKey ? (
          <ApiKeySecretStep name={createdApiKey.name} secret={createdApiKey.apiKey} onCopy={copySecret} onDone={onClose} />
        ) : (
          <NewApiKeyStep isCreating={isPending} onCreate={createKey} onCancel={onClose} />
        )}
      </DialogV2Content>
    </DialogV2>
  );
};

type NewApiKeyStepProps = {
  isCreating: boolean;
  onCreate: (values: NewApiKeyValues) => void;
  onCancel: () => void;
};

const NewApiKeyStep: FC<NewApiKeyStepProps> = ({ isCreating, onCreate, onCancel }) => {
  const formId = useId();
  const form = useForm<NewApiKeyValues>({
    defaultValues: { name: "", lifetimeDays: DEFAULT_API_KEY_LIFETIME_DAYS },
    resolver: zodResolver(newApiKeySchema)
  });

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>Create a new API key</DialogV2Title>
        <DialogV2Description>The secret is shown once after creation. Store it in your secret manager.</DialogV2Description>
      </DialogV2Header>

      <DialogV2Body>
        <Form {...form}>
          <form id={formId} className="flex flex-col gap-4" onSubmit={form.handleSubmit(onCreate)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => <FormInput {...field} type="text" label="Name" placeholder="CI/CD pipeline" autoFocus />}
            />

            <FormField
              control={form.control}
              name="lifetimeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiration</FormLabel>
                  <Select value={String(field.value)} onValueChange={value => field.onChange(Number(value))}>
                    <FormControl>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {API_KEY_LIFETIMES.map(lifetime => (
                        <SelectItem key={lifetime.days} value={String(lifetime.days)}>
                          {lifetime.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12.5px] leading-[18px] text-muted-foreground">
              <TriangleAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                This key has <span className="font-semibold text-foreground">full access</span> to your Console account, including deployments, leases and
                billing. Treat it like a password.
              </span>
            </div>
          </form>
        </Form>
      </DialogV2Body>

      <DialogV2Footer className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isCreating} onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="submit" form={formId} loading={isCreating}>
          <KeyRoundIcon className="mr-2 h-4 w-4" aria-hidden />
          Create key
        </LoadingButton>
      </DialogV2Footer>
    </>
  );
};

type ApiKeySecretStepProps = {
  name: string;
  secret: string;
  onCopy: (secret: string) => void;
  onDone: () => void;
};

const ApiKeySecretStep: FC<ApiKeySecretStepProps> = ({ name, secret, onCopy, onDone }) => (
  <>
    <DialogV2Header>
      <DialogV2Title>&ldquo;{name}&rdquo; is ready</DialogV2Title>
      <DialogV2Description>Copy it now. This is the only time it will be displayed.</DialogV2Description>
    </DialogV2Header>

    <DialogV2Body className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted px-3.5 py-3">
        <code aria-label="API key secret" className="min-w-0 flex-1 break-all font-mono text-[12.5px] leading-[18px] text-foreground">
          {secret}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy to clipboard"
          className="h-[30px] w-[30px] shrink-0 rounded-md"
          onClick={() => onCopy(secret)}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="flex items-start gap-2 text-[12.5px] leading-[18px] text-muted-foreground">
        <TriangleAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        <span>
          Store it as AKASH_API_KEY in an environment variable or secret manager, never in source code. Console keeps only a hash of it, so if you lose it,
          create a new key.
        </span>
      </p>
    </DialogV2Body>

    <DialogV2Footer className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onDone}>
        Done
      </Button>
      <Button type="button" className="gap-2" onClick={() => onCopy(secret)}>
        <CopyIcon className="h-4 w-4" aria-hidden />
        Copy key
      </Button>
    </DialogV2Footer>
  </>
);
