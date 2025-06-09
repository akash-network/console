"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type NotificationChannelCreateInput = components["schemas"]["NotificationChannelCreateInput"]["data"];
export type ContainerCreateInput = Pick<NotificationChannelCreateInput, "name"> & {
  emails: NotificationChannelCreateInput["config"]["addresses"];
};

export type ChildrenProps = {
  create: (input: ContainerCreateInput) => void;
  isLoading: boolean;
};

export const NotificationChannelCreateContainer: FC<{ children: (props: ChildrenProps) => ReactNode; onCreate?: () => void }> = ({ children, onCreate }) => {
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.createNotificationChannel.useMutation();
  const notificator = useNotificator();
  const queryClient = useQueryClient();

  const create = useCallback(
    ({ emails, name }: ContainerCreateInput) => {
      mutation.mutate({
        body: {
          data: {
            name,
            type: "email",
            config: {
              addresses: emails
            }
          }
        }
      });
    },
    [mutation]
  );

  useWhen(mutation.isSuccess, async () => {
    notificator.success("Notification channel created!", { dataTestId: "notification-channel-create-success-notification" });
    await queryClient.invalidateQueries({ queryKey: notificationsApi.v1.getNotificationChannels.getQueryKey() });
    onCreate?.();
  });

  useWhen(mutation.isError, () =>
    notificator.error("Failed to create notification channel...", { dataTestId: "notification-channel-create-error-notification" })
  );

  return <>{children({ create, isLoading: mutation.isPending })}</>;
};
