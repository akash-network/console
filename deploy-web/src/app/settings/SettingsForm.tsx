"use client";
import { useState, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  FormLabel,
  TextField,
  FormControlLabel,
  FormControl,
  Switch,
  FormGroup,
  InputAdornment,
  IconButton,
  CircularProgress,
  ClickAwayListener,
  Autocomplete
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useSettings } from "../../context/SettingsProvider";
import { Controller, useForm } from "react-hook-form";
import { makeStyles } from "tss-react/mui";
import { NodeStatus } from "@src/components/shared/NodeStatus";
import { isUrl } from "@src/utils/stringUtils";
import { cx } from "@emotion/css";

type Props = {};

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  form: {
    padding: "1rem 0 0"
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: ".5rem"
  },
  formLabel: {
    flexBasis: "20%",
    minWidth: 150,
    paddingRight: "1rem"
  },
  formControl: {
    width: "100%"
  },
  formValue: {
    flexGrow: 1
  },
  submitButton: {
    marginLeft: "1rem"
  },
  nodeInput: {
    paddingRight: "1rem !important"
  },
  inputClickable: {
    cursor: "pointer"
  }
}));

export const SettingsForm: React.FunctionComponent<Props> = ({}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isNodesOpen, setIsNodesOpen] = useState(false);
  const { classes } = useStyles();
  const { settings, setSettings, refreshNodeStatuses, isRefreshingNodeStatus } = useSettings();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm();
  const formRef = useRef(null);
  const { selectedNode, nodes } = settings;

  const onIsCustomNodeChange = event => {
    const isChecked = event.target.checked;
    const apiEndpoint = isChecked ? settings.apiEndpoint : selectedNode.api;
    const rpcEndpoint = isChecked ? settings.rpcEndpoint : selectedNode.rpc;

    reset();

    const newSettings = { ...settings, isCustomNode: isChecked, apiEndpoint, rpcEndpoint };
    setSettings(newSettings);
    refreshNodeStatuses(newSettings);
  };

  const onNodeChange = (event, newNodeId) => {
    const newNode = nodes.find(n => n.id === newNodeId);
    const apiEndpoint = newNode.api;
    const rpcEndpoint = newNode.rpc;

    setSettings({ ...settings, apiEndpoint, rpcEndpoint, selectedNode: newNode });
  };

  const onRefreshNodeStatus = async () => {
    await refreshNodeStatuses();
  };

  /**
   *  Update the custom settings
   * @param {Object} data {apiEndpoint: string, rpcEndpoint: string}
   */
  const onSubmit = data => {
    const customNodeUrl = new URL(data.apiEndpoint);
    setIsEditing(false);

    const newSettings = { ...settings, ...data, customNode: { ...settings.customNode, id: customNodeUrl.hostname } };
    setSettings(newSettings);
    refreshNodeStatuses(newSettings);
  };

  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={!!settings.isCustomNode} onChange={onIsCustomNodeChange} color="secondary" sx={{ marginLeft: ".5rem" }} />}
        label="Custom node"
        labelPlacement="start"
        sx={{ marginLeft: 0 }}
      />

      {settings.isCustomNode && (
        <form className={classes.form} onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <div className={classes.fieldRow}>
            <FormLabel className={classes.formLabel}>Api Endpoint:</FormLabel>

            {isEditing ? (
              <FormControl error={!errors.apiEndpoint} className={classes.formControl}>
                <Controller
                  control={control}
                  name="apiEndpoint"
                  rules={{
                    required: true,
                    validate: v => isUrl(v)
                  }}
                  defaultValue={settings.apiEndpoint}
                  render={({ fieldState, field }) => {
                    const helperText = fieldState.error?.type === "validate" ? "Url is invalid." : "Api endpoint is required.";

                    return (
                      <TextField
                        {...field}
                        type="text"
                        variant="outlined"
                        error={!!fieldState.error}
                        helperText={fieldState.error && helperText}
                        className={classes.formValue}
                        size="small"
                      />
                    );
                  }}
                />
              </FormControl>
            ) : (
              <Typography variant="body1" className={classes.formValue}>
                {settings.apiEndpoint}
              </Typography>
            )}
          </div>

          <div className={classes.fieldRow}>
            <FormLabel className={classes.formLabel}>Rpc Endpoint:</FormLabel>

            {isEditing ? (
              <FormControl error={!errors.apiEndpoint} className={classes.formControl}>
                <Controller
                  control={control}
                  name="rpcEndpoint"
                  rules={{
                    required: true,
                    validate: v => isUrl(v)
                  }}
                  defaultValue={settings.rpcEndpoint}
                  render={({ fieldState, field }) => {
                    const helperText = fieldState.error?.type === "validate" ? "Url is invalid." : "Rpc endpoint is required.";

                    return (
                      <TextField
                        {...field}
                        type="text"
                        variant="outlined"
                        error={!!fieldState.error}
                        helperText={fieldState.error && helperText}
                        className={classes.formValue}
                        size="small"
                      />
                    );
                  }}
                />
              </FormControl>
            ) : (
              <Typography variant="body1" className={classes.formValue}>
                {settings.rpcEndpoint}
              </Typography>
            )}
          </div>

          <Box paddingTop="1rem">
            {!isEditing && (
              <Button variant="contained" color="secondary" onClick={() => setIsEditing(!isEditing)} size="small">
                Edit
              </Button>
            )}

            {isEditing && (
              <>
                <Button
                  variant="text"
                  onClick={() => {
                    reset(null, { keepDefaultValues: true });
                    setIsEditing(false);
                  }}
                  size="small"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  type="submit"
                  className={classes.submitButton}
                  onClick={() => formRef.current.dispatchEvent(new Event("submit"))}
                  size="small"
                >
                  Submit
                </Button>
              </>
            )}
          </Box>
        </form>
      )}

      {!settings.isCustomNode && (
        <Box marginTop="1rem">
          <FormGroup>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <FormControl sx={{ flexGrow: 1 }}>
                <Autocomplete
                  disableClearable
                  open={isNodesOpen}
                  options={nodes.map(n => n.id)}
                  value={settings.selectedNode.id}
                  defaultValue={settings.selectedNode.id}
                  fullWidth
                  onChange={onNodeChange}
                  renderInput={params => (
                    <ClickAwayListener onClickAway={() => setIsNodesOpen(false)}>
                      <TextField
                        {...params}
                        label="Node"
                        variant="outlined"
                        onClick={() => setIsNodesOpen(prev => !prev)}
                        InputProps={{
                          ...params.InputProps,
                          classes: { root: cx(classes.nodeInput, classes.inputClickable), input: classes.inputClickable },
                          endAdornment: (
                            <InputAdornment position="end">
                              <Box marginRight=".5rem" display="inline-flex">
                                <KeyboardArrowDownIcon fontSize="small" />
                              </Box>
                              <NodeStatus latency={Math.floor(selectedNode.latency)} status={selectedNode.status} />
                            </InputAdornment>
                          )
                        }}
                      />
                    </ClickAwayListener>
                  )}
                  renderOption={(props, option) => {
                    const node = nodes.find(n => n.id === option);

                    return (
                      <Box
                        component="li"
                        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between !important", width: "100%", padding: ".2rem .5rem" }}
                        {...props}
                      >
                        <div>{option}</div>
                        <NodeStatus latency={Math.floor(node.latency)} status={node.status} />
                      </Box>
                    );
                  }}
                  disabled={settings.isCustomNode}
                />
              </FormControl>

              <Box marginLeft="1rem">
                <IconButton onClick={() => onRefreshNodeStatus()} aria-label="refresh" disabled={isRefreshingNodeStatus}>
                  {isRefreshingNodeStatus ? <CircularProgress size="1.5rem" color="secondary" /> : <RefreshIcon />}
                </IconButton>
              </Box>
            </Box>
          </FormGroup>
        </Box>
      )}
    </Box>
  );
};
