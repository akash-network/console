"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import type { ContactPointsListViewProps } from "@src/components/alerts/ContactPointsListView/ContactPointsListView";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

export type ContactPoint = components["schemas"]["ContactPointOutput"]["data"];

type ContactPointsListContainerProps = {
  children: (props: ContactPointsListViewProps) => ReactNode;
  onEdit: (id: ContactPoint["id"]) => void;
};

export const ContactPointsListContainer: FC<ContactPointsListContainerProps> = ({ children, onEdit }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [contactPointIdToRemove, setContactPointIdToRemove] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { notificationsApi } = useServices();
  const { data, isError, isLoading, refetch } = notificationsApi.v1.getContactPoints.useQuery({
    query: {
      page,
      limit
    }
  });
  const mutation = notificationsApi.v1.deleteContactPoint.useMutation();
  const notificator = useNotificator();

  const handleRemove = useCallback(() => {
    setIsRemoving(true);
    mutation.mutate({
      path: {
        id: contactPointIdToRemove
      }
    });
  }, [mutation, contactPointIdToRemove]);

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPage(page + 1);
    setLimit(pageSize);
  }, []);

  useWhen(mutation.isError, () => {
    notificator.error("Failed to remove contact point", { dataTestId: "contact-point-remove-error-notification" });
    setIsRemoving(false);
  });

  useWhen(mutation.isSuccess, () => {
    notificator.success("Contact point removed", { dataTestId: "contact-point-remove-success-notification" });

    if (data?.data.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      refetch();
    }

    setContactPointIdToRemove(null);
    setIsRemoving(false);
  });

  return (
    <>
      {children({
        data: data?.data || [],
        pagination: {
          page,
          limit,
          total: data?.pagination.total ?? 0,
          totalPages: data?.pagination.totalPages ?? 0
        },
        onPageChange: handlePageChange,
        isLoading,
        isError,
        onEdit,
        isRemoving,
        contactPointIdToRemove,
        onRemoveStart: setContactPointIdToRemove,
        onRemoveCancel: () => setContactPointIdToRemove(null),
        onRemoveConfirm: handleRemove
      })}
    </>
  );
};
