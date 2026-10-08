"use client";
import type { FC, FormEvent, KeyboardEvent } from "react";
import { useId, useState } from "react";
import { Input, LoadingButton, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { useServices } from "@src/context/ServicesProvider";
import { useSaveSettings } from "@src/queries/useSaveSettings";
import { useUsernameAvailability } from "./useUsernameAvailability";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters long")
  .max(40, "Username must be at most 40 characters long")
  .regex(/^[a-zA-Z0-9_-]*$/, "Username can only contain letters, numbers, dashes and underscores");

export const DEPENDENCIES = { useSaveSettings, useUsernameAvailability, useSnackbar };

type Props = {
  username: string | undefined;
  dependencies?: typeof DEPENDENCIES;
};

export const UsernameSetting: FC<Props> = ({ username: savedUsername = "", dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const inputId = useId();
  const statusId = useId();
  const [username, setUsername] = useState(savedUsername);
  const { mutate: saveSettings, isPending: isSaving } = d.useSaveSettings();

  const isChanged = username !== savedUsername;
  const validationError = isChanged ? usernameSchema.safeParse(username).error?.issues[0]?.message : undefined;
  const { isChecking, isAvailable } = d.useUsernameAvailability(isChanged && !validationError ? username : undefined);
  const canSave = isChanged && !validationError && !isChecking && isAvailable !== false;

  const saveUsername = (event: FormEvent) => {
    event.preventDefault();
    saveSettings(
      { username },
      { onSuccess: () => enqueueSnackbar(<Snackbar title="Username updated" iconVariant="success" />, { variant: "success", autoHideDuration: 3000 }) }
    );
    analyticsService.track("user_settings_save", { category: "settings", label: "Save username" });
  };

  const revertOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setUsername(savedUsername);
  };

  return (
    <SettingsRow label="Username" htmlFor={inputId}>
      <form onSubmit={saveUsername} className="flex w-full flex-col sm:w-auto">
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            value={username}
            onChange={event => setUsername(event.target.value)}
            onKeyDown={revertOnEscape}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!validationError || isAvailable === false}
            aria-describedby={statusId}
            className="min-w-0 flex-1 sm:w-[220px] sm:flex-none"
            inputClassName="h-9 font-mono text-[13px]"
          />
          <LoadingButton type="submit" size="md" loading={isSaving} disabled={!canSave}>
            Save
          </LoadingButton>
        </div>
        <p id={statusId} aria-live="polite" className="pt-1.5 text-xs empty:pt-0">
          <UsernameStatus validationError={validationError} isChecking={isChecking} isAvailable={isAvailable} />
        </p>
      </form>
    </SettingsRow>
  );
};

const UsernameStatus: FC<{ validationError: string | undefined; isChecking: boolean; isAvailable: boolean | undefined }> = ({
  validationError,
  isChecking,
  isAvailable
}) => {
  if (validationError) return <span className="text-destructive">{validationError}</span>;
  if (isChecking) return <span className="text-muted-foreground">Checking availability…</span>;
  if (isAvailable === true) return <StatusWithIcon icon={CircleCheck} className="text-green-600" text="Username is available" />;
  if (isAvailable === false) return <StatusWithIcon icon={CircleX} className="text-destructive" text="Username is not available" />;
  return null;
};

const StatusWithIcon: FC<{ icon: typeof CircleCheck; className: string; text: string }> = ({ icon: Icon, className, text }) => (
  <span className={cn("inline-flex items-center gap-1", className)}>
    <Icon className="h-3.5 w-3.5" />
    {text}
  </span>
);
