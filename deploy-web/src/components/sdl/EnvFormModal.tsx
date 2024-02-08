"use client";
import { ReactNode, useEffect } from "react";
import { Popup } from "../shared/Popup";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { EnvironmentVariable, RentGpusFormValues, SdlBuilderFormValues } from "@src/types";
import { nanoid } from "nanoid";
import { Card, CardContent } from "../ui/card";
import { cn } from "@src/utils/styleUtils";
import { FormInput, Input } from "../ui/input";
import { Bin } from "iconoir-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Switch } from "../ui/switch";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  envs: EnvironmentVariable[];
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  hasSecretOption?: boolean;
  children?: ReactNode;
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

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
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <div className="pt-4">
        {envs.map((env, envIndex) => {
          return (
            <Card
              key={env.id}
              className={cn("flex", { ["mb-2"]: envIndex + 1 !== envs.length })}
              // sx={{ display: "flex", marginBottom: envIndex + 1 === envs.length ? 0 : ".5rem" }}
            >
              <CardContent>
                <div
                  className="flex flex-grow flex-col items-center sm:flex-row"
                  // sx={{ flexGrow: 1, display: "flex", alignItems: "center", flexDirection: { xs: "column", sm: "row" } }}
                >
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${envIndex}.key`}
                    render={({ field }) => (
                      <FormInput
                        type="text"
                        // variant="outlined"
                        label="Key"
                        color="secondary"
                        // fullWidth
                        value={field.value}
                        // size="small"
                        onChange={event => field.onChange(event.target.value)}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.env.${envIndex}.value`}
                    render={({ field }) => (
                      <FormInput
                        className="ml-2"
                        // sx={{ marginLeft: ".5rem" }}
                        type="text"
                        // variant="outlined"
                        label="Value"
                        color="secondary"
                        // fullWidth
                        value={field.value}
                        // size="small"
                        onChange={event => field.onChange(event.target.value)}
                      />
                    )}
                  />
                </div>

                <div
                  className={cn("flex w-[45px] flex-col items-center pl-2", { ["justify-around"]: envIndex > 0, ["justify-end"]: envIndex === 0 })}
                  // sx={{
                  //   paddingLeft: ".5rem",
                  //   display: "flex",
                  //   alignItems: "center",
                  //   flexDirection: "column",
                  //   justifyContent: envIndex > 0 ? "space-around" : "flex-end",
                  //   width: "45px"
                  // }}
                >
                  {envIndex > 0 && (
                    <Button onClick={() => removeEnv(envIndex)} size="icon">
                      <Bin />
                    </Button>
                  )}

                  {hasSecretOption && (
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.env.${envIndex}.isSecret`}
                      render={({ field }) => (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Switch
                              checked={field.value || false}
                              onChange={field.onChange}
                              // color="secondary"
                              // size="small" sx={{ margin: 0 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <>
                              <p>
                                <strong>Secret</strong>
                              </p>
                              <p className="text-sm">
                                This is for secret variables containing sensitive information you don't want to be saved in your template.
                              </p>
                            </>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Popup>
  );
};
