"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import type { ContactPointsListViewProps } from "@src/components/alerts/ContactPointsListView/ContactPointsListView";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

export type ContactPoint = components["schemas"]["ContactPointOutput"]["data"];

type ContactPointsListContainerProps = {
  children: (props: ContactPointsListViewProps) => ReactNode;
};

export const ContactPointsListContainer: FC<ContactPointsListContainerProps> = ({ children }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [removingIds, setRemovingIds] = React.useState<Set<ContactPoint["id"]>>(new Set());
  const { notificationsApi } = useServices();
  const { data, isError, isLoading, refetch } = notificationsApi.v1.getContactPoints.useQuery({
    query: {
      page,
      limit
    }
  });
  const mutation = notificationsApi.v1.deleteContactPoint.useMutation();
  const notificator = useNotificator();

  const remove = useCallback(
    async (id: ContactPoint["id"]) => {
      try {
        setRemovingIds(prev => new Set(prev).add(id));

        await mutation.mutateAsync({
          path: {
            id
          }
        });

        notificator.success("Contact point removed", { dataTestId: "contact-point-remove-success-notification" });

        if (data?.data.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }
      } catch (error) {
        notificator.error("Failed to remove contact point", {
          dataTestId: "contact-point-remove-error-notification"
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

  const changePage = useCallback((page: number, pageSize: number) => {
    setPage(page + 1);
    setLimit(pageSize);
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
        onPageChange: changePage,
        onRemove: remove,
        removingIds,
        isLoading,
        isError
      })}
    </>
  );
};
