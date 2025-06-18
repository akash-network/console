import type { FC } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { buttonVariants, FormField, FormLabel, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";

type ExternalProps = {
  name: string;
  disabled?: boolean;
};

type Props = Pick<ChildrenProps, "isFetched" | "data"> & ExternalProps;

export const NotificationChannelSelectView: FC<Props> = ({ name, isFetched, data, disabled }) => {
  const { control } = useFormContext();

  return (
    <LoadingBlocker isLoading={!isFetched}>
      <FormLabel htmlFor="notification-channel-id" className={cn({ "cursor-not-allowed text-red-500": disabled })}>
        Notification Channel
      </FormLabel>
      <div className="flex">
        <FormField
          control={control}
          name={name}
          render={({ field, fieldState }) => (
            <>
              <div className="flex-1">
                <Select value={field.value || ""} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger
                    id="notification-channel-id"
                    data-testid="notification-channel-select-trigger"
                    className={cn({ "border-2 border-red-500": fieldState.error })}
                  >
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
                {fieldState.error && <p className="text-xs font-medium text-destructive">{fieldState.error.message}</p>}
              </div>
            </>
          )}
        />
        <div className="ml-2">
          <Link
            href="/alerts/notification-channels/new"
            className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center", {
              "opacity-10": disabled,
              "cursor-not-allowed": disabled
            })}
            onClick={e => {
              if (disabled) {
                e.preventDefault();
              }
            }}
          >
            <Plus />
          </Link>
        </div>
      </div>
    </LoadingBlocker>
  );
};

export const NotificationChannelSelect: FC<ExternalProps> = props => (
  <NotificationChannelsListContainer>
    {({ data, isFetched }) => <NotificationChannelSelectView data={data} isFetched={isFetched} {...props} />}
  </NotificationChannelsListContainer>
);
