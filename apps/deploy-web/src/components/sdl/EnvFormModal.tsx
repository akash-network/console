"use client";
import { ReactNode, useEffect } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Bin } from "iconoir-react";
import { nanoid } from "nanoid";

import { EnvironmentVariable, RentGpusFormValues, SdlBuilderFormValues } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { CustomNoDivTooltip } from "../shared/CustomTooltip";
import { Popup } from "../shared/Popup";
import { Button, FormInput, Switch } from "@akashnetwork/ui/components";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariable[];
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
};

export const EnvFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, envs: _envs, onClose, hasSecretOption = true }) => {
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });

  useEffect(() => {
    if (_envs.length === 0) {
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
      <FormPaper contentClassName="bg-popover">
        {envs.map((env, envIndex) => {
          return (
            <div key={env.id} className={cn("flex", { ["mb-2"]: envIndex + 1 !== envs.length })}>
              <div className="flex flex-grow flex-col items-end sm:flex-row">
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.env.${envIndex}.key`}
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

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.env.${envIndex}.value`}
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
                  <Button onClick={() => removeEnv(envIndex)} size="icon" variant="ghost">
                    <Bin />
                  </Button>
                )}

                {hasSecretOption && (
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${envIndex}.isSecret`}
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
