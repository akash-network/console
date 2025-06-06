"use client";

import type { FC, ReactNode } from "react";
import { useEffect } from "react";
import React from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

type ContactPoint = components["schemas"]["ContactPointOutput"]["data"];
export type ContactPointsOutput = components["schemas"]["ContactPointListOutput"]["data"];
type ContactPointsPagination = components["schemas"]["ContactPointListOutput"]["pagination"];

export type ChildrenProps = {
  data: ContactPointsOutput;
  pagination: Pick<ContactPointsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  isFetched: boolean;
  removingIds: Set<ContactPoint["id"]>;
  onRemove: (id: ContactPoint["id"]) => Promise<void>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
  refetch: () => void;
};

type ContactPointsListContainerProps = {
  onFetched?: (data: ContactPointsOutput) => void;
  children: (props: ChildrenProps) => ReactNode;
};

export const ContactPointsListContainer: FC<ContactPointsListContainerProps> = ({ onFetched, children }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [removingIds, setRemovingIds] = React.useState<Set<ContactPoint["id"]>>(new Set());
  const { notificationsApi } = useServices();
  const { data, isError, isLoading, isFetched, refetch } = notificationsApi.v1.getContactPoints.useQuery({
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
