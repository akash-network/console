"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

type NotificationChannelCreateInput = components["schemas"]["NotificationChannelCreateInput"]["data"];
type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];
export type ContainerCreateInput = Pick<NotificationChannelCreateInput, "name"> & {
  emails: NotificationChannelCreateInput["config"]["addresses"];
};

export type ChildrenProps = {
  create: (input: ContainerCreateInput) => void;
  isLoading: boolean;
};

type NotificationChannelCreateContainerProps = {
  children: (props: ChildrenProps) => ReactNode;
  onCreate?: (notificationChannel: NotificationChannel) => void;
};

export const NotificationChannelCreateContainer: FC<NotificationChannelCreateContainerProps> = ({ children, onCreate }) => {
  const { api } = useServices();
  const mutation = api.v1.createNotificationChannel.useMutation();
  const notificator = useNotificator();
  const queryClient = useQueryClient();

  const create = useCallback(
    ({ emails, name }: ContainerCreateInput) => {
      mutation.mutate(
        {
          data: {
            name,
            type: "email",
            config: {
              addresses: emails
            }
          }
        },
        {
          onSuccess: async ({ data }) => {
            notificator.success("Notification channel created!", { dataTestId: "notification-channel-create-success-notification" });
            await queryClient.invalidateQueries({ queryKey: api.v1.listNotificationChannels.getKey() });
            onCreate?.(data);
          },
          onError: () => notificator.error("Failed to create notification channel...", { dataTestId: "notification-channel-create-error-notification" })
        }
      );
    },
    [mutation, notificator, queryClient, api, onCreate]
  );

  return <>{children({ create, isLoading: mutation.isPending })}</>;
};
