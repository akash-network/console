"use client";
import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Button, Card, CardContent, Input, Separator, Snackbar } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useBalanceWatch } from "@src/context/BalanceWatchProvider";
import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import FourOhFour from "@src/pages/404";
import { denomToUdenom, roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
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
  Input,
  Separator,
  Button,
  Alert,
  Snackbar,
  Link,
  ArrowUpDown,
  NavArrowLeft,
  FormattedNumber,
  useBalanceWatch,
  useWallet,
  usePricing,
  useWalletBalance,
  useSnackbar,
  useSupportsACT
};

interface MintBurnPageProps {
  dependencies?: typeof DEPENDENCIES;
}

export const MintBurnPage: React.FC<MintBurnPageProps> = ({ dependencies: d = DEPENDENCIES }) => {
  const [activeTab, setActiveTab] = useState(MintBurnTab.MINT);
  const [amount, setAmount] = useState("100");
  const [denom, setDenom] = useState<"AKT" | "ACT">("ACT");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { address, signAndBroadcastTx, isCustodial } = d.useWallet();
  const { balance, isLoading: isBalanceLoading } = d.useWalletBalance();
  const { price, isLoaded: isPriceLoaded } = d.usePricing();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const balanceWatch = d.useBalanceWatch();

  const aktBalance = useMemo(() => (balance ? udenomToDenom(balance.balanceUAKT, 6) : 0), [balance]);
  const actBalance = useMemo(() => (balance ? udenomToDenom(balance.balanceUACT, 6) : 0), [balance]);

  const isMint = activeTab === MintBurnTab.MINT;

  const effectiveAmount = useMemo(() => {
    const val = parseFloat(amount);
    return Number.isNaN(val) || val < 0 ? 0 : val;
  }, [amount]);

  const aktDisplay = useMemo(() => {
    if (denom === "AKT") return amount;
    return price && effectiveAmount ? roundDecimal(effectiveAmount / price, 6).toString() : "";
  }, [denom, amount, effectiveAmount, price]);

  const actDisplay = useMemo(() => {
    if (denom === "ACT") return amount;
    return price && effectiveAmount ? roundDecimal(effectiveAmount * price, 6).toString() : "";
  }, [denom, amount, effectiveAmount, price]);

  const fromAmount = isMint ? aktDisplay : actDisplay;
  const toAmount = isMint ? actDisplay : aktDisplay;

  const effectiveFromAmount = useMemo(() => {
    const val = parseFloat(fromAmount);
    return Number.isNaN(val) || val < 0 ? 0 : val;
  }, [fromAmount]);

  const effectiveActAmount = useMemo(() => {
    const val = parseFloat(actDisplay);
    return Number.isNaN(val) || val < 0 ? 0 : val;
  }, [actDisplay]);

  const maxFromAmount = useMemo(() => {
    return isMint ? roundDecimal(aktBalance, 6) : roundDecimal(actBalance, 6);
  }, [isMint, aktBalance, actBalance]);

  const insufficientBalance = effectiveFromAmount > maxFromAmount;

  const focusField = useCallback(
    (fieldDenom: "AKT" | "ACT", currentDisplay: string) => {
      if (denom !== fieldDenom) {
        setDenom(fieldDenom);
        setAmount(currentDisplay);
      }
    },
    [denom]
  );

  const handleFieldChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  const setPreset = useCallback((preset: number) => {
    setDenom("ACT");
    setAmount(preset.toString());
  }, []);

  const handleMaxClick = useCallback(() => {
    setDenom(isMint ? "AKT" : "ACT");
    setAmount(maxFromAmount.toString());
  }, [isMint, maxFromAmount]);

  const resetForm = useCallback(() => {
    setAmount("");
  }, []);

  const swapTokens = useCallback(() => {
    setActiveTab(prev => (prev === MintBurnTab.MINT ? MintBurnTab.BURN : MintBurnTab.MINT));
  }, []);

  const setupNotifications = useCallback(() => {
    if (!balance) return;

    const balanceKey = isMint ? "balanceUACT" : "balanceUAKT";
    const pendingKey = enqueueSnackbar(
      <d.Snackbar title={isMint ? "Minting ACT..." : "Burning ACT..."} subTitle="Please wait while we update your balance" showLoading />,
      { variant: "info", persist: true, autoHideDuration: null }
    );
    balanceWatch.start(balance[balanceKey], balanceKey, {
      onSuccess: () => {
        closeSnackbar(pendingKey);
        enqueueSnackbar(<d.Snackbar title="Conversion complete!" subTitle="Your balance has been updated" iconVariant="success" />, {
          variant: "success"
        });
      },
      onTimeOut: () => {
        closeSnackbar(pendingKey);
        enqueueSnackbar(<d.Snackbar title="Conversion pending" subTitle="Please refresh the page to check your balance" iconVariant="warning" />, {
          variant: "warning"
        });
      }
    });
  }, [balance, balanceWatch, closeSnackbar, d, enqueueSnackbar, isMint]);

  const submitForm = useCallback(async () => {
    if (!address || !effectiveFromAmount || insufficientBalance || !balance) return;

    setIsSubmitting(true);
    try {
      const msg = isMint
        ? TransactionMessageData.getMintACTMsg(address, denomToUdenom(effectiveFromAmount), UAKT_DENOM)
        : TransactionMessageData.getBurnACTMsg(address, denomToUdenom(effectiveFromAmount));

      const success = await signAndBroadcastTx([msg]);

      if (success) {
        setupNotifications();
        resetForm();
      }
    } catch (err) {
      const title = isMint ? "Failed to mint ACT" : "Failed to burn ACT";
      enqueueSnackbar(<d.Snackbar title={title} subTitle={err instanceof Error ? err.message : "An unknown error occurred"} iconVariant="error" />, {
        variant: "error",
        autoHideDuration: 5_000
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [address, effectiveFromAmount, insufficientBalance, balance, isMint, signAndBroadcastTx, setupNotifications, resetForm, enqueueSnackbar, d]);

  const isACTSupported = d.useSupportsACT();

  if (!isACTSupported || !isCustodial) {
    return <FourOhFour />;
  }

  return (
    <d.Layout>
      <div className="mx-auto max-w-lg py-6">
        <d.Link href={UrlService.home()} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <d.NavArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </d.Link>

        <d.Title className="mb-2">Mint & Burn</d.Title>
        <p className="mb-6 text-sm text-muted-foreground">
          Convert between AKT and ACT (Akash Compute Token). ACT is a USD-pegged token used to pay for deployments. Mint ACT by burning AKT at the current
          oracle rate, or burn unused ACT to redeem AKT. ACT has no expiration and is fully refundable.
        </p>

        <d.Card className="mb-4">
          <d.CardContent className="space-y-4 p-4">
            <div>
              <Input
                label="From"
                labelClassName="text-xs text-muted-foreground"
                type="number"
                min="0"
                step="any"
                value={fromAmount}
                onChange={handleFieldChange}
                onFocus={() => focusField(isMint ? "AKT" : "ACT", fromAmount)}
                placeholder="0.00"
                endIcon={<span className="pr-3 text-sm font-medium">{isMint ? "AKT" : "ACT"}</span>}
                endIconClassName="pointer-events-none"
                inputClassName="tabular-nums"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Balance: {isMint ? `${roundDecimal(aktBalance, 2)} AKT` : `${roundDecimal(actBalance, 2)} ACT`}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <d.Button variant="outline" size="icon" onClick={swapTokens} aria-label="Swap tokens" className="rounded-full">
                <d.ArrowUpDown className="h-5 w-5" />
              </d.Button>
            </div>

            <div>
              <Input
                label="To"
                labelClassName="text-xs text-muted-foreground"
                type="number"
                min="0"
                step="any"
                value={toAmount}
                onChange={handleFieldChange}
                onFocus={() => focusField(isMint ? "ACT" : "AKT", toAmount)}
                placeholder="0.00"
                endIcon={<span className="pr-3 text-sm font-medium">{isMint ? "ACT" : "AKT"}</span>}
                endIconClassName="pointer-events-none"
                inputClassName="tabular-nums"
              />
              {isPriceLoaded && price && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Rate: {isMint ? `1 AKT = ${roundDecimal(price, 4)} ACT` : `1 ACT = ${roundDecimal(1 / price, 4)} AKT`}
                </p>
              )}
            </div>
          </d.CardContent>
        </d.Card>

        <div className="mb-4 flex gap-2">
          {PRESET_AMOUNTS.map(amount => (
            <d.Button key={amount} variant={effectiveActAmount === amount ? "default" : "outline"} className="flex-1" onClick={() => setPreset(amount)}>
              ${amount}
            </d.Button>
          ))}
          <d.Button variant={effectiveFromAmount === maxFromAmount ? "default" : "outline"} onClick={handleMaxClick} className="flex-1">
            Everything
          </d.Button>
        </div>

        {!isBalanceLoading && insufficientBalance && effectiveFromAmount > 0 && (
          <d.Alert variant="destructive" className="mb-4">
            <p className="text-sm">
              Insufficient {isMint ? "AKT" : "ACT"} balance. You need {`${roundDecimal(effectiveFromAmount, 6)} ${isMint ? "AKT" : "ACT"}`} but only have{" "}
              {isMint ? `${roundDecimal(aktBalance, 2)} AKT` : `${roundDecimal(actBalance, 2)} ACT`}.
            </p>
          </d.Alert>
        )}

        <d.Alert className="mb-4">
          <p className="text-sm">ACT is USD-pegged and used only for deployments. Conversion may take some time.</p>
        </d.Alert>

        <d.Button
          className="w-full"
          size="lg"
          disabled={!effectiveFromAmount || insufficientBalance || isSubmitting || balanceWatch.isActive || isBalanceLoading || !isPriceLoaded}
          onClick={submitForm}
          aria-label="Submit"
        >
          {isSubmitting && "Processing..."}
          {!isSubmitting && balanceWatch.isActive && "Updating balance..."}
          {!isSubmitting && !balanceWatch.isActive && (isMint ? "Mint ACT" : "Burn ACT")}
        </d.Button>
      </div>
    </d.Layout>
  );
};
