import type { FC } from "react";
import { useState } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { buttonVariants, FormField, FormLabel, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useWhen } from "@src/hooks/useWhen";

export const NotificationChannelSelectView: FC<Pick<ChildrenProps, "isFetched" | "data">> = ({ isFetched, data }) => {
  const { control, setValue } = useFormContext();
  const [isInit, setIsInit] = useState(false);

  useWhen(isFetched, () => {
    if (!isInit) {
      setIsInit(true);
      setValue("notificationChannelId", data[0]?.id);
    }
  }, [isInit, setIsInit, data]);

  return (
    <LoadingBlocker isLoading={!isFetched}>
      <FormLabel htmlFor="notification-channel-id">Notification Channel</FormLabel>
      <div className="flex">
        <FormField
          control={control}
          name="notificationChannelId"
          render={({ field }) => (
            <Select value={field.value || ""} onValueChange={field.onChange}>
              <SelectTrigger id="notification-channel-id" data-testid="notification-channel-select-trigger">
                <SelectValue placeholder="Select notification channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {data.map(notificationChannel => (
                    <SelectItem key={notificationChannel.id} value={notificationChannel.id}>
                      {notificationChannel.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
        <div className="ml-2">
          <Link href="/alerts/notification-channels/new" className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
            <Plus />
          </Link>
        </div>
      </div>
    </LoadingBlocker>
  );
};

export const NotificationChannelSelect = () => (
  <NotificationChannelsListContainer>
    {({ data, isFetched }) => <NotificationChannelSelectView data={data} isFetched={isFetched} />}
  </NotificationChannelsListContainer>
);
