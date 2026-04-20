"use client";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Popup, Spinner } from "@akashnetwork/ui/components";

import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import type { MockQuote } from "@src/utils/mockQuoteGenerator";

type ProviderInfo = {
  name: string;
  location: string;
  auditor: string | null;
};

type ServiceInfo = {
  title: string;
  image: string;
  cpu: number;
  gpu?: number;
  ram: number;
  ramUnit: string;
  storageSize: number | string;
  storageUnit: string;
};

type Props = {
  open: boolean;
  provider: ProviderInfo | null;
  quote: MockQuote | null;
  services: ServiceInfo[];
  isLoading: boolean;
  onClose: () => void;
  onAccept: () => void;
  isAccepting: boolean;
};

export const QuoteModal: FC<Props> = ({ open, provider, quote, services, isLoading, onClose, onAccept, isAccepting }) => {
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (!open || !quote) {
      setCountdown(120);
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, quote]);

  const formatUsd = useCallback((value: number) => `$${value.toFixed(2)}`, []);

  if (!provider) return null;

  return (
    <Popup
      open={open}
      variant="custom"
      title={`Quote from ${provider.name}`}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      actions={[
        { label: "Cancel", side: "left" as const, variant: "text" as const, onClick: onClose },
        {
          label: isAccepting ? "Creating deployment..." : "Accept & create lease →",
          side: "right" as const,
          variant: "default" as const,
          onClick: onAccept,
          disabled: isLoading || isAccepting,
          isLoading: isAccepting,
          className: "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        }
      ]}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {provider.location}
          {provider.auditor && ` · Audited by ${provider.auditor}`}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="medium" />
          </div>
        ) : quote ? (
          <>
            {services.length > 0 && (
              <div className="max-h-[300px] space-y-4 overflow-auto">
                {services.map(service => (
                  <Alert key={service.title}>
                    <div className="mb-2 break-all text-sm">
                      <span className="font-bold">{service.title}</span>:{service.image}
                    </div>
                    <div className="flex items-center space-x-4 whitespace-nowrap">
                      <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={service.cpu} />
                      {!!service.gpu && <LeaseSpecDetail type="gpu" className="flex-shrink-0" value={service.gpu} />}
                      <LeaseSpecDetail type="ram" className="flex-shrink-0" value={`${service.ram} ${service.ramUnit}`} />
                      <LeaseSpecDetail type="storage" className="flex-shrink-0" value={`${service.storageSize} ${service.storageUnit}`} />
                    </div>
                  </Alert>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-2xl font-bold">≈ {formatUsd(quote.monthlyCostUsd)}</span>
                  <span className="ml-1 text-sm text-muted-foreground">/ mo</span>
                </div>
                <span className="text-sm text-muted-foreground">({formatUsd(quote.monthlyCostUsd / 730)}/hr)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Billed per block (~6 seconds). You only pay for the time you use.</p>
            </div>

            <p className="text-xs text-muted-foreground">Quote expires in {countdown}s · includes 7-day SLA uptime guarantee.</p>
          </>
        ) : null}
      </div>
    </Popup>
  );
};
