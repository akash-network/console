"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

type NotificationChannelPatchInput = components["schemas"]["NotificationChannelPatchInput"]["data"];
export type ContainerPatchInput = Pick<NotificationChannelPatchInput, "name"> & {
  emails: Required<NotificationChannelPatchInput>["config"]["addresses"];
};

export type ChildrenProps = {
  values?: Required<ContainerPatchInput>;
  onEdit: (input: ContainerPatchInput) => void;
  isLoading: boolean;
};

type NotificationChannelEditContainerProps = {
  id: string;
  children: (props: ChildrenProps) => ReactNode;
  onEditSuccess: () => void;
};

export const NotificationChannelEditContainer: FC<NotificationChannelEditContainerProps> = ({ id, children, onEditSuccess }) => {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const mutation = api.v1.updateNotificationChannel.useMutation();
  const notificator = useNotificator();

  const edit: ChildrenProps["onEdit"] = useCallback(
    ({ emails, name }) => {
      mutation.mutate(
        {
          id,
          data: {
            name,
            config: {
              addresses: emails
            }
          }
        },
        {
          onSuccess: async () => {
            notificator.success("Notification channel saved!", { dataTestId: "notification-channel-edit-success-notification" });
            await queryClient.invalidateQueries({ queryKey: api.v1.listNotificationChannels.getKey() });
            onEditSuccess();
          },
          onError: () => notificator.error("Failed to save notification channel...", { dataTestId: "notification-channel-edit-error-notification" })
        }
      );
    },
    [mutation, id, notificator, queryClient, api, onEditSuccess]
  );

  return (
    <>
      {children({
        onEdit: edit,
        isLoading: mutation.isPending
      })}
    </>
  );
};
