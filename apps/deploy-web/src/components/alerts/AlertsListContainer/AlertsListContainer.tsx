"use client";

import type { FC, ReactNode } from "react";
import { useMemo } from "react";
import React from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

type Alert = components["schemas"]["AlertOutputResponse"]["data"];
type AlertsOutput = components["schemas"]["AlertListOutputResponse"]["data"][0];
type AlertsPagination = components["schemas"]["AlertListOutputResponse"]["pagination"];

export type ChildrenProps = {
  data: (AlertsOutput & { deploymentName: string })[];
  pagination: Pick<AlertsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  removingIds: Set<Alert["id"]>;
  onRemove: (id: Alert["id"]) => Promise<void>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
};

type AlertsListContainerProps = {
  children: (props: ChildrenProps) => ReactNode;
};

export const AlertsListContainer: FC<AlertsListContainerProps> = ({ children }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [removingIds, setRemovingIds] = React.useState<Set<Alert["id"]>>(new Set());
  const { notificationsApi } = useServices();
  const { data, isError, isLoading, refetch } = notificationsApi.v1.getAlerts.useQuery({
    query: {
      page,
      limit
    }
  });
  const mutation = notificationsApi.v1.deleteAlert.useMutation();
  const { getDeploymentName } = useLocalNotes();
  const notificator = useNotificator();

  const remove = useCallback(
    async (id: Alert["id"]) => {
      try {
        setRemovingIds(prev => new Set(prev).add(id));

        await mutation.mutateAsync({
          path: {
            id
          }
        });

        notificator.success("Alert removed", { dataTestId: "alert-remove-success-notification" });

        if (data?.data.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }
      } catch (error) {
        notificator.error("Failed to remove alert", {
          dataTestId: "alert-remove-error-notification"
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

  const changePage = useCallback(({ page, limit }: { page: number; limit: number }) => {
    setPage(page);
    setLimit(limit);
  }, []);

  const dataWithNames = useMemo(() => {
    return data?.data.map(item => ({
      ...item,
      deploymentName: (item.params?.dseq && getDeploymentName(item.params.dseq)) || "NA"
    }));
  }, [data?.data, getDeploymentName]);

  return (
    <>
      {children({
        pagination: {
          page,
          limit,
          total: data?.pagination.total ?? 0,
          totalPages: data?.pagination.totalPages ?? 0
        },
        data: dataWithNames || [],
        onPaginationChange: changePage,
        onRemove: remove,
        removingIds,
        isLoading,
        isError
      })}
    </>
  );
};
