"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

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
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.patchNotificationChannel.useMutation({
    path: {
      id
    }
  });
  const notificator = useNotificator();

  const edit: ChildrenProps["onEdit"] = useCallback(
    ({ emails, name }) => {
      mutation.mutate({
        data: {
          name,
          config: {
            addresses: emails
          }
        }
      });
    },
    [mutation]
  );

  useWhen(
    mutation.isSuccess,
    () => {
      notificator.success("Notification channel saved!", { dataTestId: "notification-channel-edit-success-notification" });
      onEditSuccess();
    },
    [mutation.isSuccess, notificator, onEditSuccess]
  );

  useWhen(mutation.isError, () => notificator.error("Failed to save notification channel...", { dataTestId: "notification-channel-edit-error-notification" }));

  return (
    <>
      {children({
        onEdit: edit,
        isLoading: mutation.isPending
      })}
    </>
  );
};
