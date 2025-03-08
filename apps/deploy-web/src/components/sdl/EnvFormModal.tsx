"use client";
import { ReactNode, useEffect } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Button, CustomNoDivTooltip, FormField, FormInput, Popup, Switch } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Bin } from "iconoir-react";
import { nanoid } from "nanoid";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { EnvironmentVariableType, RentGpusFormValuesType, SdlBuilderFormValuesType } from "@src/types";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariableType[];
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
  isRemoteDeployEnvHidden?: boolean;
  isUpdate?: boolean;
};

export const EnvFormModal: React.FunctionComponent<Props> = ({
  control,
  serviceIndex,
  envs: _envs,
  onClose,
  hasSecretOption = true,
  isRemoteDeployEnvHidden,
  isUpdate
}) => {
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv
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

  const onAddEnv = () => {
    appendEnv({ id: nanoid(), key: "", value: "", isSecret: false });
  };

  const _onClose = () => {
    const _envToRemove: number[] = [];

    _envs.forEach((e, i) => {
      if (!e.key.trim()) {
        _envToRemove.push(i);
      }
    });

    removeEnv(_envToRemove);

    onClose();
  };

  return (
    <Popup
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
      <FormPaper className="!bg-popover">
        {filteredEnvs?.map((env, envIndex) => {
          const currentEnvIndex = envs.findIndex(e => e.id === env.id);
          const isLastEnv = envIndex + 1 === filteredEnvs.length;
          return (
            <div key={env.id} className={cn("flex", { ["mb-2"]: !isLastEnv })}>
              <div className="flex flex-grow flex-col items-end sm:flex-row">
                <FormField
                  control={control}
                  name={`services.${serviceIndex}.env.${currentEnvIndex}.key`}
                  render={({ field }) => (
                    <div className="basis-[40%]">
                      <FormInput
                        type="text"
                        label="Key"
                        color="secondary"
                        value={field.value}
                        onChange={event => field.onChange(event.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                />

                <FormField
                  control={control}
                  name={`services.${serviceIndex}.env.${currentEnvIndex}.value`}
                  render={({ field }) => (
                    <div className="ml-2 flex-grow">
                      <FormInput
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
                {envIndex > 0 && (
                  <Button onClick={() => removeEnv(currentEnvIndex)} size="icon" variant="ghost">
                    <Bin />
                  </Button>
                )}

                {hasSecretOption && (
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${currentEnvIndex}.isSecret`}
                    render={({ field }) => (
                      <CustomNoDivTooltip
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
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </CustomNoDivTooltip>
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </FormPaper>
    </Popup>
  );
};
