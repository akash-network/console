import React from "react";
import { useForm } from "react-hook-form";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock } from "iconoir-react";

import { getReasonLabel, notificationDraftInputSchema } from "@src/schemas/notificationSchemas";
import type { MaintenanceReason, NotificationDraftInput } from "@src/types/notification";

interface MaintenanceFormProps {
  onSubmit: (data: NotificationDraftInput) => void;
  onPreview: (data: NotificationDraftInput) => void;
  isLoading?: boolean;
  isPreviewLoading?: boolean;
  rateLimitRemaining?: number;
}

const MAINTENANCE_REASONS: MaintenanceReason[] = [
  "HARDWARE_UPGRADE",
  "NETWORK_MAINTENANCE",
  "POWER_WORK",
  "DATACENTER_MAINTENANCE",
  "SOFTWARE_UPGRADE",
  "OTHER_MAINTENANCE"
];

export const MaintenanceForm: React.FC<MaintenanceFormProps> = ({ onSubmit, onPreview, isLoading = false, isPreviewLoading = false, rateLimitRemaining }) => {
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<NotificationDraftInput>({
    resolver: zodResolver(notificationDraftInputSchema),
    defaultValues: {
      type: "MAINTENANCE",
      reason: "NETWORK_MAINTENANCE",
      start_at: "",
      end_at: "",
      downtime: false
    },
    mode: "onChange"
  });

  const watchedValues = watch();
  // For preview, we only need basic validation (not the 5-minute future requirement)
  const isPreviewValid =
    watchedValues.start_at &&
    watchedValues.end_at &&
    watchedValues.start_at !== "" &&
    watchedValues.end_at !== "" &&
    new Date(watchedValues.end_at) > new Date(watchedValues.start_at);
  // For submit, we need full validation including the 5-minute future requirement
  const isFormValid = isValid && watchedValues.start_at && watchedValues.end_at;

  // Debug logging
  console.log("Form state:", {
    watchedValues,
    isValid,
    isPreviewValid,
    isFormValid,
    errors
  });

  const handleFormSubmit = (data: NotificationDraftInput) => {
    onSubmit(data);
  };

  const handlePreview = () => {
    if (isPreviewValid) {
      onPreview(watchedValues);
    }
  };

  const formatDateTimeLocal = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleDateTimeChange = (field: "start_at" | "end_at", value: string) => {
    if (value) {
      // Create date from local datetime-local input value
      // The value is in format "YYYY-MM-DDTHH:MM" in local time
      const localDate = new Date(value);
      // Convert to UTC for storage
      setValue(field, localDate.toISOString());
    } else {
      setValue(field, "");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Notification Details</h3>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Maintenance Reason *
            </Label>
            <Select value={watchedValues.reason} onValueChange={value => setValue("reason", value as MaintenanceReason)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select maintenance reason" />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_REASONS.map(reason => (
                  <SelectItem key={reason} value={reason}>
                    {getReasonLabel(reason)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reason && <p className="text-sm text-red-600 dark:text-red-400">{errors.reason.message}</p>}
          </div>

          {/* Date and Time Range */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Maintenance Window</h4>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="start_at" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Time *
                </Label>
                <div className="relative">
                  <Input
                    id="start_at"
                    type="datetime-local"
                    value={formatDateTimeLocal(watchedValues.start_at)}
                    onChange={e => handleDateTimeChange("start_at", e.target.value)}
                    className="w-full"
                    placeholder="Select start time"
                  />
                  <Clock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                </div>
                {errors.start_at && <p className="text-sm text-red-600 dark:text-red-400">{errors.start_at.message}</p>}
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label htmlFor="end_at" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Time *
                </Label>
                <div className="relative">
                  <Input
                    id="end_at"
                    type="datetime-local"
                    value={formatDateTimeLocal(watchedValues.end_at)}
                    onChange={e => handleDateTimeChange("end_at", e.target.value)}
                    className="w-full"
                    placeholder="Select end time"
                  />
                  <Clock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                </div>
                {errors.end_at && <p className="text-sm text-red-600 dark:text-red-400">{errors.end_at.message}</p>}
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">Times are displayed in your local timezone and will be converted to UTC automatically</p>
          </div>

          {/* Downtime Impact */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="space-y-1">
              <Label htmlFor="downtime" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Downtime impact
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">If enabled, recipients will be told workloads may be impacted</p>
            </div>
            <Switch id="downtime" checked={watchedValues.downtime} onCheckedChange={checked => setValue("downtime", checked)} />
          </div>

          {/* Rate Limit Banner */}
          {rateLimitRemaining !== undefined && rateLimitRemaining <= 3 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
              <div className="flex items-center">
                <Calendar className="mr-2 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  You can send <strong>{rateLimitRemaining}</strong> more notification(s) today.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={!isPreviewValid || isPreviewLoading} className="flex items-center gap-2">
              {isPreviewLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  Previewing...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Preview
                </>
              )}
            </Button>

            <Button type="submit" disabled={!isFormValid || isLoading || rateLimitRemaining === 0} className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                "Send Notification"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
