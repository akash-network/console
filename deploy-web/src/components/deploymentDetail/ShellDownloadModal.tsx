import { useRef } from "react";
import { Dialog, DialogContent, DialogActions, Button, CircularProgress, TextField, FormControl, DialogTitle, Typography, Alert } from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { makeStyles } from "tss-react/mui";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useBackgroundTask } from "@src/context/BackgroundTaskProvider";

const useStyles = makeStyles()(theme => ({
  dialogTitle: {
    paddingBottom: 0
  },
  dialogActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  formControl: {
    marginBottom: "1rem"
  },
  alert: {
    marginBottom: "1rem"
  }
}));

// const osList = [
//   { id: "linux", title: "Linux" },
//   { id: "macos", title: "MacOS" },
//   { id: "windows", title: "Windows" }
// ];

export const ShellDownloadModal = ({ selectedLease, onCloseClick, selectedService, providerInfo }) => {
  //const [selectedOs] = useState("linux");
  const formRef = useRef(null);
  const { classes } = useStyles();
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
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  // const handleOsChange = (event) => {
  //   setSelectedOs(event.target.value);
  // };

  return (
    <Dialog open={true} maxWidth="xs" fullWidth onClose={onCloseClick}>
      <DialogTitle className={classes.dialogTitle}>Download file</DialogTitle>
      <DialogContent>
        <Alert severity="info" className={classes.alert}>
          <Typography variant="caption">Enter the path of a file on the server to be downloaded to your computer. Example: ~/app/logs.txt</Typography>
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

          <FormControl fullWidth>
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
                  <TextField
                    {...field}
                    type="text"
                    label="File path"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    variant="outlined"
                    autoFocus
                    placeholder="Type a valid file path"
                    fullWidth
                  />
                );
              }}
            />
          </FormControl>
        </form>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={onCloseClick}>Cancel</Button>
        <Button variant="contained" onClick={onDownloadClick} type="button" color="secondary" disabled={!!errors.filePath}>
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};
