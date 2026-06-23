import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar,
  TooltipProvider
} from "@akashnetwork/ui/components";
import { saveAs } from "file-saver";
import { BoxIcon, EyeClosedIcon, EyeIcon, InfoIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import type { SdlBuilderFormValuesType } from "@src/types";
import { CUSTOM_HOST_ID } from "@src/types";
import { normalizeDockerImage } from "@src/utils/sdl/normalizeDockerImage";
import { withServiceSshKey } from "@src/utils/sdl/sshKey";
import { generateSSHKeyPair } from "@src/utils/sshKeyUtils";
import { imageRuntimeTooltip } from "../cardTooltips";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";

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
  dependencies?: typeof DEPENDENCIES;
};

/** Registry hosts offered for private image credentials. */
const supportedHosts = [
  { id: "docker.io", label: "Docker Hub" },
  { id: "ghcr.io", label: "GitHub Container Registry" },
  { id: "pkg.dev", label: "Google Artifact Registry" },
  { id: "amazonaws.com", label: "AWS Elastic Container Registry" },
  { id: "azurecr.io", label: "Azure Container Registry" },
  { id: "registry.gitlab.com", label: "GitLab Container Registry" },
  { id: CUSTOM_HOST_ID, label: "Custom Registry" }
];

const defaultCredentials = { host: "docker.io", username: "", password: "" };

/**
 * "Image & Runtime" card. Edits the runtime-facing fields of a service on the
 * shared deployment model: the Docker image, optional private-registry
 * credentials (`hasCredentials`/`credentials`), the replica count (`count`) and
 * the SSH public key (`sshPubKey`). Checking "Private registry" reveals the
 * host/username/password fields and seeds default credentials; unchecking clears
 * them. Checking "Expose SSH" (the top-level `hasSSHKey` flag) reveals the SSH
 * key field; the key can be filled manually or populated by generating a new
 * keypair, which downloads the pair as a zip and surfaces usage instructions.
 * Because `hasSSHKey` is deployment-wide and the schema requires every service to
 * carry the key while it is on, the key is applied to all services (not just the
 * selected one) and mirrored into a managed `SSH_PUBKEY` env var on each (so it
 * appears in the Environment Variables card and the generated SDL); unchecking
 * "Expose SSH" clears both the key and that env var from every service.
 */
export const ImageRuntimeCard: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const hasCredentials = useController({ control, name: `services.${serviceIndex}.hasCredentials` });

  return (
    <d.CollapsibleCard title="Image & Runtime" icon={<BoxIcon className="h-4 w-4" />} infoTooltip={imageRuntimeTooltip}>
      <ImageField serviceIndex={serviceIndex} hasCredentials={!!hasCredentials.field.value} onToggleCredentials={hasCredentials.field.onChange} />

      {hasCredentials.field.value && <CredentialsFields serviceIndex={serviceIndex} />}

      <ReplicasField serviceIndex={serviceIndex} dependencies={d} />

      <SshKeyField serviceIndex={serviceIndex} dependencies={d} />
    </d.CollapsibleCard>
  );
};

type ImageFieldProps = {
  serviceIndex: number;
  hasCredentials: boolean;
  onToggleCredentials: (checked: boolean) => void;
};

const ImageField: FC<ImageFieldProps> = ({ serviceIndex, hasCredentials, onToggleCredentials }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const image = useController({ control, name: `services.${serviceIndex}.image` });

  /**
   * Seeds blank default credentials when enabling a private registry and clears
   * them when disabling. Seeding does not validate (`shouldValidate: !checked`)
   * so the empty password/host don't surface "required" errors before the user
   * types anything; clearing revalidates to drop any errors left behind.
   */
  const toggleCredentials = useCallback(
    (checked: boolean) => {
      onToggleCredentials(checked);
      setValue(`services.${serviceIndex}.credentials`, checked ? { ...defaultCredentials } : undefined, { shouldValidate: !checked, shouldDirty: true });
    },
    [onToggleCredentials, setValue, serviceIndex]
  );

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={`image-${serviceIndex}`}>
        Docker image <span className="text-destructive">*</span>
      </FieldLabel>
      <FieldContent>
        <Input
          id={`image-${serviceIndex}`}
          aria-label="Docker image"
          placeholder="e.g. ghcr.io/your-org/app:latest"
          value={image.field.value ?? ""}
          onChange={event => image.field.onChange(normalizeDockerImage(event.target.value || ""))}
          error={!!image.fieldState.error}
          inputClassName="h-9"
        />
        <FieldError className="text-muted-foreground">{image.fieldState.error?.message}</FieldError>
      </FieldContent>
      <div className="flex items-center gap-2">
        <Checkbox id={`private-registry-${serviceIndex}`} checked={hasCredentials} onCheckedChange={checked => toggleCredentials(!!checked)} />
        <Label htmlFor={`private-registry-${serviceIndex}`}>Private registry</Label>
      </div>
    </Field>
  );
};

const CredentialsFields: FC<{ serviceIndex: number }> = ({ serviceIndex }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.credentials` as const;

  const host = useController({ control, name: `${basePath}.host` });
  const username = useController({ control, name: `${basePath}.username` });
  const password = useController({ control, name: `${basePath}.password` });

  const [showPassword, setShowPassword] = useState(false);
  const isCustomHost = host.field.value === CUSTOM_HOST_ID || supportedHosts.every(option => option.id !== host.field.value);

  /**
   * `CUSTOM_HOST_ID` is a UI-only sentinel for the "Custom Registry" option; it
   * must never reach the form/SDL. Picking it stores an empty host (invalid
   * until the user types a real URL) rather than the placeholder string.
   */
  const selectHost = (value: string) => host.field.onChange(value === CUSTOM_HOST_ID ? "" : value);

  return (
    <div role="group" aria-label="Private registry credentials" className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <Field className="gap-2">
        <FieldLabel>Host</FieldLabel>
        <FieldContent>
          <Select value={isCustomHost ? CUSTOM_HOST_ID : host.field.value} onValueChange={selectHost}>
            <SelectTrigger aria-label="Registry host" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {supportedHosts.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                  {option.id !== CUSTOM_HOST_ID && ` - ${option.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCustomHost && (
            <Input
              aria-label="Custom registry URL"
              placeholder="e.g. myregistry.example.com"
              value={host.field.value === CUSTOM_HOST_ID ? "" : host.field.value ?? ""}
              onChange={host.field.onChange}
              error={!!host.fieldState.error}
              inputClassName="h-9"
            />
          )}
          <FieldError className="text-muted-foreground">{host.fieldState.error?.message}</FieldError>
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`credentials-username-${serviceIndex}`}>Username</FieldLabel>
        <FieldContent>
          <Input
            id={`credentials-username-${serviceIndex}`}
            aria-label="Registry username"
            value={username.field.value ?? ""}
            onChange={event => username.field.onChange(event.target.value || "")}
            error={!!username.fieldState.error}
            inputClassName="h-9"
          />
          <FieldError className="text-muted-foreground">{username.fieldState.error?.message}</FieldError>
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`credentials-password-${serviceIndex}`}>Password</FieldLabel>
        <FieldContent>
          <Input
            id={`credentials-password-${serviceIndex}`}
            aria-label="Registry password"
            type={showPassword ? "text" : "password"}
            value={password.field.value ?? ""}
            onChange={event => password.field.onChange(event.target.value || "")}
            error={!!password.fieldState.error}
            inputClassName="h-9"
            endIcon={
              <button
                type="button"
                className="flex h-full items-center pr-2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeIcon /> : <EyeClosedIcon />}
              </button>
            }
          />
          <FieldError className="text-muted-foreground">{password.fieldState.error?.message}</FieldError>
        </FieldContent>
      </Field>
    </div>
  );
};

const ReplicasField: FC<Required<Props>> = ({ serviceIndex, dependencies: d }) => {
  const { control, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const count = useController({ control, name: `services.${serviceIndex}.count` });

  const countValue = count.field.value;
  useEffect(
    function revalidateGroupLimitsOnCountChange() {
      void trigger([`services.${serviceIndex}.profile.cpu`, `services.${serviceIndex}.profile.ram`, `services.${serviceIndex}.profile.gpu`]);
    },
    [countValue, serviceIndex, trigger]
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
          onChange={count.field.onChange}
        />
        <FieldError id={`replicas-error-${serviceIndex}`} className="text-muted-foreground">
          {count.fieldState.error?.message}
        </FieldError>
      </FieldContent>
    </Field>
  );
};

const SshKeyField: FC<Required<Props>> = ({ serviceIndex, dependencies: d }) => {
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
