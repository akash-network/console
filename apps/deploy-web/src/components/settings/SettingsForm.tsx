"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormField, FormInput, Label, Spinner, SwitchWithLabel } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import Autocomplete from "@mui/material/Autocomplete";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import FormControl from "@mui/material/FormControl";
import FormGroup from "@mui/material/FormGroup";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { NavArrowDown, Refresh } from "iconoir-react";
import { z } from "zod";

import { NodeStatus } from "@src/components/shared/NodeStatus";
import { BlockchainNode, useSettings } from "@src/context/SettingsProvider/SettingsProviderContext";
import { cn } from "@akashnetwork/ui/utils";

const formSchema = z.object({
  apiEndpoint: z
    .string()
    .min(1, {
      message: "Api endpoint is required."
    })
    .url({
      message: "Url is invalid."
    }),
  rpcEndpoint: z.string().min(1, "Rpc endpoint is required.").url({
    message: "Url is invalid."
  })
});

export const SettingsForm: React.FunctionComponent = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isNodesOpen, setIsNodesOpen] = useState(false);
  const { settings, setSettings, refreshNodeStatuses, isRefreshingNodeStatus } = useSettings();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  });
  const { control, handleSubmit, reset } = form;
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
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const customNodeUrl = new URL(data.apiEndpoint);
    setIsEditing(false);

    const newSettings = { ...settings, ...data, customNode: { ...(settings.customNode as BlockchainNode), id: customNodeUrl.hostname } };
    setSettings(newSettings);
    refreshNodeStatuses(newSettings);
  };

  return (
    <div className="pt-6">
      <div className="pb-2">
        <SwitchWithLabel checked={!!settings.isCustomNode} onCheckedChange={onIsCustomNodeChange} label="Custom Node" />
      </div>

      {settings.isCustomNode && (
        <Form {...form}>
          <form className="pt-4" onSubmit={handleSubmit(onSubmit)} ref={formRef}>
            <div className="mb-2 flex items-center">
              <Label className="min-w-[150px] basis-[20%] pr-4">Api Endpoint:</Label>

              {isEditing ? (
                <FormField
                  control={control}
                  name="apiEndpoint"
                  defaultValue={settings.apiEndpoint}
                  render={({ field }) => {
                    return <FormInput {...field} type="text" className="flex-1" />;
                  }}
                />
              ) : (
                <p className="flex-grow">{settings.apiEndpoint}</p>
              )}
            </div>

            <div className="mb-2 flex items-center">
              <Label className="min-w-[150px] basis-[20%] pr-4">Rpc Endpoint:</Label>

              {isEditing ? (
                <FormField
                  control={control}
                  name="rpcEndpoint"
                  defaultValue={settings.rpcEndpoint}
                  render={({ field }) => {
                    return <FormInput {...field} type="text" className="flex-1" />;
                  }}
                />
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
        </Form>
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
                                <NavArrowDown className="text-xs" />
                              </div>
                              <NodeStatus latency={Math.floor(selectedNode?.latency || 0)} status={selectedNode?.status || ""} variant="dense" />
                            </InputAdornment>
                          )
                        }}
                      />
                    </ClickAwayListener>
                  )}
                  renderOption={(props, option) => {
                    const node = nodes.find(n => n.id === option);

                    return (
                      <li {...props}>
                        <div className="flex w-full items-center justify-between px-2 py-1">
                          <div>{option}</div>
                          <NodeStatus latency={Math.floor(node?.latency || 0)} status={node?.status || ""} variant="dense" />
                        </div>
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
