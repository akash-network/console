"use client";

import type { FC, ReactNode } from "react";
import React, { useMemo } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import {
  Alert,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";

import { EditAlertContainer } from "@src/components/alerts/EditAlertContainer/EditAlertContainer";
import { WalletBalanceAlertForm } from "@src/components/alerts/WalletBalanceAlertForm/WalletBalanceAlertForm";
import { getDenomLabel } from "@src/utils/denomLabel";
import { udenomToDenom } from "@src/utils/mathHelpers";

export type WalletBalanceAlert = Extract<components["schemas"]["AlertListOutputResponse"]["data"][number], { type: "WALLET_BALANCE" }>;

export const DEPENDENCIES = { EditAlertContainer, WalletBalanceAlertForm };

/** Returns `null` for compound (and/or) conditions, since the single-threshold form would drop their other leaves on save. */
export function getWalletBalanceAlertInitialValues(alert: WalletBalanceAlert) {
  const condition = alert.conditions;
  if (!("field" in condition)) {
    return null;
  }
  const { decimals } = getDenomLabel(alert.params.denom);
  return {
    name: alert.name,
    notificationChannelId: alert.notificationChannelId,
    enabled: alert.enabled,
    operator: condition.operator,
    amount: udenomToDenom(condition.value, undefined, 10 ** decimals)
  };
}

type Props = {
  alert: WalletBalanceAlert;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const WalletBalanceAlertDialog: FC<Props> = ({ alert, onClose, dependencies: d = DEPENDENCIES }) => {
  const initialValues = useMemo(() => getWalletBalanceAlertInitialValues(alert), [alert]);

  if (!initialValues) {
    return (
      <AlertDialogFrame isSaving={false} onClose={onClose}>
        <DialogV2Body>
          <Alert variant="warning">
            This alert has several balance conditions, so it can&apos;t be edited here. To change it, delete it and create a new one.
          </Alert>
        </DialogV2Body>
        <DialogV2Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            OK
          </Button>
        </DialogV2Footer>
      </AlertDialogFrame>
    );
  }

  return (
    <d.EditAlertContainer id={alert.id} onEditSuccess={onClose}>
      {props => (
        <AlertDialogFrame isSaving={props.isLoading} onClose={onClose}>
          <d.WalletBalanceAlertForm
            initialValues={initialValues}
            owner={alert.params.owner}
            denom={alert.params.denom}
            isLoading={props.isLoading}
            onSubmit={props.onEdit}
            onCancel={onClose}
          />
        </AlertDialogFrame>
      )}
    </d.EditAlertContainer>
  );
};

const AlertDialogFrame: FC<{ isSaving: boolean; onClose: () => void; children: ReactNode }> = ({ isSaving, onClose, children }) => (
  <DialogV2 open onOpenChange={isOpen => !isOpen && !isSaving && onClose()}>
    <DialogV2Content className="max-w-xl">
      <DialogV2Header>
        <DialogV2Title>Edit wallet balance alert</DialogV2Title>
        <DialogV2Description>Choose when this alert fires and which channel it notifies.</DialogV2Description>
      </DialogV2Header>
      {children}
    </DialogV2Content>
  </DialogV2>
);
