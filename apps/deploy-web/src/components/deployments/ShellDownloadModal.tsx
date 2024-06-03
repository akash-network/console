"use client";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { event } from "nextjs-google-analytics";

import { Popup } from "@src/components/shared/Popup";
import { Alert } from "@src/components/ui/alert";
import { InputWithIcon } from "@src/components/ui/input";
import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";
import { AnalyticsEvents } from "@src/utils/analytics";

export const ShellDownloadModal = ({ selectedLease, onCloseClick, selectedService, providerInfo }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { downloadFileFromShell } = useBackgroundTask();
  const {
    handleSubmit,
    control,
    formState: { errors }
  } = useForm({
    defaultValues: {
      filePath: ""
    }
  });

  const onSubmit = async ({ filePath }) => {
    downloadFileFromShell(providerInfo.hostUri, selectedLease.dseq, selectedLease.gseq, selectedLease.oseq, selectedService, filePath);

    event(AnalyticsEvents.DOWNLOADED_SHELL_FILE, {
      category: "deployments",
      label: "Download file from shell"
    });

    onCloseClick();
  };

  const onDownloadClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Download file"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onCloseClick
        },
        {
          label: "Download",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: !!errors.filePath,
          onClick: onDownloadClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="xs"
    >
      <p className="text-muted-foreground text-xs">Enter the path of a file on the server to be downloaded to your computer. Example: /app/logs.txt</p>
      <Alert variant="warning" className="my-2 py-2">
        <p className="text-xs">This is an experimental feature and may not work reliably.</p>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Controller
          control={control}
          name="filePath"
          rules={{
            required: "File path is required.",
            pattern: {
              value: /^(?!https?:).*/i,
              message: "Should be a valid path on the server, not a URL."
            }
          }}
          render={({ field, fieldState }) => {
            return (
              <InputWithIcon
                {...field}
                type="text"
                label="File path"
                // error={!!fieldState.error}
                error={fieldState.error?.message}
                // helperText={fieldState.error?.message}
                autoFocus
                placeholder="Example: /app/logs.txt"
              />
            );
          }}
        />
      </form>
    </Popup>
  );
};
