import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import {
  Checkbox,
  CollapsibleCard,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { BoxIcon, EyeClosedIcon, EyeIcon, MonitorIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { CUSTOM_HOST_ID } from "@src/types";
import { normalizeDockerImage } from "@src/utils/sdl/normalizeDockerImage";
import { isVmImage, SSH_VM_IMAGES } from "@src/utils/sdl/vmImages";
import { dockerImageTooltip, operatingSystemTooltip } from "../cardTooltips";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";

export const DEPENDENCIES = { CollapsibleCard };

type Props = {
  serviceIndex: number;
  /** While locked the Docker image and registry credentials are read-only; the card also shows the lock glyph and dims. */
  locked?: boolean;
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
 * "Docker" card. The container image the deployment runs, pulled to the top of the Configuration
 * column so the one required runtime field is immediately accessible. Edits the Docker image and,
 * behind the "Private registry" toggle, the host/username/password credentials
 * (`hasCredentials`/`credentials`). Checking "Private registry" reveals the credentials fields and
 * seeds defaults; unchecking clears them.
 *
 * A service running a managed SSH-VM image presents as an "Operating System" card instead: the image
 * becomes a distro Select over the managed catalog (the form always stores the real image ref), and
 * the private-registry controls are hidden (the VM images are public) with any credentials cleared.
 */
export const ImageCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const hasCredentials = useController({ control, name: `services.${serviceIndex}.hasCredentials` });
  const image = useWatch({ control, name: `services.${serviceIndex}.image` });
  const isVm = isVmImage(image ?? "");

  useEffect(
    function clearCredentialsOnVmImage() {
      if (isVm && hasCredentials.field.value) {
        hasCredentials.field.onChange(false);
        setValue(`services.${serviceIndex}.credentials`, undefined, { shouldValidate: true, shouldDirty: true });
      }
    },
    [isVm, hasCredentials.field, setValue, serviceIndex]
  );

  return (
    <d.CollapsibleCard
      locked={locked}
      title={isVm ? "Operating System" : "Docker"}
      icon={isVm ? <MonitorIcon className="h-4 w-4" /> : <BoxIcon className="h-4 w-4" />}
      infoTooltip={isVm ? operatingSystemTooltip : dockerImageTooltip}
    >
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        {isVm ? (
          <DistributionField serviceIndex={serviceIndex} />
        ) : (
          <>
            <ImageField serviceIndex={serviceIndex} hasCredentials={!!hasCredentials.field.value} onToggleCredentials={hasCredentials.field.onChange} />

            {hasCredentials.field.value && <CredentialsFields serviceIndex={serviceIndex} />}
          </>
        )}
      </fieldset>
    </d.CollapsibleCard>
  );
};

const DistributionField: FC<{ serviceIndex: number }> = ({ serviceIndex }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const image = useController({ control, name: `services.${serviceIndex}.image` });

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={`image-${serviceIndex}`}>
        Distribution <span className="text-destructive">*</span>
      </FieldLabel>
      <FieldContent>
        <Select value={image.field.value} onValueChange={image.field.onChange}>
          <SelectTrigger id={`image-${serviceIndex}`} aria-label="Distribution" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SSH_VM_IMAGES).map(([distro, imageRef]) => (
              <SelectItem key={imageRef} value={imageRef}>
                {distro}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError className="text-muted-foreground">{image.fieldState.error?.message}</FieldError>
      </FieldContent>
    </Field>
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
          onBlur={image.field.onBlur}
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
              onBlur={host.field.onBlur}
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
            onBlur={username.field.onBlur}
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
            onBlur={password.field.onBlur}
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
