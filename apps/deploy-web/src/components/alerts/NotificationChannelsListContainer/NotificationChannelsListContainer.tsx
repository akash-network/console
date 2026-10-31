"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useEffect } from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];
export type NotificationChannelsOutput = components["schemas"]["NotificationChannelListOutput"]["data"];
type NotificationChannelsPagination = components["schemas"]["NotificationChannelListOutput"]["pagination"];

export type RemoveNotificationChannelResult = "removed" | "in-use" | "failed";

export type ChildrenProps = {
  data: NotificationChannelsOutput;
  pagination: Pick<NotificationChannelsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  isFetched: boolean;
  removingIds: Set<NotificationChannel["id"]>;
  onRemove: (id: NotificationChannel["id"]) => Promise<RemoveNotificationChannelResult>;
  onResendConfirmation: (id: NotificationChannel["id"], address: string) => Promise<void>;
  isResendingConfirmation: boolean;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
  refetch: () => void;
};

type NotificationChannelsListContainerProps = {
  onFetched?: (data: NotificationChannelsOutput) => void;
  children: (props: ChildrenProps) => ReactNode;
};

const CHANNEL_IN_USE_ERROR = "Cannot delete notification channel with alerts";

function isTooManyRequestsError(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

export const NotificationChannelsListContainer: FC<NotificationChannelsListContainerProps> = ({ onFetched, children }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [removingIds, setRemovingIds] = React.useState<Set<NotificationChannel["id"]>>(new Set());
  const { api } = useServices();
  const { data, isError, isLoading, isFetched, refetch } = api.v1.listNotificationChannels.useQuery({ page, limit });
  const mutation = api.v1.deleteNotificationChannel.useMutation();
  const confirmationEmailMutation = api.v1.createNotificationChannelConfirmationEmail.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
  const notificator = useNotificator();

  const remove = useCallback(
    async (id: NotificationChannel["id"]): Promise<RemoveNotificationChannelResult> => {
      try {
        setRemovingIds(prev => new Set(prev).add(id));

        await mutation.mutateAsync({ id });

        notificator.success("Notification channel removed", { dataTestId: "notification-channel-remove-success-notification" });

        if (data?.data.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }

        return "removed";
      } catch (error) {
        if (extractApiErrorMessage(error) === CHANNEL_IN_USE_ERROR) {
          return "in-use";
        }

        notificator.error("Failed to remove notification channel", {
          dataTestId: "notification-channel-remove-error-notification"
        });
        return "failed";
      } finally {
        setRemovingIds(prev => {
          const nextSet = new Set(prev);
          nextSet.delete(id);
          return nextSet;
        });
      }
    },
    [mutation, data?.data.length, page, refetch, notificator]
  );

  const resendConfirmation = useCallback(
    async (id: NotificationChannel["id"], address: string) => {
      try {
        await confirmationEmailMutation.mutateAsync({ id, data: { address } });
        notificator.success(`Confirmation email sent to ${address}`, { dataTestId: "notification-channel-confirmation-sent-notification" });
      } catch (error) {
        notificator.error(
          isTooManyRequestsError(error) ? "Too many confirmation emails were sent today. Try again tomorrow." : "Failed to send the confirmation email",
          { dataTestId: "notification-channel-confirmation-error-notification" }
        );
      }
    },
    [confirmationEmailMutation, notificator]
  );

  useEffect(() => {
    if (onFetched && isFetched && data?.data) {
      onFetched(data.data);
    }
  }, [data?.data, isFetched, onFetched]);

  const changePage = useCallback(({ page, limit }: { page: number; limit: number }) => {
    setPage(page);
    setLimit(limit);
  }, []);

  return (
    <>
      {children({
        pagination: {
          page,
          limit,
          total: data?.pagination.total ?? 0,
          totalPages: data?.pagination.totalPages ?? 0
        },
        data: data?.data || [],
        onPaginationChange: changePage,
        onRemove: remove,
        onResendConfirmation: resendConfirmation,
        isResendingConfirmation: confirmationEmailMutation.isPending,
        refetch,
        removingIds,
        isLoading,
        isFetched,
        isError
      })}
    </>
  );
};
