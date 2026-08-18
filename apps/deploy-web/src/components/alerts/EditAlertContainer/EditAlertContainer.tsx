"use client";

import type { FC, ReactNode } from "react";
import React, { useCallback } from "react";

import type { WalletBalanceAlertFormValues } from "@src/components/alerts/WalletBalanceAlertForm/WalletBalanceAlertForm";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

export type ChildrenProps = {
  onEdit: (input: WalletBalanceAlertFormValues) => void;
  isLoading: boolean;
};

type EditAlertContainerProps = {
  id: string;
  children: (props: ChildrenProps) => ReactNode;
  onEditSuccess: () => void;
};

export const EditAlertContainer: FC<EditAlertContainerProps> = ({ id, children, onEditSuccess }) => {
  const { api } = useServices();
  const mutation = api.v1.updateAlert.useMutation();
  const notificator = useNotificator();

  const edit: ChildrenProps["onEdit"] = useCallback(
    input => {
      mutation.mutate({ id, data: input });
    },
    [mutation, id]
  );

  useWhen(
    mutation.isSuccess,
    () => {
      notificator.success("Alert saved!", { dataTestId: "alert-edit-success-notification" });
      onEditSuccess();
    },
    [mutation.isSuccess, notificator, onEditSuccess]
  );

  useWhen(mutation.isError, () => notificator.error("Failed to save alert...", { dataTestId: "alert-edit-error-notification" }));

  return <>{children({ onEdit: edit, isLoading: mutation.isPending })}</>;
};
