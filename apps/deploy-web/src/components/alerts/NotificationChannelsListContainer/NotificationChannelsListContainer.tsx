"use client";

import type { FC, ReactNode } from "react";
import { useEffect } from "react";
import React from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];
export type NotificationChannelsOutput = components["schemas"]["NotificationChannelListOutput"]["data"];
type NotificationChannelsPagination = components["schemas"]["NotificationChannelListOutput"]["pagination"];

export type ChildrenProps = {
  data: NotificationChannelsOutput;
  pagination: Pick<NotificationChannelsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  isFetched: boolean;
  removingIds: Set<NotificationChannel["id"]>;
  onRemove: (id: NotificationChannel["id"]) => Promise<void>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
  refetch: () => void;
};

type NotificationChannelsListContainerProps = {
  onFetched?: (data: NotificationChannelsOutput) => void;
  children: (props: ChildrenProps) => ReactNode;
};

export const NotificationChannelsListContainer: FC<NotificationChannelsListContainerProps> = ({ onFetched, children }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [removingIds, setRemovingIds] = React.useState<Set<NotificationChannel["id"]>>(new Set());
  const { notificationsApi } = useServices();
  const { data, isError, isLoading, isFetched, refetch } = notificationsApi.v1.getNotificationChannels.useQuery({
    query: {
      page,
      limit
    }
  });
  const mutation = notificationsApi.v1.deleteNotificationChannel.useMutation();
  const notificator = useNotificator();

  const remove = useCallback(
    async (id: NotificationChannel["id"]) => {
      try {
        setRemovingIds(prev => new Set(prev).add(id));

        await mutation.mutateAsync({
          path: {
            id
          }
        });

        notificator.success("Notification channel removed", { dataTestId: "notification-channel-remove-success-notification" });

        if (data?.data.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }
      } catch (error) {
        notificator.error("Failed to remove notification channel", {
          dataTestId: "notification-channel-remove-error-notification"
        });
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
        refetch,
        removingIds,
        isLoading,
        isFetched,
        isError
      })}
    </>
  );
};
