"use client";
import React, { useMemo } from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { Server, StatsUpSquare, Wallet } from "iconoir-react";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";

export const DEPENDENCIES = {
  Card,
  CardContent,
  CardHeader,
  Server,
  StatsUpSquare,
  Wallet,
  FormattedNumber,
  usePricing
};

type Props = {
  walletBalance: WalletBalance | null;
  activeDeploymentsCount: number;
  costPerMonth: number | undefined | null;
  costPerHour: number | undefined | null;
  isManagedWallet: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const AccountStatsCards: React.FC<Props> = ({
  walletBalance,
  activeDeploymentsCount,
  costPerMonth,
  costPerHour,
  isManagedWallet,
  dependencies: d = DEPENDENCIES
}) => {
  const { price } = d.usePricing();

  const aktBalance = udenomToDenom(walletBalance?.balanceUAKT || 0, 2);
  const aktBalanceUsd = aktBalance * (price || 0);
  const aktInDeployments = udenomToDenom(walletBalance?.totalDeploymentEscrowUAKT || 0, 2);

  const usdBalance = useMemo(() => {
    if (isManagedWallet) {
      return {
        total: walletBalance?.totalUsd || 0,
        inDeployments: walletBalance?.totalDeploymentEscrowUSD || 0,
        denom: "USD"
      };
    }

    return {
      total: udenomToDenom(walletBalance?.balanceUACT || 0, 2),
      inDeployments: udenomToDenom(walletBalance?.totalDeploymentEscrowUACT || 0, 2),
      denom: "ACT"
    };
  }, [walletBalance, isManagedWallet]);

  return (
    <div className={`grid gap-6 ${isManagedWallet ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {isManagedWallet ? (
        <d.Card>
          <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance</h3>
            <d.Wallet className="h-4 w-4 text-muted-foreground" />
          </d.CardHeader>
          <d.CardContent>
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold leading-none">
                <d.FormattedNumber value={usdBalance.total} style="currency" currency={usdBalance.denom} />
              </p>
              <p className="text-sm text-muted-foreground">
                <d.FormattedNumber value={usdBalance.inDeployments} style="currency" currency={usdBalance.denom} /> used in deployments
              </p>
            </div>
          </d.CardContent>
        </d.Card>
      ) : (
        <>
          <d.Card>
            <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance ({usdBalance.denom})</h3>
              <d.Wallet className="h-4 w-4 text-muted-foreground" />
            </d.CardHeader>
            <d.CardContent>
              <div className="flex items-baseline justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold leading-none">
                    <d.FormattedNumber value={usdBalance.total} maximumFractionDigits={2} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {usdBalance.inDeployments} {usdBalance.denom} used in deployments
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <d.FormattedNumber value={usdBalance.total} style="currency" currency="USD" />
                </p>
              </div>
            </d.CardContent>
          </d.Card>
          <d.Card>
            <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance (AKT)</h3>
              <d.Wallet className="h-4 w-4 text-muted-foreground" />
            </d.CardHeader>
            <d.CardContent>
              <div className="flex items-baseline justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold leading-none">
                    <d.FormattedNumber value={aktBalance} maximumFractionDigits={2} />
                  </p>
                  <p className="text-sm text-muted-foreground">{aktInDeployments} AKT used in deployments</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <d.FormattedNumber value={aktBalanceUsd} style="currency" currency="USD" />
                </p>
              </div>
            </d.CardContent>
          </d.Card>
        </>
      )}

      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">Active Deployments</h3>
          <d.Server className="h-4 w-4 text-muted-foreground" />
        </d.CardHeader>
        <d.CardContent>
          <div className="text-2xl font-bold">{activeDeploymentsCount}</div>
        </d.CardContent>
      </d.Card>

      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">Total Cost</h3>
          <d.StatsUpSquare className="h-4 w-4 text-muted-foreground" />
        </d.CardHeader>
        <d.CardContent>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold leading-none">
              <d.FormattedNumber value={costPerHour || 0} style="currency" currency="USD" /> / hour
            </p>
            <p className="text-sm text-muted-foreground">
              <d.FormattedNumber value={costPerMonth || 0} style="currency" currency="USD" /> / month
            </p>
          </div>
        </d.CardContent>
      </d.Card>
    </div>
  );
};
