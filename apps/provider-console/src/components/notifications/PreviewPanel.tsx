import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Calendar, Clock, WarningTriangle } from "iconoir-react";

import { getReasonLabel } from "@src/schemas/notificationSchemas";
import type { NotificationDraftInput, NotificationPreview } from "@src/types/notification";

interface PreviewPanelProps {
  preview?: NotificationPreview;
  formData?: NotificationDraftInput;
  isLoading?: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ preview, formData, isLoading = false }) => {
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

  // Generate client-side preview from form data
  const generatePreview = (data: NotificationDraftInput) => {
    const startDate = new Date(data.start_at);
    const endDate = new Date(data.end_at);
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)); // hours

    const reason = getReasonLabel(data.reason);
    const startTime = startDate.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short"
    });
    const endTime = endDate.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short"
    });

    const subject = `Scheduled Maintenance - ${reason}`;

    let body = `We will be performing scheduled maintenance on our infrastructure.\n\n`;
    body += `**Maintenance Details:**\n`;
    body += `• Reason: ${reason}\n`;
    body += `• Start Time: ${startTime}\n`;
    body += `• End Time: ${endTime}\n`;
    body += `• Duration: ${duration} hour${duration !== 1 ? "s" : ""}\n\n`;

    if (data.downtime) {
      body += `⚠️ **Important:** This maintenance may impact your workloads. Please plan accordingly.\n\n`;
    }

    body += `We apologize for any inconvenience this may cause. If you have any questions or concerns, please don't hesitate to contact our support team.\n\n`;
    body += `Thank you for your understanding.`;

    return { subject, body };
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-20 w-full rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview && !formData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">No Preview Available</h3>
            <p className="text-gray-500 dark:text-gray-400">Fill out the form and click &quot;Preview&quot; to see how your notification will appear.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Maintenance Details Summary */}
        {formData && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 font-medium text-gray-900 dark:text-white">Maintenance Details</h4>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">Reason:</span>
                <span className="font-medium text-gray-900 dark:text-white">{getReasonLabel(formData.reason)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDuration(formData.start_at, formData.end_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Start:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDateTime(formData.start_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">End:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDateTime(formData.end_at)}</span>
              </div>
              {formData.downtime && (
                <div className="col-span-full flex items-center gap-2">
                  <WarningTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-700 dark:text-yellow-400">Workloads may be impacted during this maintenance window</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Content */}
        {(preview || formData) && (
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium text-gray-900 dark:text-white">Subject</h4>
              <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm text-gray-900 dark:text-white">{preview?.subject || (formData ? generatePreview(formData).subject : "")}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-medium text-gray-900 dark:text-white">Message Body</h4>
              <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                  {preview?.body || (formData ? generatePreview(formData).body : "")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recipients Info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Recipients</h4>
              <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                This notice will be sent to active deployers who opted-in and provider subscribers.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
