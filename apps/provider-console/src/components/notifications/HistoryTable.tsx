import React from "react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Calendar, Clock, Eye, WarningTriangle } from "iconoir-react";

import { getReasonLabel, getStatusInfo } from "@src/schemas/notificationSchemas";
import type { Notification } from "@src/types/notification";

interface HistoryTableProps {
  notices: Notification[];
  isLoading?: boolean;
  onViewDetails: (notice: Notification) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ notices, isLoading = false, onViewDetails, currentPage, totalPages, onPageChange }) => {
  const formatDateTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short"
      });
    } catch {
      return "Invalid date";
    }
  };

  const formatDuration = (startAt: string, endAt: string) => {
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      const durationMs = end.getTime() - start.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    } catch {
      return "Invalid duration";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">No Notifications</h3>
          <p className="text-gray-500 dark:text-gray-400">You haven&apos;t sent any notifications yet. Create your first one to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="p-6">
          <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Notification History</h3>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Window (UTC)</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Downtime</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map(notice => {
                  const statusInfo = getStatusInfo(notice.status);
                  return (
                    <TableRow key={notice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <TableCell className="font-medium text-gray-900 dark:text-white">{getReasonLabel(notice.reason)}</TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(notice.start_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(notice.end_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(notice.start_at, notice.end_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {notice.downtime ? (
                          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <WarningTriangle className="h-3 w-3" />
                            <span className="text-xs">Yes</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(notice.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => onViewDetails(notice)} className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
