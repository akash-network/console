"use client";
import type { FC } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Skeleton } from "@akashnetwork/ui/components";
import { format, formatDistanceStrict } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { KeyRoundIcon, MoreHorizontalIcon, ShieldAlertIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";

import type { ApiKeyExpiryStatus } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { getApiKeyExpiryStatus } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";

const API_KEY_DATE_FORMAT = "MMM d, yyyy";

const EXPIRY_BADGE_LABELS: Partial<Record<ApiKeyExpiryStatus, string>> = {
  expiringSoon: "Expiring soon",
  expired: "Expired"
};

type Props = {
  apiKeys: ApiKeyResponse[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRevoke: (apiKey: ApiKeyResponse) => void;
};

export const ApiKeyList: FC<Props> = ({ apiKeys, isLoading, isError, onRevoke }) => {
  const now = new Date();
  const newestFirst = [...(apiKeys ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const activeCount = newestFirst.filter(apiKey => getApiKeyExpiryStatus(apiKey.expiresAt, now) !== "expired").length;

  return (
    <SettingsSection
      title="Your keys"
      aside={apiKeys && <span className="text-xs text-muted-foreground">{activeCount === 1 ? "1 active key" : `${activeCount} active keys`}</span>}
    >
      <Card className="overflow-hidden rounded-xl shadow-none">
        <ApiKeyListContent apiKeys={newestFirst} isLoading={isLoading} isError={isError} now={now} onRevoke={onRevoke} />
      </Card>
      <p className="mt-2.5 flex items-start gap-2 px-0.5 text-xs leading-[17px] text-muted-foreground">
        <ShieldAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          API keys grant full access to your Console account, so treat them like passwords. Keep them in environment variables, never in source code. To rotate
          a key, create a new one and revoke the old one.
        </span>
      </p>
    </SettingsSection>
  );
};

type ApiKeyListContentProps = {
  apiKeys: ApiKeyResponse[];
  isLoading: boolean;
  isError: boolean;
  now: Date;
  onRevoke: (apiKey: ApiKeyResponse) => void;
};

const ApiKeyListContent: FC<ApiKeyListContentProps> = ({ apiKeys, isLoading, isError, now, onRevoke }) => {
  if (isLoading) return <ApiKeyListSkeleton />;

  if (apiKeys.length > 0) {
    return (
      <ul aria-label="API keys" className="divide-y">
        {apiKeys.map(apiKey => (
          <ApiKeyRow key={apiKey.id} apiKey={apiKey} now={now} onRevoke={onRevoke} />
        ))}
      </ul>
    );
  }

  if (isError) {
    return <ApiKeyListNotice icon={TriangleAlertIcon} title="Couldn't load your API keys" description="Refresh the page to try again." />;
  }

  return <ApiKeyListNotice icon={KeyRoundIcon} title="No API keys" description="Create a key to call the Console API." />;
};

type ApiKeyListNoticeProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const ApiKeyListNotice: FC<ApiKeyListNoticeProps> = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
    <p className="text-sm font-semibold">{title}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);

const ApiKeyListSkeleton: FC = () => (
  <div className="flex flex-col gap-5 px-4 py-4">
    {Array.from({ length: 2 }).map((_, index) => (
      <div key={index} className="flex items-center gap-3.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="ml-auto h-3 w-24" />
      </div>
    ))}
  </div>
);

type ApiKeyRowProps = {
  apiKey: ApiKeyResponse;
  now: Date;
  onRevoke: (apiKey: ApiKeyResponse) => void;
};

const ApiKeyRow: FC<ApiKeyRowProps> = ({ apiKey, now, onRevoke }) => {
  const expiryStatus = getApiKeyExpiryStatus(apiKey.expiresAt, now);
  const badgeLabel = EXPIRY_BADGE_LABELS[expiryStatus];

  return (
    <li className="flex items-center gap-3.5 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted" aria-hidden>
        <KeyRoundIcon className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold">{apiKey.name}</span>
            {badgeLabel && (
              <span
                data-status={expiryStatus}
                className="inline-flex shrink-0 rounded-full px-2 py-px text-[11px] font-medium data-[status=expired]:bg-destructive/15 data-[status=expiringSoon]:bg-warning/15 data-[status=expired]:text-destructive data-[status=expiringSoon]:text-warning"
              >
                {badgeLabel}
              </span>
            )}
          </div>
          <p className="flex flex-wrap gap-x-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="break-all">{apiKey.keyFormat}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{describeExpiry(apiKey.expiresAt, expiryStatus)}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">Created {format(new Date(apiKey.createdAt), API_KEY_DATE_FORMAT)}</span>
          </p>
        </div>
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:ml-auto">
          {apiKey.lastUsedAt ? `Last used ${formatDistanceStrict(new Date(apiKey.lastUsedAt), now, { addSuffix: true })}` : "Never used"}
        </span>
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for ${apiKey.name}`} size="icon" variant="ghost" className="h-7 w-7 shrink-0 rounded-md text-muted-foreground">
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onRevoke(apiKey)}>
            <Trash2Icon className="mr-2 h-4 w-4" />
            Revoke key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
};

function describeExpiry(expiresAt: string | null, status: ApiKeyExpiryStatus) {
  if (!expiresAt) return "No expiration";

  const expiryDate = format(new Date(expiresAt), API_KEY_DATE_FORMAT);
  return status === "expired" ? `Expired ${expiryDate}` : `Expires ${expiryDate}`;
}
