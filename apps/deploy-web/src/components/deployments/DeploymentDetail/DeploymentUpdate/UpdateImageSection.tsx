"use client";
import type { FC } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input } from "@akashnetwork/ui/components";
import { NavArrowRight } from "iconoir-react";

import { supportedHosts } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/ImageCard/ImageCard";
import type { SdlBuilderFormValuesType } from "@src/types";
import { CUSTOM_HOST_ID } from "@src/types";
import { normalizeDockerImage } from "@src/utils/sdl/normalizeDockerImage";
import { isSdlReference } from "@src/utils/sdl/sdlSecrets";
import { isVmImage } from "@src/utils/sdl/vmImages";
import { UpdateSectionRule } from "./UpdateSectionRule";

const KEPT_CREDENTIAL_PLACEHOLDER = "Kept from your deployment";
const PUBLIC_IMAGE_NOTE = "This service pulls a public image. Adding registry credentials to a running deployment is not available yet.";
const KNOWN_REGISTRY_HOSTS = supportedHosts.filter(host => host.id !== CUSTOM_HOST_ID);

export interface UpdateImageSectionProps {
  serviceIndex: number;
  locked: boolean;
}

/** A managed VM image is read-only, because the SSH bootstrap it runs is what the deployment was created around. */
export const UpdateImageSection: FC<UpdateImageSectionProps> = ({ serviceIndex, locked }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const image = useController({ control, name: `services.${serviceIndex}.image` });
  const hasCredentials = useWatch({ control, name: `services.${serviceIndex}.hasCredentials` });
  const isVm = isVmImage(image.field.value ?? "");
  const inputId = `update-image-${serviceIndex}`;

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
              <p className="text-sm text-muted-foreground">{PUBLIC_IMAGE_NOTE}</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

/** The password is always a kept secret here, and so is a username sealed at create; replacing either is secret editing, which comes separately. */
const RegistryCredentials: FC<{ serviceIndex: number; locked: boolean }> = ({ serviceIndex, locked }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.credentials` as const;
  const host = useController({ control, name: `${basePath}.host` });
  const username = useController({ control, name: `${basePath}.username` });
  const isUsernameKept = isSdlReference(username.field.value ?? "");
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
        <div className="flex flex-col gap-1">
          <Input
            label="Username"
            aria-label="Registry username"
            value={isUsernameKept ? "" : username.field.value ?? ""}
            placeholder={isUsernameKept ? KEPT_CREDENTIAL_PLACEHOLDER : undefined}
            disabled={isUsernameKept}
            onChange={username.field.onChange}
            onBlur={username.field.onBlur}
            inputClassName="h-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            aria-label="Registry password"
            type="password"
            value=""
            placeholder={KEPT_CREDENTIAL_PLACEHOLDER}
            disabled
            readOnly
            inputClassName="h-10"
          />
        </div>
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={stopUsingPrivateRegistry}>
          Stop using a private registry
        </Button>
      </div>
    </fieldset>
  );
};
