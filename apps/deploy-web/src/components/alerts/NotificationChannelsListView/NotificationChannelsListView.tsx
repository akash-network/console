import type { FC } from "react";
import React, { useState } from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { Alert, AlertDescription, AlertTitle, Button, Card, CustomPagination, MIN_PAGE_SIZE, Skeleton } from "@akashnetwork/ui/components";
import { capitalize } from "lodash";
import { Mail, Pencil, Trash2 } from "lucide-react";

import { DeleteConfirmationDialog } from "@src/components/alerts/DeleteConfirmationDialog/DeleteConfirmationDialog";
import { NotificationChannelDialog } from "@src/components/alerts/NotificationChannelDialog/NotificationChannelDialog";
import type { RemoveNotificationChannelResult } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";

type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];
type NotificationChannelsInput = components["schemas"]["NotificationChannelListOutput"]["data"];
type NotificationChannelsPagination = components["schemas"]["NotificationChannelListOutput"]["pagination"];

const COLUMN_HEADERS = ["Name", "Type", "Email"];

/** Phones drop the type column, since every channel is email today, and keep the actions beside the name and addresses. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 [grid-template-areas:'name_actions'_'emails_actions'] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1.5fr)_88px] sm:gap-y-0 sm:[grid-template-areas:none]";

export const DEPENDENCIES = {
  CustomPagination,
  NotificationChannelDialog,
  DeleteConfirmationDialog
};

export type NotificationChannelsListViewProps = {
  data: NotificationChannelsInput;
  pagination: Pick<NotificationChannelsPagination, "page" | "limit" | "total" | "totalPages">;
  isLoading: boolean;
  removingIds: Set<NotificationChannel["id"]>;
  onRemove: (id: NotificationChannel["id"]) => Promise<RemoveNotificationChannelResult>;
  onPaginationChange: (state: { page: number; limit: number }) => void;
  isError: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const NotificationChannelsListView: FC<NotificationChannelsListViewProps> = ({
  data,
  pagination,
  onPaginationChange,
  isLoading,
  removingIds,
  onRemove,
  isError,
  dependencies: d = DEPENDENCIES
}) => {
  const [channelBeingEdited, setChannelBeingEdited] = useState<NotificationChannel | null>(null);
  const [channelPendingDelete, setChannelPendingDelete] = useState<NotificationChannel | null>(null);
  const [isPendingChannelInUse, setIsPendingChannelInUse] = useState(false);

  const confirmDelete = (channel: NotificationChannel) => {
    setIsPendingChannelInUse(false);
    setChannelPendingDelete(channel);
  };

  const deleteChannel = async (channel: NotificationChannel) => {
    const result = await onRemove(channel.id);

    if (result === "in-use") {
      setIsPendingChannelInUse(true);
    } else {
      setChannelPendingDelete(null);
    }
  };

  if (isError) {
    return (
      <SettingsSection title="Notification channels">
        <Alert variant="destructive">
          <AlertTitle>Error loading notification channels</AlertTitle>
          <AlertDescription>Refresh the page to try again.</AlertDescription>
        </Alert>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Notification channels"
      aside={!isLoading && <span className="text-xs text-muted-foreground">{`${pagination.total} ${pagination.total === 1 ? "channel" : "channels"}`}</span>}
    >
      <Card className="overflow-hidden rounded-xl shadow-none">
        {isLoading ? (
          <ChannelsTableSkeleton />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">No notification channels</p>
            <p className="text-xs text-muted-foreground">Add a channel to choose who receives alerts.</p>
          </div>
        ) : (
          <div role="table" aria-label="Notification channels">
            <div role="rowgroup" className="hidden sm:block">
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
              {data.map(channel => {
                const isRemoving = removingIds.has(channel.id);

                return (
                  <div key={channel.id} role="row" className={`${ROW_GRID} border-t py-3.5 first:border-t-0 sm:first:border-t`}>
                    <span role="cell" className="min-w-0 truncate text-sm font-semibold [grid-area:name] sm:[grid-area:auto]">
                      {channel.name}
                    </span>
                    <span role="cell" className="hidden text-sm sm:block">
                      {capitalize(channel.type)}
                    </span>
                    <span
                      role="cell"
                      className="min-w-0 text-[13px] text-muted-foreground [grid-area:emails] sm:text-sm sm:text-foreground sm:[grid-area:auto]"
                    >
                      {channel.config.addresses.map(address => (
                        <span key={address} className="block truncate" title={address}>
                          {address}
                        </span>
                      ))}
                    </span>
                    <span role="cell" className="flex justify-end gap-1 [grid-area:actions] sm:[grid-area:auto]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        disabled={isRemoving}
                        aria-label={`Edit ${channel.name}`}
                        onClick={() => setChannelBeingEdited(channel)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        disabled={isRemoving}
                        aria-label={`Delete ${channel.name}`}
                        onClick={() => confirmDelete(channel)}
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

      {channelBeingEdited && <d.NotificationChannelDialog notificationChannel={channelBeingEdited} onClose={() => setChannelBeingEdited(null)} />}

      {channelPendingDelete && (
        <d.DeleteConfirmationDialog
          title={`Delete “${channelPendingDelete.name}”?`}
          description="This channel will no longer receive notifications."
          refusal={
            isPendingChannelInUse &&
            "Alerts still use this channel, so it can't be deleted. Move those alerts to another channel or delete them, then try again."
          }
          isDeleting={removingIds.has(channelPendingDelete.id)}
          onConfirm={() => deleteChannel(channelPendingDelete)}
          onCancel={() => setChannelPendingDelete(null)}
        />
      )}
    </SettingsSection>
  );
};

const ChannelsTableSkeleton: FC = () => (
  <div data-testid="channels-table-skeleton">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className={`${ROW_GRID} border-t py-4 first:border-t-0`}>
        <Skeleton className="h-4 w-28 [grid-area:name] sm:[grid-area:auto]" />
        <Skeleton className="hidden h-4 w-12 sm:block" />
        <Skeleton className="h-4 w-40 [grid-area:emails] sm:[grid-area:auto]" />
        <Skeleton className="h-4 w-12 justify-self-end [grid-area:actions] sm:[grid-area:auto]" />
      </div>
    ))}
  </div>
);
