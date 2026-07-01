import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFormContext } from "react-hook-form";
import {
  Button,
  Checkbox,
  CollapsibleCard,
  CustomTooltip,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Label,
  QuantityStepper,
  Snackbar,
  TooltipProvider
} from "@akashnetwork/ui/components";
import { saveAs } from "file-saver";
import { InfoIcon, SettingsIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import type { SdlBuilderFormValuesType } from "@src/types";
import { withServiceSshKey } from "@src/utils/sdl/sshKey";
import { generateSSHKeyPair } from "@src/utils/sshKeyUtils";
import { runtimeTooltip } from "../cardTooltips";

type JSZipInstance = { file(name: string, data: string): void; generateAsync(opts: { type: string }): Promise<Blob> };

/** Lazily loads JSZip so the (sizable) dependency stays out of the initial bundle. */
const loadJSZip = async (): Promise<{ new (): JSZipInstance }> => {
  const JSZipModule = await import("jszip");
  return (JSZipModule.default || JSZipModule) as unknown as { new (): JSZipInstance };
};

/** Narrowed to the single call signature used here so tests can supply a plain stub. */
const saveBlobAs: (data: Blob, filename: string) => void = saveAs;

export const DEPENDENCIES = { CollapsibleCard, QuantityStepper, CodeSnippet, generateSSHKeyPair, useSnackbar, saveAs: saveBlobAs, loadJSZip };

type Props = {
  serviceIndex: number;
  /** While the pane is locked every input in the card body is disabled so configured values stay viewable but read-only. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * "Runtime" card. Edits the non-image runtime fields of a service on the shared deployment model:
 * the replica count (`count`) and the SSH public key (`sshPubKey`). Checking "Expose SSH" (the
 * top-level `hasSSHKey` flag) reveals the SSH key field; the key can be filled manually or populated
 * by generating a new keypair, which downloads the pair as a zip and surfaces usage instructions.
 * Because `hasSSHKey` is deployment-wide and the schema requires every service to carry the key while
 * it is on, the key is applied to all services (not just the selected one) and mirrored into a
 * managed `SSH_PUBKEY` env var on each (so it appears in the Environment Variables card and the
 * generated SDL); unchecking "Expose SSH" clears both the key and that env var from every service.
 */
export const RuntimeCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  return (
    <d.CollapsibleCard title="Runtime" icon={<SettingsIcon className="h-4 w-4" />} infoTooltip={runtimeTooltip}>
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <ReplicasField serviceIndex={serviceIndex} dependencies={d} />

        <SshKeyField serviceIndex={serviceIndex} dependencies={d} />
      </fieldset>
    </d.CollapsibleCard>
  );
};

const ReplicasField: FC<Required<Omit<Props, "locked">>> = ({ serviceIndex, dependencies: d }) => {
  const { control, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const count = useController({ control, name: `services.${serviceIndex}.count` });

  /**
   * The replica count feeds the per-group CPU/RAM/GPU totals, so re-validate those limits when the user
   * changes it — from the change handler rather than a mount effect, which would surface limit errors on
   * still-untouched fields.
   */
  const changeCount = useCallback(
    (value: number) => {
      count.field.onChange(value);
      void trigger([`services.${serviceIndex}.profile.cpu`, `services.${serviceIndex}.profile.ram`, `services.${serviceIndex}.profile.gpu`]);
    },
    [count.field, trigger, serviceIndex]
  );

  return (
    <Field className="gap-2">
      <FieldLabel>Replicas</FieldLabel>
      <FieldContent>
        <d.QuantityStepper
          label="Replicas"
          className="self-start"
          value={count.field.value ?? 1}
          min={1}
          max={20}
          aria-describedby={count.fieldState.error ? `replicas-error-${serviceIndex}` : undefined}
          onChange={changeCount}
        />
        <FieldError id={`replicas-error-${serviceIndex}`} className="text-muted-foreground">
          {count.fieldState.error?.message}
        </FieldError>
      </FieldContent>
    </Field>
  );
};

const SshKeyField: FC<Required<Omit<Props, "locked">>> = ({ serviceIndex, dependencies: d }) => {
  const { control, setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar } = d.useSnackbar();
  const hasSSHKey = useController({ control, name: "hasSSHKey" });
  const sshPubKey = useController({ control, name: `services.${serviceIndex}.sshPubKey` });

  const applyKeyToAllServices = useCallback(
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

  const changeKey = useCallback(
    (value: string) => {
      applyKeyToAllServices(value);
    },
    [applyKeyToAllServices]
  );

  const toggleExposeSsh = useCallback(
    (checked: boolean) => {
      hasSSHKey.field.onChange(checked);
      if (!checked) {
        applyKeyToAllServices("");
      }
    },
    [hasSSHKey.field, applyKeyToAllServices]
  );

  const generateKey = useCallback(async () => {
    if (!window.crypto?.subtle) {
      enqueueSnackbar(<Snackbar title="SSH key cannot be generated" subTitle="Your browser doesn't support the WebCrypto API." iconVariant="error" />, {
        variant: "error"
      });
      return;
    }

    try {
      const { publicKey, privatePem } = await d.generateSSHKeyPair();
      applyKeyToAllServices(publicKey);

      const JSZip = await d.loadJSZip();
      const zip = new JSZip();
      zip.file("id_rsa.pub", publicKey);
      zip.file("id_rsa", privatePem);
      d.saveAs(await zip.generateAsync({ type: "blob" }), "keypair.zip");
    } catch {
      enqueueSnackbar(<Snackbar title="SSH key cannot be generated" subTitle="Failed to generate or download the SSH keypair." iconVariant="error" />, {
        variant: "error"
      });
    }
  }, [d, enqueueSnackbar, applyKeyToAllServices]);

  return (
    <Field className="gap-2">
      <div className="flex items-center gap-2">
        <Checkbox id={`expose-ssh-${serviceIndex}`} checked={!!hasSSHKey.field.value} onCheckedChange={checked => toggleExposeSsh(!!checked)} />
        <Label htmlFor={`expose-ssh-${serviceIndex}`}>Expose SSH</Label>
      </div>

      {hasSSHKey.field.value && (
        <>
          <FieldLabel htmlFor={`ssh-pub-key-${serviceIndex}`}>SSH public key</FieldLabel>
          <FieldContent>
            <Input
              id={`ssh-pub-key-${serviceIndex}`}
              aria-label="SSH public key"
              placeholder="ssh-ed25519 AAAA… user@host"
              value={sshPubKey.field.value ?? ""}
              onChange={event => changeKey(event.target.value || "")}
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
        </>
      )}
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
