"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { Server, StatsUpSquare, Wallet } from "iconoir-react";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";

type Props = {
  walletBalance: WalletBalance | null;
  activeDeploymentsCount: number;
  costPerMonth: number | null;
  costPerHour: number | null;
  isManagedWallet: boolean;
};

export const AccountStatsCards: React.FC<Props> = ({ walletBalance, activeDeploymentsCount, costPerMonth, costPerHour, isManagedWallet }) => {
  const { price } = usePricing();

  const aktBalance = uaktToAKT(walletBalance?.balanceUAKT || 0, 2);
  const aktBalanceUsd = aktBalance * (price || 0);
  const aktInDeployments = uaktToAKT(walletBalance?.totalDeploymentEscrowUAKT || 0, 2);

  const usdcBalance = udenomToDenom(walletBalance?.balanceUUSDC || 0, 2);
  const usdcInDeployments = udenomToDenom(walletBalance?.totalDeploymentEscrowUUSDC || 0, 2);

  return (
    <div className={`grid gap-6 ${isManagedWallet ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
      {isManagedWallet ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance</h3>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold leading-none">
                <FormattedNumber value={walletBalance?.totalUsd || 0} style="currency" currency="USD" />
              </p>
              <p className="text-sm text-muted-foreground">
                <FormattedNumber value={walletBalance?.totalDeploymentEscrowUSD || 0} style="currency" currency="USD" /> used in deployments
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance (AKT)</h3>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold leading-none">
                    <FormattedNumber value={aktBalance} maximumFractionDigits={2} />
                  </p>
                  <p className="text-sm text-muted-foreground">{aktInDeployments} AKT used in deployments</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <FormattedNumber value={aktBalanceUsd} style="currency" currency="USD" />
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance (USDC)</h3>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold leading-none">
                    <FormattedNumber value={usdcBalance} maximumFractionDigits={2} />
                  </p>
                  <p className="text-sm text-muted-foreground">{usdcInDeployments} USDC used in deployments</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <FormattedNumber value={usdcBalance} style="currency" currency="USD" />
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">Active Deployments</h3>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeDeploymentsCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">Total Cost</h3>
          <StatsUpSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold leading-none">
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
