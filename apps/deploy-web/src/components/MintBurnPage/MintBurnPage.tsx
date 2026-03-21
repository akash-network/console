"use client";
import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Button, Card, CardContent, Input, Separator, Snackbar } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useBmeParams, useBmeStatus } from "@src/queries/useBmeQuery";
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
  useWallet,
  usePricing,
  useWalletBalance,
  useSnackbar,
  useSupportsACT,
  useBmeParams,
  useBmeStatus
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
  const { balance, isLoading: isBalanceLoading, refetch: refetchBalance } = d.useWalletBalance();
  const { price, isLoaded: isPriceLoaded } = d.usePricing();
  const { enqueueSnackbar } = d.useSnackbar();
  const isACTSupported = d.useSupportsACT();
  const { data: bmeParams } = d.useBmeParams({ enabled: isACTSupported });
  const { data: bmeStatus } = d.useBmeStatus({ enabled: isACTSupported });

  const aktBalance = useMemo(() => (balance ? udenomToDenom(balance.balanceUAKT, 6) : 0), [balance]);
  const actBalance = useMemo(() => (balance ? udenomToDenom(balance.balanceUACT, 6) : 0), [balance]);

  const isMint = activeTab === MintBurnTab.MINT;

  const effectiveAmount = useMemo(() => {
    const val = parseFloat(amount);
    return Number.isNaN(val) || val < 0 ? 0 : val;
  }, [amount]);

  const effectiveRate = useMemo(() => {
    if (!price) return undefined;
    const mintSpread = bmeParams ? bmeParams.mintSpreadBps / 10_000 : 0;
    const settleSpread = bmeParams ? bmeParams.settleSpreadBps / 10_000 : 0;
    return {
      mint: price * (1 - mintSpread),
      burn: (1 / price) * (1 - settleSpread)
    };
  }, [price, bmeParams]);

  const aktDisplay = useMemo(() => {
    if (denom === "AKT") return amount;
    const rate = isMint ? effectiveRate?.mint : effectiveRate?.burn;
    if (!rate || !effectiveAmount) return "";
    return isMint ? roundDecimal(effectiveAmount / rate, 6).toString() : roundDecimal(effectiveAmount * rate, 6).toString();
  }, [denom, amount, effectiveAmount, effectiveRate, isMint]);

  const actDisplay = useMemo(() => {
    if (denom === "ACT") return amount;
    const rate = isMint ? effectiveRate?.mint : effectiveRate?.burn;
    if (!rate || !effectiveAmount) return "";
    return isMint ? roundDecimal(effectiveAmount * rate, 6).toString() : roundDecimal(effectiveAmount / rate, 6).toString();
  }, [denom, amount, effectiveAmount, effectiveRate, isMint]);

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

  const belowMinMint = useMemo(() => {
    if (!isMint || !bmeParams || !effectiveActAmount) return false;
    return effectiveActAmount < bmeParams.minMintAct;
  }, [isMint, bmeParams, effectiveActAmount]);

  const isMintDisabled = bmeStatus ? !bmeStatus.mintsAllowed : false;
  const isBurnDisabled = bmeStatus ? !bmeStatus.refundsAllowed : false;

  const isCircuitBreakerWarning = !!bmeStatus && !isMintDisabled && !isBurnDisabled && bmeStatus.collateralRatio <= bmeStatus.circuitBreakerWarnThreshold;

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

  const submitForm = useCallback(async () => {
    if (!address || !effectiveFromAmount || insufficientBalance || belowMinMint) return;

    setIsSubmitting(true);
    try {
      const msg = isMint
        ? TransactionMessageData.getMintACTMsg(address, denomToUdenom(effectiveFromAmount), UAKT_DENOM)
        : TransactionMessageData.getBurnACTMsg(address, denomToUdenom(effectiveFromAmount));

      const success = await signAndBroadcastTx([msg]);

      if (success) {
        refetchBalance();
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
  }, [address, effectiveFromAmount, insufficientBalance, belowMinMint, isMint, signAndBroadcastTx, enqueueSnackbar, refetchBalance, resetForm, d]);

  if (!isACTSupported || !isCustodial) {
    return null;
  }

  const spreadBps = isMint ? bmeParams?.mintSpreadBps : bmeParams?.settleSpreadBps;
  const hasSpread = spreadBps !== undefined && spreadBps > 0;

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

        {isMint && isMintDisabled && (
          <d.Alert variant="destructive" className="mb-4">
            <p className="text-sm">Minting is currently disabled due to the circuit breaker. The collateral ratio has fallen below the safe threshold.</p>
          </d.Alert>
        )}

        {!isMint && isBurnDisabled && (
          <d.Alert variant="destructive" className="mb-4">
            <p className="text-sm">Settling ACT is currently disabled due to the circuit breaker.</p>
          </d.Alert>
        )}

        {isCircuitBreakerWarning && (
          <d.Alert variant="warning" className="mb-4">
            <p className="text-sm">
              The collateral ratio ({roundDecimal(bmeStatus?.collateralRatio ?? 0, 4)}) is approaching the circuit breaker threshold. Minting or settling may be
              paused soon.
            </p>
          </d.Alert>
        )}

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
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <p>Oracle: 1 AKT = {roundDecimal(price, 4)} ACT</p>
                  {hasSpread && effectiveRate && (
                    <p>
                      Effective: 1 {isMint ? "AKT" : "ACT"} = {roundDecimal(isMint ? effectiveRate.mint : effectiveRate.burn, 4)} {isMint ? "ACT" : "AKT"} (
                      {(spreadBps! / 100).toFixed(2)}% spread)
                    </p>
                  )}
                </div>
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

        {belowMinMint && bmeParams && (
          <d.Alert variant="destructive" className="mb-4">
            <p className="text-sm">
              Estimated output ({roundDecimal(effectiveActAmount, 2)} ACT) is below the minimum mint amount of {bmeParams.minMintAct} ACT. Increase the amount
              to proceed.
            </p>
          </d.Alert>
        )}

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
          disabled={
            !effectiveFromAmount ||
            insufficientBalance ||
            isSubmitting ||
            isBalanceLoading ||
            !isPriceLoaded ||
            belowMinMint ||
            (isMint && isMintDisabled) ||
            (!isMint && isBurnDisabled)
          }
          onClick={submitForm}
          aria-label="Submit"
        >
          {isSubmitting ? "Processing..." : isMint ? (isMintDisabled ? "Minting Paused" : "Mint ACT") : isBurnDisabled ? "Settling Paused" : "Burn ACT"}
        </d.Button>
      </div>
    </d.Layout>
  );
};
