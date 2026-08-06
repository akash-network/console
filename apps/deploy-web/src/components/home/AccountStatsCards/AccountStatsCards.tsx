"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { Server, StatsUpSquare, Wallet } from "iconoir-react";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

export const DEPENDENCIES = {
  Card,
  CardContent,
  CardHeader,
  Server,
  StatsUpSquare,
  Wallet,
  FormattedNumber
};

type Props = {
  walletBalance: WalletBalance | null;
  activeDeploymentsCount: number;
  costPerMonth: number | undefined | null;
  costPerHour: number | undefined | null;
  dependencies?: typeof DEPENDENCIES;
};

export const AccountStatsCards: React.FC<Props> = ({ walletBalance, activeDeploymentsCount, costPerMonth, costPerHour, dependencies: d = DEPENDENCIES }) => {
  const totalUsdBalance = walletBalance?.totalUsd || 0;
  const usdInDeployments = walletBalance?.totalDeploymentEscrowUSD || 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance</h3>
          <d.Wallet className="h-4 w-4 text-muted-foreground" />
        </d.CardHeader>
        <d.CardContent>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold leading-none">
              <d.FormattedNumber value={totalUsdBalance} style="currency" currency="USD" />
            </p>
            <p className="text-sm text-muted-foreground">
              <d.FormattedNumber value={usdInDeployments} style="currency" currency="USD" /> used in deployments
            </p>
          </div>
        </d.CardContent>
      </d.Card>

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
