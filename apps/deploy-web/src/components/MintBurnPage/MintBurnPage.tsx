"use client";
import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Button, Card, CardContent, Separator, Snackbar, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { ArrowDown, NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { denomToUdenom, roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";

export enum MintBurnTab {
  MINT = "mint",
  BURN = "burn"
}

export const PRESET_AMOUNTS = [25, 50, 100] as const;

export const DEPENDENCIES = {
  Layout,
  Title,
  Card,
  CardContent,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
  Alert,
  Snackbar,
  Link,
  ArrowDown,
  NavArrowLeft,
  FormattedNumber,
  useWallet,
  usePricing,
  useWalletBalance,
  useSnackbar
};

interface MintBurnPageProps {
  dependencies?: typeof DEPENDENCIES;
}

export const MintBurnPage: React.FC<MintBurnPageProps> = ({ dependencies: d = DEPENDENCIES }) => {
  const [activeTab, setActiveTab] = useState<MintBurnTab>(MintBurnTab.MINT);
  const [targetAmount, setTargetAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(100);
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { address, signAndBroadcastTx } = d.useWallet();
  const { balance, isLoading: isBalanceLoading, refetch: refetchBalance } = d.useWalletBalance();
  const { price, isLoaded: isPriceLoaded } = d.usePricing();
  const { enqueueSnackbar } = d.useSnackbar();

  const aktBalance = useMemo(() => (balance ? uaktToAKT(balance.balanceUAKT, 6) : 0), [balance]);
  const actBalance = useMemo(() => (balance ? udenomToDenom(balance.balanceUACT, 6) : 0), [balance]);
  const aktUsdValue = useMemo(() => (price ? roundDecimal(aktBalance * price, 2) : 0), [aktBalance, price]);
  const actUsdValue = useMemo(() => roundDecimal(actBalance, 2), [actBalance]);

  const isMint = activeTab === MintBurnTab.MINT;

  const effectiveAmount = useMemo(() => {
    if (!isCustom && selectedPreset) return selectedPreset;
    const val = parseFloat(targetAmount);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [isCustom, selectedPreset, targetAmount]);

  const computedFrom = useMemo(() => {
    if (!effectiveAmount || !price) return 0;
    return isMint ? roundDecimal(effectiveAmount / price, 6) : effectiveAmount;
  }, [effectiveAmount, price, isMint]);

  const computedTo = useMemo(() => {
    if (!effectiveAmount || !price) return 0;
    return isMint ? effectiveAmount : roundDecimal(effectiveAmount * price, 6);
  }, [effectiveAmount, price, isMint]);

  const maxAmount = useMemo(() => {
    if (isMint) {
      return price ? roundDecimal(aktBalance * price, 2) : 0;
    }
    return roundDecimal(actBalance, 2);
  }, [isMint, aktBalance, actBalance, price]);

  const insufficientBalance = effectiveAmount > maxAmount;

  const resetForm = useCallback(() => {
    setTargetAmount("");
    setSelectedPreset(100);
    setIsCustom(false);
  }, []);

  const handlePresetClick = useCallback((amount: number) => {
    setSelectedPreset(amount);
    setIsCustom(false);
    setTargetAmount(amount.toString());
  }, []);

  const handleCustomClick = useCallback(() => {
    setSelectedPreset(null);
    setIsCustom(true);
    setTargetAmount("");
  }, []);

  const handleMaxClick = useCallback(() => {
    setSelectedPreset(null);
    setIsCustom(true);
    setTargetAmount(maxAmount.toString());
  }, [maxAmount]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as MintBurnTab);
      resetForm();
    },
    [resetForm]
  );

  const handleSubmit = useCallback(async () => {
    if (!address || !effectiveAmount || insufficientBalance) return;

    setIsSubmitting(true);
    try {
      const msg = isMint
        ? TransactionMessageData.getMintACTMsg(address, denomToUdenom(computedFrom), UAKT_DENOM)
        : TransactionMessageData.getBurnACTMsg(address, denomToUdenom(effectiveAmount));

      const success = await signAndBroadcastTx([msg]);

      if (success) {
        enqueueSnackbar(<d.Snackbar title={isMint ? "ACT minted successfully!" : "ACT burned successfully!"} iconVariant="success" />, {
          variant: "success",
          autoHideDuration: 5_000
        });
        refetchBalance();
        resetForm();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [address, effectiveAmount, insufficientBalance, isMint, computedFrom, signAndBroadcastTx, enqueueSnackbar, refetchBalance, resetForm, d]);

  return (
    <d.Layout>
      <div className="mx-auto max-w-lg py-6">
        <d.Link href={UrlService.home()} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <d.NavArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </d.Link>

        <d.Title className="mb-2">Mint & Burn</d.Title>
        <p className="mb-6 text-sm text-muted-foreground">
          Convert between AKT and ACT (Akash Compute Token). ACT is a USD-pegged token used to pay for deployments. Mint ACT by burning AKT at the current oracle
          rate, or burn unused ACT to redeem AKT. ACT has no expiration and is fully refundable.
        </p>

        <d.Card className="mb-6">
          <d.CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">Your Balances</h3>
            <d.Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">AKT</span>
              <div className="text-right">
                <span className="text-sm" data-testid="akt-balance">
                  {roundDecimal(aktBalance, 2)} AKT
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {/* eslint-disable-next-line react/style-prop-object */}
                  (<d.FormattedNumber value={aktUsdValue} style="currency" currency="USD" />)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ACT</span>
              <div className="text-right">
                <span className="text-sm" data-testid="act-balance">
                  {roundDecimal(actBalance, 2)} ACT
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {/* eslint-disable-next-line react/style-prop-object */}
                  (<d.FormattedNumber value={actUsdValue} style="currency" currency="USD" />)
                </span>
              </div>
            </div>
          </d.CardContent>
        </d.Card>

        <d.Tabs value={activeTab} onValueChange={handleTabChange}>
          <d.TabsList className="mb-4 grid w-full grid-cols-2">
            <d.TabsTrigger value={MintBurnTab.MINT}>Mint ACT</d.TabsTrigger>
            <d.TabsTrigger value={MintBurnTab.BURN}>Burn ACT</d.TabsTrigger>
          </d.TabsList>
        </d.Tabs>

        <d.Card className="mb-4">
          <d.CardContent className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <span className="text-sm tabular-nums" data-testid="from-amount">
                  {computedFrom ? roundDecimal(computedFrom, 6) : "0.00"}
                </span>
                <span className="text-sm font-medium" data-testid="from-denom">
                  {isMint ? "AKT" : "ACT"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Balance: {isMint ? `${roundDecimal(aktBalance, 2)} AKT` : `${roundDecimal(actBalance, 2)} ACT`}</span>
                <button type="button" className="font-medium text-primary hover:underline" onClick={handleMaxClick} data-testid="max-button">
                  MAX
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <d.ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <span className="text-sm tabular-nums" data-testid="to-amount">
                  {computedTo ? roundDecimal(computedTo, 6) : "0.00"}
                </span>
                <span className="text-sm font-medium" data-testid="to-denom">
                  {isMint ? "ACT" : "AKT"}
                </span>
              </div>
              {isPriceLoaded && price && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="rate-display">
                  Rate: 1 ACT = $1.00 ({roundDecimal(1 / price, 4)} AKT)
                </p>
              )}
            </div>
          </d.CardContent>
        </d.Card>

        <div className="mb-4 flex gap-2">
          {PRESET_AMOUNTS.map(amount => (
            <d.Button
              key={amount}
              variant={selectedPreset === amount && !isCustom ? "default" : "outline"}
              className="flex-1"
              onClick={() => handlePresetClick(amount)}
              data-testid={`preset-${amount}`}
            >
              ${amount}
            </d.Button>
          ))}
          <d.Button variant={isCustom ? "default" : "outline"} className="flex-1" onClick={handleCustomClick} data-testid="preset-custom">
            Custom
          </d.Button>
        </div>

        {isCustom && (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-muted-foreground">{isMint ? "Amount (USD)" : "Amount (ACT)"}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder={isMint ? "Enter USD amount" : "Enter ACT amount"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="custom-amount-input"
            />
          </div>
        )}

        {insufficientBalance && effectiveAmount > 0 && (
          <d.Alert variant="destructive" className="mb-4" data-testid="insufficient-balance-alert">
            <p className="text-sm">
              Insufficient {isMint ? "AKT" : "ACT"} balance. You need{" "}
              {isMint ? `${roundDecimal(computedFrom, 6)} AKT` : `${roundDecimal(effectiveAmount, 2)} ACT`} but only have{" "}
              {isMint ? `${roundDecimal(aktBalance, 2)} AKT` : `${roundDecimal(actBalance, 2)} ACT`}.
            </p>
          </d.Alert>
        )}

        <d.Alert className="mb-4">
          <p className="text-sm">ACT is USD-pegged and used only for deployments. Conversion is instant and on-chain.</p>
        </d.Alert>

        <d.Button
          className="w-full"
          size="lg"
          disabled={!effectiveAmount || insufficientBalance || isSubmitting || isBalanceLoading || !isPriceLoaded}
          onClick={handleSubmit}
          data-testid="submit-button"
        >
          {isSubmitting ? "Processing..." : isMint ? "Mint ACT" : "Burn ACT"}
        </d.Button>
      </div>
    </d.Layout>
  );
};
