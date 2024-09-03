"use client";
import { ReactNode, useState } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Button, CustomNoDivTooltip, FormInput, Switch } from "@akashnetwork/ui/components";
import clsx from "clsx";
import { Bin, Eye, EyeClosed } from "iconoir-react";
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
  subComponent?: boolean;
};

export const EnvFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, hasSecretOption = true, subComponent }) => {
  // const [envs, setEnvs] = useState<EnvironmentVariable[]>(_envs);
  const {
    fields: envs,
    remove: removeEnv,
    append: appendEnv
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });

  // useEffect(() => {
  //   if (_envs.length === 0) {
  //     onAddEnv();
  //   }
  // }, []);

  const onAddEnv = () => {
    appendEnv({ id: nanoid(), key: "", value: "", isSecret: false });
  };

  return (
    <div className={clsx("flex flex-col gap-3", !subComponent && "rounded md:border md:p-4")}>
      {!subComponent && <h1 className="text-sm font-bold">Environment Variables</h1>}
      <FormPaper contentClassName=" ">
        {envs.filter(env => !hiddenEnv.includes(env?.key?.trim())).length === 0 && (
          <p className="text-sm text-muted-foreground">No environment variables added.</p>
        )}
        {envs.map((env, envIndex) => {
          return (
            <div key={env.id} className={cn("flex", { ["mb-2"]: envIndex + 1 !== envs.length }, { ["hidden"]: hiddenEnv.includes(env?.key?.trim()) })}>
              <div className="flex flex-grow flex-col items-end gap-4 sm:flex-row">
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.env.${envIndex}.key`}
                  render={({ field }) => (
                    <div className="w-full md:w-auto md:basis-[40%]">
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
                    <div className="w-full md:ml-2 md:w-auto md:flex-grow">
                      <EnvPasswordInput field={field} label="Value" />
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
      <Button onClick={onAddEnv} size="sm" variant="default" className="w-min">
        Add Variable
      </Button>
    </div>
  );
};

const EnvPasswordInput = ({ field, label }: { field: any; label: string }) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative flex flex-col">
      <FormInput
        type={showPassword ? "text" : "password"}
        label={label}
        color="secondary"
        value={field.value}
        onChange={event => field.onChange(event.target.value)}
        className="w-full pr-12"
        autoComplete="new-password"
      />

      <Button onClick={() => setShowPassword(!showPassword)} variant="text" size="icon" className="absolute right-0 top-[72%] mr-2 -translate-y-1/2 transform">
        {!showPassword ? <EyeClosed /> : <Eye />}
      </Button>
    </div>
  );
};
