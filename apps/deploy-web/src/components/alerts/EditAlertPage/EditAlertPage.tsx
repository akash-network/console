import type { FC } from "react";
import React, { useCallback, useMemo } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
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
import { UrlService } from "@src/utils/urlUtils";

type Alert = components["schemas"]["AlertOutputResponse"]["data"];
export type WalletBalanceAlert = Extract<Alert, { type: "WALLET_BALANCE" }>;
type BalanceConditions = WalletBalanceAlert["conditions"];

type Props = {
  alert: WalletBalanceAlert;
};

/** Reads the operator and base-unit threshold from a balance condition, using the first leaf of a compound (and/or) condition. */
function extractBalanceThreshold(conditions: BalanceConditions): { operator: "eq" | "lt" | "gt" | "lte" | "gte"; value: number } {
  if ("field" in conditions) {
    return { operator: conditions.operator, value: conditions.value };
  }
  const [first] = conditions.value;
  return { operator: first.operator, value: first.value };
}

export function getWalletBalanceAlertInitialValues(alert: WalletBalanceAlert) {
  const { decimals } = getDenomLabel(alert.params.denom);
  const { operator, value } = extractBalanceThreshold(alert.conditions);
  return {
    name: alert.name,
    notificationChannelId: alert.notificationChannelId,
    enabled: alert.enabled,
    operator,
    amount: value / 10 ** decimals
  };
}

export const EditAlertPage: FC<Props> = ({ alert }) => {
  const goBack = useBackNav(UrlService.alerts());
  const navGuard = useNavigationGuard();
  const saveNavStateAndGoBack = useCallback(() => {
    navGuard.toggle({ hasChanges: false });
    goBack();
  }, [goBack, navGuard]);

  const initialValues = useMemo(() => getWalletBalanceAlertInitialValues(alert), [alert]);

  return (
    <Layout containerClassName="flex h-full flex-col">
      <NextSeo title="Edit Wallet Balance Alert" />
      <div className="flex flex-wrap items-center px-6 py-6">
        <Link href={UrlService.alerts()} type="button" className="p-2">
          <NavArrowLeft />
        </Link>
        <Title>Edit Wallet Balance Alert</Title>
      </div>
      <EditAlertContainer id={alert.id} onEditSuccess={saveNavStateAndGoBack}>
        {props => (
          <WalletBalanceAlertForm
            initialValues={initialValues}
            owner={alert.params.owner}
            denom={alert.params.denom}
            isLoading={props.isLoading}
            onSubmit={props.onEdit}
            onCancel={goBack}
            onStateChange={navGuard.toggle}
          />
        )}
      </EditAlertContainer>
    </Layout>
  );
};
