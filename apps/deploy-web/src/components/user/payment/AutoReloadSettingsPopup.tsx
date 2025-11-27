import React, { useEffect, useMemo, useState } from "react";
import type { WalletSettings } from "@akashnetwork/http-sdk/src/wallet-settings/wallet-settings.types";
import { Alert, AlertDescription, AlertTitle, Popup } from "@akashnetwork/ui/components";
import { Input, Label, Switch } from "@akashnetwork/ui/components";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useWalletSettingsMutations, useWalletSettingsQuery } from "@src/queries";

const MIN_THRESHOLD = 20;
const MIN_RELOAD_AMOUNT = 20;
export const DEFAULT_THRESHOLD = 20;
export const DEFAULT_RELOAD_AMOUNT = 20;

interface AutoReloadSettingsPopupProps {
  open: boolean;
  onClose: () => void;
}

export const AutoReloadSettingsPopup: React.FC<AutoReloadSettingsPopupProps> = ({ open, onClose }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { data: walletSettings, isLoading } = useWalletSettingsQuery();
  const { updateWalletSettings, createWalletSettings } = useWalletSettingsMutations();

  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [reloadAmount, setReloadAmount] = useState<number>(DEFAULT_RELOAD_AMOUNT);
  const [thresholdError, setThresholdError] = useState<string>();
  const [reloadAmountError, setReloadAmountError] = useState<string>();

  useEffect(() => {
    if (walletSettings) {
      setAutoReloadEnabled(walletSettings.autoReloadEnabled);
      setThreshold(walletSettings?.autoReloadThreshold || DEFAULT_THRESHOLD);
      setReloadAmount(walletSettings?.autoReloadAmount || DEFAULT_RELOAD_AMOUNT);
    }
  }, [walletSettings]);

  const validateThreshold = (value: string): boolean => {
    if (value === "") {
      setThresholdError("Threshold is required");
      return false;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < MIN_THRESHOLD) {
      setThresholdError(`Minimum threshold is $${MIN_THRESHOLD}`);
      return false;
    }

    setThresholdError(undefined);
    return true;
  };

  const onThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateThreshold(e.target.value);
    setThreshold(parseFloat(e.target.value));
  };

  const validateReloadAmount = (value: string): boolean => {
    if (value === "") {
      setReloadAmountError("Reload amount is required");
      return false;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < MIN_RELOAD_AMOUNT) {
      setReloadAmountError(`Minimum reload amount is $${MIN_RELOAD_AMOUNT}`);
      return false;
    }

    setReloadAmountError(undefined);
    return true;
  };

  const onReloadAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateReloadAmount(e.target.value);
    setReloadAmount(parseFloat(e.target.value));
  };

  const handleToggleChange = (checked: boolean) => {
    setAutoReloadEnabled(checked);
  };

  const hasSomethingToSave = useMemo(() => {
    if (walletSettings) {
      return (
        walletSettings.autoReloadEnabled !== autoReloadEnabled ||
        walletSettings.autoReloadThreshold !== threshold ||
        walletSettings.autoReloadAmount !== reloadAmount
      );
    }

    return true;
  }, [walletSettings, autoReloadEnabled, threshold, reloadAmount]);

  const handleSave = async () => {
    if (thresholdError !== "" || reloadAmountError !== "") {
      return;
    }

    const settings: WalletSettings = {
      autoReloadEnabled,
      autoReloadThreshold: threshold,
      autoReloadAmount: reloadAmount
    };

    try {
      if (walletSettings) {
        await updateWalletSettings.mutateAsync(settings);
      } else {
        await createWalletSettings.mutateAsync(settings);
      }

      enqueueSnackbar(<Snackbar title="Auto Reload settings saved" iconVariant="success" />, { variant: "success", autoHideDuration: 3000 });

      onClose();
    } catch (error) {
      console.error("Failed to save Auto Reload settings:", error);
      enqueueSnackbar(<Snackbar title="Failed to save Auto Reload settings" iconVariant="error" />, { variant: "error" });
    }
  };

  const isPending = updateWalletSettings.isPending || createWalletSettings.isPending;

  return (
    <Popup
      open={open}
      onClose={onClose}
      title="Auto Reload"
      variant="custom"
      actions={[
        {
          label: "Cancel",
          variant: "ghost",
          onClick: onClose,
          side: "right"
        },
        {
          label: "Save Changes",
          onClick: handleSave,
          variant: "default",
          disabled: isPending || !hasSomethingToSave,
          side: "right"
        }
      ]}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="">
            <div className="flex">
              <Label htmlFor="reloadEnabled" className="mr-4 self-center">
                Enable Auto Reload
              </Label>
              <Switch id="reloadEnabled" checked={autoReloadEnabled} onCheckedChange={handleToggleChange} disabled={isPending} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">You can enable or disable this at any time.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="threshold-input">
                When credit balance goes below
                <span className="ml-1 text-muted-foreground">(minimum ${MIN_THRESHOLD})</span>
              </Label>
              <div className="flex">
                <span className="self-center text-muted-foreground">$</span>
                <Input
                  id="threshold"
                  type="number"
                  min={MIN_THRESHOLD}
                  step="1"
                  value={threshold}
                  onChange={onThresholdChange}
                  disabled={isPending}
                  className="flex-grow pl-2"
                  placeholder={DEFAULT_THRESHOLD.toString()}
                />
              </div>
              {thresholdError && <p className="text-xs text-destructive">{thresholdError}</p>}
              <p className="text-xs text-muted-foreground">
                If your current balance is below or equal to the threshold you set, your reload will immediately kick in once you click save.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reloadAmount-input">
                Reload Credit Balance to
                <span className="ml-1 text-muted-foreground">(minimum ${MIN_RELOAD_AMOUNT})</span>
              </Label>
              <div className="flex">
                <span className="self-center text-muted-foreground">$</span>
                <Input
                  id="reloadAmount"
                  type="number"
                  min={MIN_RELOAD_AMOUNT}
                  step="1"
                  value={reloadAmount}
                  onChange={onReloadAmountChange}
                  disabled={isPending}
                  className="flex-grow pl-2"
                  placeholder={DEFAULT_RELOAD_AMOUNT.toString()}
                />
              </div>
              {reloadAmountError && <p className="text-xs text-destructive">{reloadAmountError}</p>}
            </div>
            <Alert variant="default">
              <AlertTitle>How it works</AlertTitle>
              <AlertDescription>
                When your balance drops below ${threshold}, we'll automatically charge ${reloadAmount} to your selected card.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}
    </Popup>
  );
};
