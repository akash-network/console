"use client";
import type { FC } from "react";
import { useMemo } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { useServices } from "@src/context/ServicesProvider";
import { useSaveSettings } from "@src/queries/useSaveSettings";
import type { CustomUserProfile } from "@src/types/user";
import { formatTimezoneName, listTimezoneOptions, UTC } from "./timezoneOptions";

export const DEPENDENCIES = { useSaveSettings, useSnackbar };

type Props = {
  user: Pick<CustomUserProfile, "username" | "timezone">;
  dependencies?: typeof DEPENDENCIES;
};

export const TimezoneSetting: FC<Props> = ({ user, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: saveSettings, isPending, variables } = d.useSaveSettings();
  const timezone = (isPending && variables?.timezone) || user.timezone || UTC;
  const options = useMemo(() => listTimezoneOptions(timezone, new Date()), [timezone]);

  const pickTimezone = (pickedTimezone: string) => {
    saveSettings(
      { username: user.username, timezone: pickedTimezone },
      { onSuccess: () => enqueueSnackbar(<Snackbar title="Timezone updated" iconVariant="success" />, { variant: "success", autoHideDuration: 3000 }) }
    );
    analyticsService.track("user_settings_save", { category: "settings", label: "Change email timezone" });
  };

  return (
    <SettingsRow
      label="Timezone"
      description="Dates and times in your emails are shown in this timezone. Until you pick one, it is detected from your browser."
    >
      <div className="w-[260px] max-w-full">
        <SearchableSelect
          value={timezone}
          onChange={pickTimezone}
          options={options}
          renderValue={formatTimezoneName}
          ariaLabel="Timezone"
          searchLabel="Search timezones"
          searchPlaceholder="Search timezones"
          notFoundMessage="No timezone matches your search."
          disabled={isPending}
        />
      </div>
    </SettingsRow>
  );
};
