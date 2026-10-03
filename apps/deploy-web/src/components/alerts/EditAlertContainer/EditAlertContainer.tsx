"use client";

import type { FC, ReactNode } from "react";
import React, { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { WalletBalanceAlertFormValues } from "@src/components/alerts/WalletBalanceAlertForm/WalletBalanceAlertForm";
import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";

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
  const queryClient = useQueryClient();
  const mutation = api.v1.updateAlert.useMutation();
  const notificator = useNotificator();

  const edit: ChildrenProps["onEdit"] = useCallback(
    input => {
      mutation.mutate(
        { id, data: input },
        {
          onSuccess: async () => {
            notificator.success("Alert saved!", { dataTestId: "alert-edit-success-notification" });
            await queryClient.invalidateQueries({ queryKey: api.v1.listAlerts.getKey() });
            onEditSuccess();
          },
          onError: () => notificator.error("Failed to save alert...", { dataTestId: "alert-edit-error-notification" })
        }
      );
    },
    [mutation, id, notificator, queryClient, api, onEditSuccess]
  );

  return <>{children({ onEdit: edit, isLoading: mutation.isPending })}</>;
};
