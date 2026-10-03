import type { FC } from "react";
import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, FormField, FormLabel, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";

import { NotificationChannelDialog } from "@src/components/alerts/NotificationChannelDialog/NotificationChannelDialog";
import type { ChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";

export const DEPENDENCIES = { NotificationChannelDialog };

type ExternalProps = {
  name: string;
  disabled?: boolean;
};

type Props = Pick<ChildrenProps, "isFetched" | "data"> & ExternalProps & { dependencies?: typeof DEPENDENCIES };

export const NotificationChannelSelectView: FC<Props> = ({ name, isFetched, data, disabled, dependencies: d = DEPENDENCIES }) => {
  const { control, getFieldState, setValue } = useFormContext();
  const state = getFieldState(name);
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  return (
    <LoadingBlocker isLoading={!isFetched}>
      <FormLabel htmlFor="notification-channel-id" className={cn({ "cursor-not-allowed text-red-500": state.error })}>
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
                  <SelectTrigger id="notification-channel-id" className={cn({ "border-2 border-red-500": fieldState.error })}>
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
        <div className="ml-4 flex h-10 items-center">
          <Button type="button" variant="outline" size="md" aria-label="Add notification channel" disabled={disabled} onClick={() => setIsAddingChannel(true)}>
            <Plus />
          </Button>
        </div>
      </div>
      {isAddingChannel && (
        <d.NotificationChannelDialog
          onCreate={createdChannel => setValue(name, createdChannel.id, { shouldDirty: true, shouldValidate: true })}
          onClose={() => setIsAddingChannel(false)}
        />
      )}
    </LoadingBlocker>
  );
};

export const NotificationChannelSelect: FC<ExternalProps> = props => (
  <NotificationChannelsListContainer>
    {({ data, isFetched }) => <NotificationChannelSelectView data={data} isFetched={isFetched} {...props} />}
  </NotificationChannelsListContainer>
);
