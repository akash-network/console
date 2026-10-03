import type { FC } from "react";
import React, { useState } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { Alert, AlertDescription, AlertTitle, Button, Card, Checkbox, CustomPagination, MIN_PAGE_SIZE, Skeleton } from "@akashnetwork/ui/components";
import { Bell, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AlertWithDeploymentName } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import { AlertStatus } from "@src/components/alerts/AlertStatus/AlertStatus";
import { DeleteConfirmationDialog } from "@src/components/alerts/DeleteConfirmationDialog/DeleteConfirmationDialog";
import type { WalletBalanceAlert } from "@src/components/alerts/WalletBalanceAlertDialog/WalletBalanceAlertDialog";
import { WalletBalanceAlertDialog } from "@src/components/alerts/WalletBalanceAlertDialog/WalletBalanceAlertDialog";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { UrlService } from "@src/utils/urlUtils";

type AlertsPagination = components["schemas"]["AlertListOutputResponse"]["pagination"];

const ALERT_TYPE_LABELS: Record<AlertWithDeploymentName["type"], string> = {
  CHAIN_MESSAGE: "Network Activity",
  CHAIN_EVENT: "Deployment Event",
  DEPLOYMENT_BALANCE: "Deployment Balance",
  WALLET_BALANCE: "Wallet Balance"
};

const COLUMN_HEADERS = ["Enabled", "Deployment Name", "DSEQ", "Type", "Status", "Notification Channel"];

/** Below lg a row stacks into three lines (name, type and status, DSEQ and channel); from lg every value gets its own column. */
const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 [grid-template-areas:'toggle_name_actions'_'toggle_type_status'_'toggle_dseq_channel'] lg:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_96px_minmax(0,1fr)_72px] lg:gap-y-0 lg:[grid-template-areas:none]";

export const DEPENDENCIES = {
  CustomPagination,
  WalletBalanceAlertDialog,
  DeleteConfirmationDialog
};

export interface Props {
  data: AlertWithDeploymentName[];
  pagination: Pick<AlertsPagination, "page" | "limit" | "total" | "totalPages">;
  onPaginationChange: (params: { page: number; limit: number }) => void;
  onToggle: (id: string, enabled: boolean, dseq?: string) => void;
  onRemove: (id: string) => Promise<void>;
  loadingIds: Set<string>;
  removingIds: Set<string>;
  isLoading?: boolean;
  isError?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

function getDseq(alert: AlertWithDeploymentName) {
  return alert.params && "dseq" in alert.params ? alert.params.dseq : undefined;
}

function getTypeLabel(alert: AlertWithDeploymentName) {
  if (alert.params && "type" in alert.params && alert.params.type === "DEPLOYMENT_CLOSED") {
    return "Deployment Close";
  }

  return ALERT_TYPE_LABELS[alert.type];
}

function getSubject(alert: AlertWithDeploymentName) {
  const dseq = getDseq(alert);
  return alert.deploymentName ?? (dseq ? `deployment ${dseq}` : alert.name);
}

export const AlertsListView: FC<Props> = ({
  data,
  pagination,
  onPaginationChange,
  isLoading,
  onToggle,
  onRemove,
  loadingIds,
  removingIds,
  isError,
  dependencies: d = DEPENDENCIES
}) => {
  const [alertPendingDelete, setAlertPendingDelete] = useState<AlertWithDeploymentName | null>(null);
  const [alertBeingEdited, setAlertBeingEdited] = useState<WalletBalanceAlert | null>(null);

  const deleteAlert = async (alert: AlertWithDeploymentName) => {
    await onRemove(alert.id);
    setAlertPendingDelete(null);
  };

  if (isError) {
    return (
      <SettingsSection title="Deployment alerts">
        <Alert variant="destructive">
          <AlertTitle>Error loading alerts</AlertTitle>
          <AlertDescription>Refresh the page to try again.</AlertDescription>
        </Alert>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Deployment alerts" aside={!isLoading && `${pagination.total} ${pagination.total === 1 ? "alert" : "alerts"}`}>
      <Card className="overflow-hidden rounded-xl shadow-none">
        {isLoading ? (
          <AlertsTableSkeleton />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">No alerts yet</p>
            <p className="text-xs text-muted-foreground">Turn on alerts for a deployment from its Settings tab.</p>
          </div>
        ) : (
          <div role="table" aria-label="Deployment alerts">
            <div role="rowgroup" className="hidden lg:block">
              <div role="row" className={`${ROW_GRID} py-3`}>
                {COLUMN_HEADERS.map(header => (
                  <span key={header} role="columnheader" className="text-[13px] font-medium text-muted-foreground">
                    {header}
                  </span>
                ))}
                <span role="columnheader" className="sr-only">
                  Actions
                </span>
              </div>
            </div>
            <div role="rowgroup">
              {data.map(alert => {
                const dseq = getDseq(alert);
                const typeLabel = getTypeLabel(alert);
                const subject = getSubject(alert);
                const isRemoving = removingIds.has(alert.id);

                return (
                  <div
                    key={alert.id}
                    role="row"
                    data-enabled={alert.enabled}
                    className={`${ROW_GRID} border-t py-3.5 first:border-t-0 data-[enabled=false]:opacity-60 lg:first:border-t`}
                  >
                    <span role="cell" className="flex self-start pt-0.5 [grid-area:toggle] lg:self-center lg:pt-0 lg:[grid-area:auto]">
                      <Checkbox
                        checked={alert.enabled}
                        disabled={isRemoving || loadingIds.has(alert.id)}
                        onCheckedChange={checked => onToggle(alert.id, checked === true, dseq)}
                        aria-label={`Enable ${typeLabel} alert for ${subject}`}
                      />
                    </span>
                    <span role="cell" className="min-w-0 truncate text-sm font-semibold [grid-area:name] lg:[grid-area:auto]">
                      {dseq ? (
                        <Link href={UrlService.deploymentDetails(dseq, "SETTINGS")} className="hover:underline">
                          {alert.deploymentName ?? <span className="font-normal text-muted-foreground">Unnamed deployment</span>}
                        </Link>
                      ) : (
                        alert.name
                      )}
                    </span>
                    <span role="cell" className="font-mono text-[12.5px] text-muted-foreground [grid-area:dseq] lg:text-foreground lg:[grid-area:auto]">
                      {dseq ?? "N/A"}
                    </span>
                    <span role="cell" className="text-[13px] [grid-area:type] lg:text-sm lg:[grid-area:auto]">
                      {typeLabel}
                    </span>
                    <span role="cell" className="justify-self-end [grid-area:status] lg:justify-self-start lg:[grid-area:auto]">
                      <AlertStatus status={alert.status} />
                    </span>
                    <span
                      role="cell"
                      className="min-w-0 justify-self-end truncate text-[13px] text-muted-foreground [grid-area:channel] lg:justify-self-stretch lg:text-sm lg:text-foreground lg:[grid-area:auto]"
                    >
                      {alert.notificationChannelName}
                    </span>
                    <span role="cell" className="flex justify-end gap-1 [grid-area:actions] lg:[grid-area:auto]">
                      {alert.type === "WALLET_BALANCE" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          disabled={isRemoving}
                          aria-label={`Edit ${typeLabel} alert for ${subject}`}
                          onClick={() => setAlertBeingEdited(alert)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        disabled={isRemoving}
                        aria-label={`Delete ${typeLabel} alert for ${subject}`}
                        onClick={() => setAlertPendingDelete(alert)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pagination.total > MIN_PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <d.CustomPagination
              totalPageCount={pagination.totalPages}
              pageIndex={pagination.page - 1}
              pageSize={pagination.limit}
              setPageIndex={pageIndex => onPaginationChange({ page: pageIndex + 1, limit: pagination.limit })}
              setPageSize={limit => onPaginationChange({ page: 1, limit })}
            />
          </div>
        )}
      </Card>

      {alertPendingDelete && (
        <d.DeleteConfirmationDialog
          title={`Delete ${getTypeLabel(alertPendingDelete)} alert for “${getSubject(alertPendingDelete)}”?`}
          description={
            getDseq(alertPendingDelete)
              ? "You'll stop receiving notifications for this alert. You can turn it on again from the deployment's Settings tab."
              : "You'll stop receiving notifications for this alert."
          }
          isDeleting={removingIds.has(alertPendingDelete.id)}
          onConfirm={() => deleteAlert(alertPendingDelete)}
          onCancel={() => setAlertPendingDelete(null)}
        />
      )}

      {alertBeingEdited && <d.WalletBalanceAlertDialog alert={alertBeingEdited} onClose={() => setAlertBeingEdited(null)} />}
    </SettingsSection>
  );
};

const AlertsTableSkeleton: FC = () => (
  <div data-testid="alerts-table-skeleton">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className={`${ROW_GRID} border-t py-4 first:border-t-0`}>
        <Skeleton className="h-4 w-4 [grid-area:toggle] lg:[grid-area:auto]" />
        <Skeleton className="h-4 w-32 [grid-area:name] lg:[grid-area:auto]" />
        <Skeleton className="h-4 w-24 [grid-area:dseq] lg:[grid-area:auto]" />
        <Skeleton className="h-4 w-28 [grid-area:type] lg:[grid-area:auto]" />
        <Skeleton className="h-5 w-12 rounded-full [grid-area:status] lg:[grid-area:auto]" />
        <Skeleton className="h-4 w-20 [grid-area:channel] lg:[grid-area:auto]" />
        <Skeleton className="h-4 w-6 justify-self-end [grid-area:actions] lg:[grid-area:auto]" />
      </div>
    ))}
  </div>
);
