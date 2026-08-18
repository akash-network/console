import type { FC } from "react";
import React, { useCallback, useMemo } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { Alert } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { EditAlertContainer } from "@src/components/alerts/EditAlertContainer/EditAlertContainer";
import { WalletBalanceAlertForm } from "@src/components/alerts/WalletBalanceAlertForm/WalletBalanceAlertForm";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useBackNav } from "@src/hooks/useBackNav";
import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";
import { getDenomLabel } from "@src/utils/denomLabel";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";

export type WalletBalanceAlert = Extract<components["schemas"]["AlertOutputResponse"]["data"], { type: "WALLET_BALANCE" }>;

export const DEPENDENCIES = { Layout, EditAlertContainer, WalletBalanceAlertForm, useBackNav, useNavigationGuard };

/**
 * Maps a single-threshold balance alert to form values. Returns `null` for compound (and/or) conditions:
 * this form can only represent one threshold, so editing such an alert would drop its other leaves on save.
 */
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
  dependencies?: typeof DEPENDENCIES;
};

export const EditAlertPage: FC<Props> = ({ alert, dependencies: d = DEPENDENCIES }) => {
  const goBack = d.useBackNav(UrlService.alerts());
  const navGuard = d.useNavigationGuard();
  const saveNavStateAndGoBack = useCallback(() => {
    navGuard.toggle({ hasChanges: false });
    goBack();
  }, [goBack, navGuard]);

  const initialValues = useMemo(() => getWalletBalanceAlertInitialValues(alert), [alert]);

  return (
    <d.Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Wallet Balance Alert" />
      <div className="flex flex-wrap items-center px-6 py-6">
        <Link href={UrlService.alerts()} type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Wallet Balance Alert</Title>
      </div>
      {initialValues ? (
        <d.EditAlertContainer id={alert.id} onEditSuccess={saveNavStateAndGoBack}>
          {props => (
            <d.WalletBalanceAlertForm
              initialValues={initialValues}
              owner={alert.params.owner}
              denom={alert.params.denom}
              isLoading={props.isLoading}
              onSubmit={props.onEdit}
              onCancel={goBack}
              onStateChange={navGuard.toggle}
            />
          )}
        </d.EditAlertContainer>
      ) : (
        <div className="max-w-xl p-6">
          <Alert variant="warning" data-testid="compound-condition-notice">
            This alert has multiple balance conditions and cannot be edited here. To change it, delete this alert and create a new one.
          </Alert>
        </div>
      )}
    </d.Layout>
  );
};
