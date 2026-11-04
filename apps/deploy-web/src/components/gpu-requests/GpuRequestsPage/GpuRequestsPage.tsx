"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { InboxIcon, PlusIcon } from "lucide-react";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useUser } from "@src/hooks/useUser";
import { useHardwareRequestsQuery } from "@src/queries/useHardwareRequestsQuery";
import { GpuQuoteRequestFlow } from "../GpuQuoteRequestFlow/GpuQuoteRequestFlow";
import { canWithdraw } from "../gpuRequestAccess/gpuRequestAccess";
import { GpuRequestOffers } from "../GpuRequestOffers/GpuRequestOffers";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { hasOffers } from "../gpuRequestStatus/gpuRequestStatus";
import { GpuRequestCard } from "./GpuRequestCard";
import { WithdrawGpuRequestDialog } from "./WithdrawGpuRequestDialog";

export const DEPENDENCIES = {
  Layout,
  SettingsLayout,
  GpuQuoteRequestFlow,
  GpuRequestCard,
  GpuRequestOffers,
  WithdrawGpuRequestDialog,
  useHardwareRequestsQuery,
  useUser,
  useActiveOrganization
};

type Props = {
  requestId?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const GpuRequestsPage: FC<Props> = ({ requestId, dependencies: d = DEPENDENCIES }) => {
  const { data: requests, isLoading, isError } = d.useHardwareRequestsQuery();
  const { user } = d.useUser();
  const { activeOrganization } = d.useActiveOrganization();
  const viewer = { userId: user?.id, role: activeOrganization?.role };
  const [isRequesting, setIsRequesting] = useState(false);
  const [withdrawing, setWithdrawing] = useState<HardwareRequest | null>(null);
  const newestFirst = [...(requests ?? [])].sort((first, second) => second.createdAt.localeCompare(first.createdAt));

  return (
    <d.Layout background="dots" disableContainer containerClassName="flex h-full flex-col justify-between">
      <NextSeo title="GPU requests" />
      <d.SettingsLayout
        title="GPU requests"
        description="Hardware your organization asked us to source, and where each request stands."
        headerActions={newestFirst.length > 0 && <NewRequestButton onClick={() => setIsRequesting(true)} />}
      >
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="small" />
            Loading your requests…
          </p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-muted-foreground">
            Couldn&apos;t load your requests. Try again in a moment.
          </p>
        )}
        {requests?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
              <InboxIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="mt-1 text-base font-semibold">No GPU requests yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              When no provider has the hardware you need, send us a request. We&apos;ll source it and show its progress here.
            </p>
            <div className="mt-2">
              <NewRequestButton onClick={() => setIsRequesting(true)} />
            </div>
          </div>
        )}
        {newestFirst.length > 0 && (
          <ul className="flex flex-col gap-4">
            {newestFirst.map(request => (
              <li key={request.id}>
                <d.GpuRequestCard
                  request={request}
                  isFocused={request.id === requestId}
                  offers={hasOffers(request.status) && <d.GpuRequestOffers request={request} />}
                  onWithdraw={canWithdraw(request, viewer) ? () => setWithdrawing(request) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </d.SettingsLayout>
      {isRequesting && <d.GpuQuoteRequestFlow source="requests_page" onClose={() => setIsRequesting(false)} />}
      {withdrawing && <d.WithdrawGpuRequestDialog request={withdrawing} onClose={() => setWithdrawing(null)} />}
    </d.Layout>
  );
};

function NewRequestButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" className="gap-1.5" onClick={onClick}>
      <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
      New request
    </Button>
  );
}
