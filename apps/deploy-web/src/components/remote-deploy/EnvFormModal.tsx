"use client";
import { ReactNode, useEffect, useState } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Button, CustomNoDivTooltip, FormField, FormInput, Popup, Switch } from "@akashnetwork/ui/components";
import { Bin } from "iconoir-react";
import { nanoid } from "nanoid";

import { EnvironmentVariableType, RentGpusFormValuesType, SdlBuilderFormValuesType } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { FormPaper } from "../sdl/FormPaper";
import { hiddenEnv } from "./utils";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariableType[];
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
  update?: boolean;
};

export const EnvFormModal: React.FunctionComponent<Props> = ({ update, control, serviceIndex, envs: _envs, onClose, hasSecretOption = true }) => {
  const [currentEnvs, setCurrentEnvs] = useState<EnvironmentVariableType[]>();
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });

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

  useEffect(() => {
    const CurEnvs = envs?.filter(e => !hiddenEnv.includes(e?.key?.trim()));
    setCurrentEnvs(CurEnvs);

    if (CurEnvs.length === 0 && !update) {
      onAddEnv();
    }
  }, [envs]);

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
        {currentEnvs?.map((env, envIndex) => {
          const index = envs?.findIndex(e => e.id === env.id);

          return (
            <div key={env.id} className={cn("flex", { ["mb-2"]: index + 1 !== currentEnvs.length })}>
              <div className="flex flex-grow flex-col items-end sm:flex-row">
                <FormField
                  control={control}
                  name={`services.${serviceIndex}.env.${index}.key`}
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
                  name={`services.${serviceIndex}.env.${index}.value`}
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
                  ["justify-between"]: index > 0,
                  ["justify-end"]: index === 0 || !hasSecretOption
                })}
              >
                {envIndex > 0 && (
                  <Button onClick={() => removeEnv(index)} size="icon" variant="ghost">
                    <Bin />
                  </Button>
                )}

                {hasSecretOption && (
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${index}.isSecret`}
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
