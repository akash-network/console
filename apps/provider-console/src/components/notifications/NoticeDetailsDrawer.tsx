import React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@akashnetwork/ui/components";
import { Calendar, CheckCircle, Clock, User, WarningTriangle, XmarkCircle } from "iconoir-react";

import { getReasonLabel, getStatusInfo } from "@src/schemas/notificationSchemas";
import type { Notification } from "@src/types/notification";

interface NoticeDetailsDrawerProps {
  notice: Notification | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NoticeDetailsDrawer: React.FC<NoticeDetailsDrawerProps> = ({ notice, isOpen, onClose }) => {
  if (!notice) return null;

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
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
      const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);

      return parts.join(" ") || "0m";
    } catch {
      return "Invalid duration";
    }
  };

  const statusInfo = getStatusInfo(notice.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Notification Details
          </DialogTitle>
          <DialogDescription>View detailed information about this notification</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with Status */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{getReasonLabel(notice.reason)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Notice ID: {notice.id}</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Maintenance Details */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 font-medium text-gray-900 dark:text-white">Maintenance Window</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Start Time</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(notice.start_at)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">End Time</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(notice.end_at)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Duration</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{formatDuration(notice.start_at, notice.end_at)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <WarningTriangle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Downtime Impact</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">{notice.downtime ? "Yes - Workloads may be impacted" : "No - No impact expected"}</p>
              </div>
            </div>
          </div>

          {/* Preview Content */}
          {notice.preview && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Message Preview</h4>

              <div>
                <h5 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Subject</h5>
                <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-sm text-gray-900 dark:text-white">{notice.preview.subject}</p>
                </div>
              </div>

              <div>
                <h5 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Body</h5>
                <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">{notice.preview.body}</div>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Statistics */}
          {notice.delivery && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <h4 className="mb-3 font-medium text-gray-900 dark:text-white">Delivery Statistics</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{notice.delivery.total.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Delivered</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{notice.delivery.delivered.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <XmarkCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{notice.delivery.failed.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 font-medium text-gray-900 dark:text-white">Metadata</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Created At:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDateTime(notice.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Notice ID:</span>
                <span className="font-mono text-xs text-gray-900 dark:text-white">{notice.id}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
