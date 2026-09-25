"use client";
import type { FC } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input } from "@akashnetwork/ui/components";
import { NavArrowRight } from "iconoir-react";

import { supportedHosts } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/ImageCard/ImageCard";
import type { SdlBuilderFormValuesType } from "@src/types";
import { CUSTOM_HOST_ID } from "@src/types";
import { normalizeDockerImage } from "@src/utils/sdl/normalizeDockerImage";
import { secretNameOf } from "@src/utils/sdl/sdlSecrets";
import { isVmImage } from "@src/utils/sdl/vmImages";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { UpdateSectionRule } from "./UpdateSectionRule";

const PUBLIC_IMAGE_NOTE = "This service pulls a public image.";
const DEFAULT_REGISTRY_HOST = "docker.io";
const KNOWN_REGISTRY_HOSTS = supportedHosts.filter(host => host.id !== CUSTOM_HOST_ID);

export interface UpdateImageSectionProps {
  serviceIndex: number;
  locked: boolean;
}

/** A managed VM image is read-only, because the SSH bootstrap it runs is what the deployment was created around. */
export const UpdateImageSection: FC<UpdateImageSectionProps> = ({ serviceIndex, locked }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const image = useController({ control, name: `services.${serviceIndex}.image` });
  const hasCredentials = useWatch({ control, name: `services.${serviceIndex}.hasCredentials` });
  const isVm = isVmImage(image.field.value ?? "");
  const inputId = `update-image-${serviceIndex}`;

  function startUsingPrivateRegistry() {
    setValue(`services.${serviceIndex}.hasCredentials`, true, { shouldDirty: true });
    setValue(`services.${serviceIndex}.credentials`, { host: DEFAULT_REGISTRY_HOST, username: "", password: "" }, { shouldDirty: true });
  }

  return (
    <div className="flex flex-col gap-3">
      <UpdateSectionRule title="Image" />
      <fieldset disabled={locked || isVm} className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <Input
          id={inputId}
          label="Image"
          labelClassName="sr-only"
          value={image.field.value ?? ""}
          onChange={event => image.field.onChange(normalizeDockerImage(event.target.value))}
          onBlur={image.field.onBlur}
          error={!!image.fieldState.error}
          inputClassName="h-10 font-mono"
        />
        {image.fieldState.error && <p className="text-xs text-destructive">{image.fieldState.error.message}</p>}
      </fieldset>

      {!isVm && (
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <NavArrowRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
            Private registry
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {hasCredentials ? (
              <RegistryCredentials serviceIndex={serviceIndex} locked={locked} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">{PUBLIC_IMAGE_NOTE}</p>
                <Button type="button" variant="outline" size="sm" disabled={locked} onClick={startUsingPrivateRegistry}>
                  Add registry credentials
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

/** A half the deployment keeps as a secret is replaced through a box keyed by its name, so the reference in the credentials never changes under it. */
const RegistryCredentials: FC<{ serviceIndex: number; locked: boolean }> = ({ serviceIndex, locked }) => {
  const { control, setValue } = useFormContext<DeploymentUpdateFormValues>();
  const basePath = `services.${serviceIndex}.credentials` as const;
  const host = useController({ control, name: `${basePath}.host` });
  const username = useWatch({ control, name: `${basePath}.username` }) ?? "";
  const password = useWatch({ control, name: `${basePath}.password` }) ?? "";
  const keptUsernameName = secretNameOf(username);
  const keptPasswordName = secretNameOf(password);
  const hostListId = `update-registry-hosts-${serviceIndex}`;

  function stopUsingPrivateRegistry() {
    setValue(`services.${serviceIndex}.hasCredentials`, false, { shouldDirty: true });
    setValue(basePath, undefined, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Input
            label="Host"
            aria-label="Registry host"
            list={hostListId}
            value={host.field.value ?? ""}
            onChange={host.field.onChange}
            onBlur={host.field.onBlur}
            error={!!host.fieldState.error}
            inputClassName="h-10"
          />
          <datalist id={hostListId}>
            {KNOWN_REGISTRY_HOSTS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </datalist>
          {host.fieldState.error && <p className="text-xs text-destructive">{host.fieldState.error.message}</p>}
        </div>
        <CredentialField label="Username" name={keptUsernameName ? `secretValues.${keptUsernameName}` : `${basePath}.username`} isKept={!!keptUsernameName} />
        <CredentialField
          label="Password"
          name={keptPasswordName ? `secretValues.${keptPasswordName}` : `${basePath}.password`}
          isKept={!!keptPasswordName}
          isMasked
        />
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={stopUsingPrivateRegistry}>
          Stop using a private registry
        </Button>
      </div>
    </fieldset>
  );
};

interface CredentialFieldProps {
  label: "Username" | "Password";
  name: `secretValues.${string}` | `services.${number}.credentials.${"username" | "password"}`;
  isKept: boolean;
  isMasked?: boolean;
}

const CredentialField: FC<CredentialFieldProps> = ({ label, name, isKept, isMasked }) => {
  const { control } = useFormContext<DeploymentUpdateFormValues>();
  const field = useController({ control, name });

  return (
    <div className="flex flex-col gap-1">
      <Input
        label={label}
        aria-label={`Registry ${label.toLowerCase()}`}
        type={isMasked ? "password" : "text"}
        autoComplete={isMasked ? "new-password" : "off"}
        value={field.field.value ?? ""}
        placeholder={isKept ? "Kept from your deployment" : undefined}
        onChange={field.field.onChange}
        onBlur={field.field.onBlur}
        error={!!field.fieldState.error}
        inputClassName="h-10"
      />
      {field.fieldState.error && <p className="text-xs text-destructive">{field.fieldState.error.message}</p>}
    </div>
  );
};
