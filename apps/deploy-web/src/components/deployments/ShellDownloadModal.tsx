"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { Alert, FormField, FormInput, Input, Popup } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { event } from "nextjs-google-analytics";
import { z } from "zod";

import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";
import { AnalyticsEvents } from "@src/utils/analytics";

const formSchema = z.object({
  filePath: z
    .string({
      message: "File path is required."
    })
    .regex(/^(?!https?:).*/i, {
      message: "Should be a valid path on the server, not a URL."
    })
});

export const ShellDownloadModal = ({ selectedLease, onCloseClick, selectedService, providerInfo }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { downloadFileFromShell } = useBackgroundTask();
  const {
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      filePath: ""
    },
    resolver: zodResolver(formSchema)
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
      <p className="text-xs text-muted-foreground">Enter the path of a file on the server to be downloaded to your computer. Example: /app/logs.txt</p>
      <Alert variant="warning" className="my-2 py-2">
        <p className="text-xs">This is an experimental feature and may not work reliably.</p>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <FormField
          control={control}
          name="filePath"
          render={({ field }) => {
            return <FormInput {...field} type="text" label="File path" autoFocus placeholder="Example: /app/logs.txt" />;
          }}
        />
      </form>
    </Popup>
  );
};
