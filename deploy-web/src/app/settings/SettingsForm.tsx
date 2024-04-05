"use client";
import { useState, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { NodeStatus } from "@src/components/shared/NodeStatus";
import { isUrl } from "@src/utils/stringUtils";
import { cx } from "@emotion/css";
import { BlockchainNode, useSettings } from "@src/context/SettingsProvider/SettingsProviderContext";
import { Switch, SwitchWithLabel } from "@src/components/ui/switch";
import { Label } from "@src/components/ui/label";
import FormControl from "@mui/material/FormControl";
import { Button } from "@src/components/ui/button";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Autocomplete from "@mui/material/Autocomplete";

type Props = {};

// const useStyles = makeStyles()(theme => ({
//   title: {
//     fontSize: "1.5rem",
//     fontWeight: "bold"
//   },
//   form: {
//     padding: "1rem 0 0"
//   },
//   fieldRow: {
//     display: "flex",
//     alignItems: "center",
//     marginBottom: ".5rem"
//   },
//   formLabel: {
//     flexBasis: "20%",
//     minWidth: 150,
//     paddingRight: "1rem"
//   },
//   formControl: {
//     width: "100%"
//   },
//   formValue: {
//     flexGrow: 1
//   },
//   submitButton: {
//     marginLeft: "1rem"
//   },
//   nodeInput: {
//     paddingRight: "1rem !important"
//   },
//   inputClickable: {
//     cursor: "pointer"
//   }
// }));

export const SettingsForm: React.FunctionComponent<Props> = ({}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isNodesOpen, setIsNodesOpen] = useState(false);
  const { settings, setSettings, refreshNodeStatuses, isRefreshingNodeStatus } = useSettings();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm();
  const formRef = useRef<HTMLFormElement>(null);
  const { selectedNode, nodes } = settings;

  const onIsCustomNodeChange = event => {
    const isChecked = event.target.checked;
    const apiEndpoint = isChecked ? settings.apiEndpoint : (selectedNode?.api as string);
    const rpcEndpoint = isChecked ? settings.rpcEndpoint : (selectedNode?.rpc as string);

    reset();

    const newSettings = { ...settings, isCustomNode: isChecked, apiEndpoint, rpcEndpoint };
    setSettings(newSettings);
    refreshNodeStatuses(newSettings);
  };

  const onNodeChange = (event, newNodeId) => {
    const newNode = nodes.find(n => n.id === newNodeId);
    const apiEndpoint = newNode?.api as string;
    const rpcEndpoint = newNode?.rpc as string;

    setSettings({ ...settings, apiEndpoint, rpcEndpoint, selectedNode: newNode as BlockchainNode });
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
    <div>
      <div className="ml-2">
        <SwitchWithLabel checked={!!settings.isCustomNode} onCheckedChange={onIsCustomNodeChange} label="Custom Node" />
      </div>

      {settings.isCustomNode && (
        <form className="pt-4" onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <div className="mb-2 flex items-center">
            <Label className="min-w-[150px] basis-[20%] pr-4">Api Endpoint:</Label>

            {isEditing ? (
              <FormControl error={!errors.apiEndpoint} className="w-full">
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
              <p className="flex-grow">{settings.apiEndpoint}</p>
            )}
          </div>

          <div className="mb-2 flex items-center">
            <Label className="min-w-[150px] basis-[20%] pr-4">Rpc Endpoint:</Label>

            {isEditing ? (
              <FormControl error={!errors.apiEndpoint} className="w-full">
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
              <p className="flex-grow">{settings.rpcEndpoint}</p>
            )}
          </div>

          <div className="pt-4">
            {!isEditing && (
              <Button variant="default" onClick={() => setIsEditing(!isEditing)} size="sm">
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
                  variant="default"
                  type="submit"
                  className={classes.submitButton}
                  onClick={() => formRef.current.dispatchEvent(new Event("submit"))}
                  size="sm"
                >
                  Submit
                </Button>
              </>
            )}
          </div>
        </form>
      )}

      {!settings.isCustomNode && (
        <div marginTop="1rem">
          <FormGroup>
            <div className="flex items-center">
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
                              <div marginRight=".5rem" display="inline-flex">
                                <KeyboardArrowDownIcon fontSize="small" />
                              </div>
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

              <div marginLeft="1rem">
                <IconButton onClick={() => onRefreshNodeStatus()} aria-label="refresh" disabled={isRefreshingNodeStatus}>
                  {isRefreshingNodeStatus ? <CircularProgress size="1.5rem" color="secondary" /> : <RefreshIcon />}
                </IconButton>
              </div>
            </div>
          </FormGroup>
        </div>
      )}
    </div>
  );
};
