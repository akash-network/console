"use client";

import type { ReactNode } from "react";
import { type FC, useCallback, useState } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

export type ContactPoint = components["schemas"]["ContactPointOutput"]["data"];
export type ContactPointsInput = components["schemas"]["ContactPointListOutput"]["data"];

export type ContactPointsListViewProps = {
  data: ContactPointsInput;
  totalCount: number;
  page: number;
  limit: number;
  isLoading: boolean;
  edit: (id: ContactPoint["id"]) => void;
  remove: (id: ContactPoint["id"]) => void;
  onPageChange: (page: number, limit: number) => void;
  isError: boolean;
};

type ContactPointsListContainerProps = {
  children: (props: ContactPointsListViewProps) => ReactNode;
  edit: (id: ContactPoint["id"]) => void;
};

export const ContactPointsListContainer: FC<ContactPointsListContainerProps> = ({ children, edit }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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
    (id: ContactPoint["id"]) => {
      mutation.mutate({
        path: {
          id
        }
      });
    },
    [mutation]
  );

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPage(page + 1);
    setLimit(pageSize);
  }, []);

  useWhen(mutation.isError, () => {
    notificator.error("Failed to remove contact point", { dataTestId: "contact-point-remove-error-notification" });
  });

  useWhen(mutation.isSuccess, () => {
    notificator.success("Contact point removed", { dataTestId: "contact-point-remove-success-notification" });
    refetch();
  });

  return (
    <>
      {children({
        data: data?.data || [],
        totalCount: data?.pagination.total || 0,
        page,
        limit,
        onPageChange: handlePageChange,
        isLoading,
        isError,
        edit,
        remove
      })}
    </>
  );
};
