import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFormContext } from "react-hook-form";
import { Button, CustomTooltip, Field, FieldContent, FieldError, FieldLabel, Input, Snackbar, TooltipProvider } from "@akashnetwork/ui/components";
import { saveAs } from "file-saver";
import { InfoIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import type { SdlBuilderFormValuesType } from "@src/types";
import { withServiceSshKey } from "@src/utils/sdl/sshKey";
import { generateSSHKeyPair } from "@src/utils/sshKeyUtils";

type JSZipInstance = { file(name: string, data: string): void; generateAsync(opts: { type: string }): Promise<Blob> };

/** Lazily loads JSZip so the (sizable) dependency stays out of the initial bundle. */
const loadJSZip = async (): Promise<{ new (): JSZipInstance }> => {
  const JSZipModule = await import("jszip");
  return (JSZipModule.default || JSZipModule) as unknown as { new (): JSZipInstance };
};

/** Narrowed to the single call signature used here so tests can supply a plain stub. */
const saveBlobAs: (data: Blob, filename: string) => void = saveAs;

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { CodeSnippet, generateSSHKeyPair, useSnackbar, saveAs: saveBlobAs, loadJSZip };

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/** `hasSSHKey` is deployment-wide and the schema requires every service to carry the key while it is on, so the key and its managed `SSH_PUBKEY` env var go to all services. */
export function useApplySshKeyToAllServices() {
  const { setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();

  return useCallback(
    (publicKey: string) => {
      const services = getValues("services") ?? [];
      services.forEach((service, index) => {
        const updated = withServiceSshKey(service, publicKey);
        setValue(`services.${index}.sshPubKey`, updated.sshPubKey, { shouldValidate: true, shouldDirty: true });
        setValue(`services.${index}.env`, updated.env, { shouldValidate: true, shouldDirty: true });
      });
    },
    [getValues, setValue]
  );
}

/** The SSH public key input, filled by hand or by generating a keypair that downloads as a zip, with usage instructions alongside. */
export const SshPublicKeyField: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar } = d.useSnackbar();
  const sshPubKey = useController({ control, name: `services.${serviceIndex}.sshPubKey` });
  const applyKeyToAllServices = useApplySshKeyToAllServices();

  const generateKey = useCallback(async () => {
    if (!window.crypto?.subtle) {
      enqueueSnackbar(<Snackbar title="SSH key cannot be generated" subTitle="Your browser doesn't support the WebCrypto API." iconVariant="error" />, {
        variant: "error"
      });
      return;
    }

    try {
      const { publicKey, privatePem } = await d.generateSSHKeyPair();

      const JSZip = await d.loadJSZip();
      const zip = new JSZip();
      zip.file("id_rsa.pub", publicKey);
      zip.file("id_rsa", privatePem);
      d.saveAs(await zip.generateAsync({ type: "blob" }), "keypair.zip");
      applyKeyToAllServices(publicKey);
    } catch {
      enqueueSnackbar(<Snackbar title="SSH key cannot be generated" subTitle="Failed to generate or download the SSH keypair." iconVariant="error" />, {
        variant: "error"
      });
    }
  }, [d, enqueueSnackbar, applyKeyToAllServices]);

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={`ssh-pub-key-${serviceIndex}`}>SSH public key</FieldLabel>
      <FieldContent>
        <Input
          id={`ssh-pub-key-${serviceIndex}`}
          aria-label="SSH public key"
          placeholder="ssh-ed25519 AAAA… user@host"
          value={sshPubKey.field.value ?? ""}
          onChange={event => applyKeyToAllServices(event.target.value || "")}
          onBlur={sshPubKey.field.onBlur}
          error={!!sshPubKey.fieldState.error}
          inputClassName="h-9"
        />
        <FieldError className="text-muted-foreground">{sshPubKey.fieldState.error?.message}</FieldError>
      </FieldContent>

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Or</span>
        <Button size="sm" type="button" variant="outline" onClick={generateKey}>
          Generate new key
        </Button>

        <SshKeyInstructions dependencies={d} />
      </div>
    </Field>
  );
};

const SshKeyInstructions: FC<{ dependencies: typeof DEPENDENCIES }> = ({ dependencies: d }) => (
  <div className="flex items-center justify-end">
    <TooltipProvider>
      <CustomTooltip title={<SshKeyUsage dependencies={d} />} className="max-w-md p-4 text-left font-sans text-xs normal-case">
        <button
          type="button"
          aria-label="How to use the SSH key"
          className="inline-flex cursor-help items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <InfoIcon className="h-4 w-4" />
        </button>
      </CustomTooltip>
    </TooltipProvider>
  </div>
);

const SshKeyUsage: FC<{ dependencies: typeof DEPENDENCIES }> = ({ dependencies: d }) => (
  <div role="note" aria-label="How to use the SSH key" className="text-muted-foreground">
    <p className="font-bold">How to use</p>
    <p>The generated SSH key pair is used to access the container via SSH. Here are generalized steps to use them:</p>
    <ul className="mt-1 list-inside list-disc space-y-1">
      <li>
        Download the key pair and extract it.
        <d.CodeSnippet code="unzip ~/Downloads/keypair.zip" />
      </li>
      <li>
        Copy the private key file to <code>~/.ssh/id_rsa</code> on your local machine.
        <d.CodeSnippet code="mv ~/Downloads/keypair/* ~/.ssh/" />
      </li>
      <li>
        Make sure to set the correct permissions on the private key file:
        <d.CodeSnippet code="chmod 600 ~/.ssh/id_rsa" />
      </li>
      <li>Check out more instructions on the deployment page in the Lease tab.</li>
    </ul>
    <p className="mt-2">Note: the above is valid for unix operating systems. Make sure your image has SSH configured.</p>
  </div>
);
