"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { Server, StatsUpSquare, Wallet } from "iconoir-react";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

type Props = {
  walletBalance: WalletBalance | null;
  activeDeploymentsCount: number;
  costPerMonth: number | null;
  costPerHour: number | null;
};

export const AccountStatsCards: React.FC<Props> = ({ walletBalance, activeDeploymentsCount, costPerMonth, costPerHour }) => {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Available Balance</h3>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <FormattedNumber value={walletBalance?.totalUsd || 0} style="currency" currency="USD" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Active Deployments</h3>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeDeploymentsCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Total Cost</h3>
          <StatsUpSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold">
              <FormattedNumber value={costPerHour || 0} style="currency" currency="USD" /> / hour
            </p>
            <p className="text-sm text-muted-foreground">
              <FormattedNumber value={costPerMonth || 0} style="currency" currency="USD" /> / month
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
