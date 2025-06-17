"use client";
import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import type { Control } from "react-hook-form";
import { Controller, useFieldArray } from "react-hook-form";
import { Button, CustomNoDivTooltip, FormField, FormInput, Popup, Switch } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Bin } from "iconoir-react";
import { nanoid } from "nanoid";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import type { EnvironmentVariableType, RentGpusFormValuesType, SdlBuilderFormValuesType } from "@src/types";
import { FormPaper } from "../FormPaper";

export const COMPONENTS = {
  FormPaper,
  Popup,
  FormField,
  FormInput,
  Button,
  CustomNoDivTooltip,
  Controller,
  Switch
};

export type EnvFormModalProps = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariableType[];
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
  isRemoteDeployEnvHidden?: boolean;
  isUpdate?: boolean;
  pathPrefix?: string;
  components?: typeof COMPONENTS;
};

export const EnvFormModal: React.FunctionComponent<EnvFormModalProps> = ({
  control,
  serviceIndex,
  envs: _envs,
  onClose,
  hasSecretOption = true,
  isRemoteDeployEnvHidden,
  isUpdate,
  components: c = COMPONENTS
}) => {
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv,
    update: updateEnv
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });
  const filteredEnvs = envs?.filter(e => !isRemoteDeployEnvHidden || !(e?.key?.trim() in protectedEnvironmentVariables));

  useEffect(() => {
    const noEnvsExist = _envs.length === 0;
    const noUserAddedEnvs = _envs.filter(e => !(e?.key?.trim() in protectedEnvironmentVariables)).length === 0;
    const shouldAddEnv = noEnvsExist || (isRemoteDeployEnvHidden && noUserAddedEnvs && !isUpdate);

    if (shouldAddEnv) {
      onAddEnv();
    }
  }, []);

  const onAddEnv = useCallback(() => {
    appendEnv({ id: nanoid(), key: "", value: "", isSecret: false });
  }, [appendEnv]);

  const _onClose = useCallback(() => {
    const _envToRemove: number[] = [];

    _envs.forEach((e, i) => {
      if (!e.key.trim()) {
        _envToRemove.push(i);
      }
    });

    removeEnv(_envToRemove);

    onClose();
  }, [onClose, removeEnv, _envs]);

  const updateEnvVars = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>, focusedEnvIndex: number) => {
      const pastedText = event.clipboardData.getData("text")?.trim();
      if (!pastedText || !pastedText.includes("=")) return;

      const lines = pastedText.split("\n");

      let didUpdate = false;
      lines.forEach(line => {
        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) return;

        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim();
        if (!key || key in protectedEnvironmentVariables) return;
        didUpdate = true;

        const existingEnvIndex = filteredEnvs.findIndex(env => env.key === key);

        if (existingEnvIndex === -1) {
          appendEnv({ id: nanoid(), key, value, isSecret: false });
        } else {
          updateEnv(existingEnvIndex, { ...filteredEnvs[existingEnvIndex], value });
        }
      });

      if (didUpdate) {
        event.preventDefault();
        if (!filteredEnvs[focusedEnvIndex]?.key.trim()) {
          removeEnv(focusedEnvIndex);
        }
      }
    },
    [appendEnv, filteredEnvs, removeEnv, updateEnv]
  );

  const clearOrRemoveEnv = useCallback(
    (envIndex: number) => {
      if (filteredEnvs.length > 1) {
        removeEnv(envIndex);
      } else {
        updateEnv(envIndex, { key: "", value: "", isSecret: false });
      }
    },
    [filteredEnvs, removeEnv, updateEnv]
  );

  return (
    <c.Popup
      fullWidth
      open
      variant="custom"
      title="Edit Environment Variables"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "ghost",
          side: "left",
          onClick: _onClose
        },
        {
          label: "Add Variable",
          color: "secondary",
          variant: "default",
          side: "right",
          onClick: onAddEnv
        }
      ]}
      onClose={_onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <c.FormPaper className="!bg-popover">
        {filteredEnvs?.map((env, envIndex) => {
          const currentEnvIndex = envs.findIndex(e => e.id === env.id);
          const isLastEnv = envIndex + 1 === filteredEnvs.length;
          return (
            <div key={env.id} className={cn("flex", { ["mb-2"]: !isLastEnv })}>
              <div className="flex flex-grow flex-col items-end sm:flex-row">
                <c.FormField
                  control={control}
                  name={`services.${serviceIndex}.env.${currentEnvIndex}.key`}
                  render={({ field }) => (
                    <div className="basis-[40%]">
                      <c.FormInput
                        type="text"
                        label="Key"
                        color="secondary"
                        value={field.value}
                        onChange={event => field.onChange(event.target.value)}
                        onPaste={event => updateEnvVars(event, currentEnvIndex)}
                        className="w-full"
                      />
                    </div>
                  )}
                />

                <c.FormField
                  control={control}
                  name={`services.${serviceIndex}.env.${currentEnvIndex}.value`}
                  render={({ field }) => (
                    <div className="ml-2 flex-grow">
                      <c.FormInput
                        type="text"
                        label="Value"
                        color="secondary"
                        value={field.value}
                        onChange={event => field.onChange(event.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                />
              </div>

              <div
                className={cn("flex w-[50px] flex-col items-start pl-2", {
                  ["justify-between"]: envIndex > 0,
                  ["justify-end"]: envIndex === 0 || !hasSecretOption
                })}
              >
                {(filteredEnvs.length > 1 || env.key.trim()) && (
                  <c.Button onClick={() => clearOrRemoveEnv(currentEnvIndex)} size="icon" variant="ghost" aria-label="Delete Environment Variable">
                    <Bin />
                  </c.Button>
                )}

                {hasSecretOption && (
                  <c.Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${currentEnvIndex}.isSecret`}
                    render={({ field }) => (
                      <c.CustomNoDivTooltip
                        title={
                          <>
                            <p>
                              <strong>Secret</strong>
                            </p>
                            <p className="text-sm">
                              This is for secret variables containing sensitive information you don't want to be saved in your template.
                            </p>
                          </>
                        }
                      >
                        <c.Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </c.CustomNoDivTooltip>
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </c.FormPaper>
    </c.Popup>
  );
};
