"use client";
import type { FC } from "react";
import { useId } from "react";
import { Snackbar, Switch } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { useServices } from "@src/context/ServicesProvider";
import { useSaveSettings } from "@src/queries/useSaveSettings";
import type { CustomUserProfile } from "@src/types/user";

export const DEPENDENCIES = { useSaveSettings, useSnackbar };

type Props = {
  user: Pick<CustomUserProfile, "username" | "email" | "productUpdatesUnsubscribedAt">;
  dependencies?: typeof DEPENDENCIES;
};

export const ProductUpdatesSetting: FC<Props> = ({ user, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const switchId = useId();
  const { mutate: saveSettings, isPending, variables } = d.useSaveSettings();
  const isSubscribed = isPending ? !!variables?.subscribedToProductUpdates : !user.productUpdatesUnsubscribedAt;

  const changeSubscription = (subscribedToProductUpdates: boolean) => {
    const title = subscribedToProductUpdates ? "Subscribed to product update emails" : "Unsubscribed from product update emails";
    saveSettings(
      { username: user.username, subscribedToProductUpdates },
      { onSuccess: () => enqueueSnackbar(<Snackbar title={title} iconVariant="success" />, { variant: "success", autoHideDuration: 3000 }) }
    );
    analyticsService.track("user_settings_save", { category: "settings", label: "Change product update emails" });
  };

  return (
    <SettingsRow
      label="Product updates"
      htmlFor={switchId}
      description={`News about new features and changes to Akash Console${user.email ? `, sent to ${user.email}` : ""}.`}
    >
      <Switch id={switchId} checked={isSubscribed} disabled={isPending} onCheckedChange={changeSubscription} />
    </SettingsRow>
  );
};
