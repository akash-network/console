"use client";
import { useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";
import { Popup } from "@src/components/shared/Popup";
import { Alert } from "@src/components/ui/alert";
import { InputWithIcon } from "@src/components/ui/input";

// const useStyles = makeStyles()(theme => ({
//   dialogTitle: {
//     paddingBottom: 0
//   },
//   dialogActions: {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "space-between"
//   },
//   formControl: {
//     marginBottom: "1rem"
//   },
//   alert: {
//     marginBottom: "1rem"
//   }
// }));

// const osList = [
//   { id: "linux", title: "Linux" },
//   { id: "macos", title: "MacOS" },
//   { id: "windows", title: "Windows" }
// ];

export const ShellDownloadModal = ({ selectedLease, onCloseClick, selectedService, providerInfo }) => {
  //const [selectedOs] = useState("linux");
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

  // const handleOsChange = (event) => {
  //   setSelectedOs(event.target.value);
  // };

  return (
    <Popup
      fullWidth
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
      <p className="text-sm text-muted-foreground">Enter the path of a file on the server to be downloaded to your computer. Example: /app/logs.txt</p>
      <Alert variant="warning" className="mb-4">
        <p className="text-sm text-muted-foreground">This is an experimental feature and may not work reliably.</p>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        {/* <FormControl className={classes.formControl}>
            <InputLabel id="os-label">Os</InputLabel>
            <Select labelId="os-label" id="os-select" value={selectedOs} onChange={handleOsChange}>
              {osList.map((os) => (
                <MenuItem key={os.id} value={os.id}>
                  {os.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl> */}

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
                placeholder="Type a valid file path"
              />
            );
          }}
        />
      </form>
    </Popup>
  );
};
