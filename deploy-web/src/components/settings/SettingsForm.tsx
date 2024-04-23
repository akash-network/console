"use client";
import { useState, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { NodeStatus } from "@src/components/shared/NodeStatus";
import { isUrl } from "@src/utils/stringUtils";
import { BlockchainNode, useSettings } from "@src/context/SettingsProvider/SettingsProviderContext";
import { SwitchWithLabel } from "@src/components/ui/switch";
import { Label } from "@src/components/ui/label";
import FormControl from "@mui/material/FormControl";
import { Button } from "@src/components/ui/button";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import Spinner from "@src/components/shared/Spinner";
import { NavArrowDown, Refresh } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";
import InputAdornment from "@mui/material/InputAdornment";

type Props = {};

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

  const onIsCustomNodeChange = (checked: boolean) => {
    const apiEndpoint = checked ? settings.apiEndpoint : (selectedNode?.api as string);
    const rpcEndpoint = checked ? settings.rpcEndpoint : (selectedNode?.rpc as string);

    reset();

    const newSettings = { ...settings, isCustomNode: checked, apiEndpoint, rpcEndpoint };
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
    <div className="pt-6">
      <div className="pb-2">
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
                        className="flex-1"
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
                        className="flex-1"
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
                    reset({}, { keepDefaultValues: true });
                    setIsEditing(false);
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button variant="default" type="submit" className="ml-4" onClick={() => formRef.current?.dispatchEvent(new Event("submit"))} size="sm">
                  Submit
                </Button>
              </>
            )}
          </div>
        </form>
      )}

      {!settings.isCustomNode && (
        <div className="mt-4">
          <FormGroup>
            <div className="flex items-center">
              <FormControl className="flex-1">
                <Autocomplete
                  disableClearable
                  open={isNodesOpen}
                  options={nodes.map(n => n.id)}
                  value={settings.selectedNode?.id}
                  defaultValue={settings.selectedNode?.id}
                  fullWidth
                  size="small"
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
                          classes: { root: cn("!pr-3 cursor-pointer"), input: "cursor-pointer" },
                          endAdornment: (
                            <InputAdornment position="end">
                              <div className="mr-2 inline-flex">
                                <NavArrowDown className="text-sm" />
                              </div>
                              <NodeStatus latency={Math.floor(selectedNode?.latency || 0)} status={selectedNode?.status || ""} />
                            </InputAdornment>
                          )
                        }}
                      />
                    </ClickAwayListener>
                  )}
                  renderOption={(props, option) => {
                    const node = nodes.find(n => n.id === option);

                    return (
                      <li className="flex w-full items-center justify-between px-2 py-1" {...props}>
                        <div>{option}</div>
                        <NodeStatus latency={Math.floor(node?.latency || 0)} status={node?.status || ""} />
                      </li>
                    );
                  }}
                  disabled={settings.isCustomNode}
                />
              </FormControl>

              <div className="ml-4">
                <Button onClick={() => onRefreshNodeStatus()} aria-label="refresh" disabled={isRefreshingNodeStatus} size="icon" variant="outline">
                  {isRefreshingNodeStatus ? <Spinner size="small" /> : <Refresh />}
                </Button>
              </div>
            </div>
          </FormGroup>
        </div>
      )}
    </div>
  );
};
