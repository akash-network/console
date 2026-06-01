"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@akashnetwork/ui/components";

import { AddCreditsForm } from "@src/components/billing-usage/AddCreditsForm/AddCreditsForm";

export const DEPENDENCIES = {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  AddCreditsForm
};

interface AddCreditsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (amount: number, organization?: string) => void;
  isWalletReady?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export function AddCreditsSheet({ open, onOpenChange, onDone, isWalletReady, dependencies: d = DEPENDENCIES }: AddCreditsSheetProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const requestOpenChange = (next: boolean) => {
    if (!next && isProcessing) return;
    onOpenChange(next);
  };

  return (
    <d.Sheet open={open} onOpenChange={requestOpenChange}>
      <d.SheetContent side="right" hideCloseButton={isProcessing} className="w-full space-y-6 overflow-y-auto p-6 sm:max-w-[546px]">
        <d.SheetHeader className="space-y-2 text-left">
          <d.SheetTitle className="text-3xl font-medium leading-9">Add credits</d.SheetTitle>
          <d.SheetDescription className="text-sm leading-5 text-muted-foreground">
            This template needs a top-tier GPU, which isn&apos;t covered by your free trial. Add credits to unlock high-end GPUs, longer runtimes, and the full
            Console.
          </d.SheetDescription>
        </d.SheetHeader>

        {open && <d.AddCreditsForm onDone={onDone} isWalletReady={isWalletReady} onProcessingChange={setIsProcessing} />}
      </d.SheetContent>
    </d.Sheet>
  );
}
