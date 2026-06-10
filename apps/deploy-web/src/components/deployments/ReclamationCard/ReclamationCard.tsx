"use client";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { WarningTriangle } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import type { LeaseDto } from "@src/types/deployment";
import { getLeaseCloseReasonLabel } from "@src/utils/reclamationUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useWallet, useManagedDeploymentConfirm, useLocalNotes, useRouter };

type Props = {
  lease: LeaseDto;
  dseq: string;
  onClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Per-lease card for the terminal "closed by provider" (reclaimed) case. Reclamation is terminal —
 * there is no restart — so recovery is Close (recover any escrow still locked in the active-but-dead
 * deployment) + Redeploy. The live, still-running case is handled by ReclamationBanner.
 */
export const ReclamationCard: React.FunctionComponent<Props> = ({ lease, dseq, onClosed, dependencies = DEPENDENCIES }) => {
  const { useWallet, useManagedDeploymentConfirm, useLocalNotes, useRouter } = dependencies;
  const { address, signAndBroadcastTx } = useWallet();
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const { getDeploymentData } = useLocalNotes();
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const reasonLabel = getLeaseCloseReasonLabel(lease.reclamation?.reason ?? lease.reason);
  const hasLocalManifest = !!getDeploymentData(dseq)?.manifest;

  const confirmAndClose = async () => {
    const isConfirmed = await closeDeploymentConfirm([dseq]);
    if (!isConfirmed) return;

    setIsClosing(true);
    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) onClosed?.();
    } finally {
      setIsClosing(false);
    }
  };

  const redeploy = () => router.push(UrlService.newDeployment({ redeploy: dseq }));

  return (
    <Alert variant="warning" className="p-4">
      <WarningTriangle className="h-4 w-4" />
      <AlertTitle>{reasonLabel}</AlertTitle>
      <AlertDescription>
        <p>
          This deployment was stopped by the provider, so it&apos;s no longer running. Redeploy to get back online, or close it to recover any unused funds.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" onClick={confirmAndClose} disabled={isClosing}>
            {isClosing ? <Spinner size="small" /> : "Close & refund"}
          </Button>
          {hasLocalManifest ? (
            <Button variant="outline" size="sm" className="text-foreground" onClick={redeploy}>
              Redeploy
            </Button>
          ) : (
            <Link href={UrlService.newDeployment()} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-foreground")}>
              Start a new deployment
            </Link>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
