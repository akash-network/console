"use client";
import { ReactNode } from "react";
import { Control, Controller, useFieldArray, UseFormSetValue } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import { Button, Checkbox, CustomTooltip, FormField, FormItem, FormMessage, Input, Slider, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { default as MuiSelect } from "@mui/material/Select";
import { Bin, InfoCircle, Xmark } from "iconoir-react";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { GpuVendor } from "@src/types/gpu";
import { gpuVendors } from "@src/utils/akash/gpu";
import { validationConfig } from "@src/utils/akash/units";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  hasGpu: boolean;
  hideHasGpu?: boolean;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  gpuModels: GpuVendor[] | undefined;
  currentService: ServiceType;
  setValue: UseFormSetValue<RentGpusFormValuesType | SdlBuilderFormValuesType>;
};

export const GpuFormControl: React.FunctionComponent<Props> = ({ gpuModels, control, serviceIndex, hasGpu, currentService, setValue, hideHasGpu }) => {
  const {
    fields: formGpuModels,
    remove: removeFormGpuModel,
    append: appendFormGpuModel
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.profile.gpuModels`,
    keyName: "id"
  });

  const onAddGpuModel = () => {
    appendFormGpuModel({ vendor: "nvidia", name: "", memory: "", interface: "" });
  };

  return (
    <FormPaper>
      <div className="flex items-center">
        <FormField
          control={control}
          name={`services.${serviceIndex}.profile.gpu`}
          render={({ field, fieldState }) => (
            <FormItem className={cn("w-full")}>
              <div className="flex items-center">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <MdSpeed className="mr-2 text-2xl text-muted-foreground" />
                    <strong>GPU</strong>

                    <CustomTooltip
                      title={
                        <>
                          The amount of GPUs required for this workload.
                          <br />
                          <br />
                          You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any GPU model will
                          bid on your workload.
                          <br />
                          <br />
                          <a href="https://akash.network/docs/getting-started/stack-definition-language/#gpu-support" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>
                      }
                    >
                      <InfoCircle className="ml-4 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>

                  {!hideHasGpu && (
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.profile.hasGpu`}
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={checked => {
                            field.onChange(checked);
                            if (checked && formGpuModels.length === 0) {
                              onAddGpuModel();
                            }
                          }}
                          className="ml-2"
                        />
                      )}
                    />
                  )}
                </div>

                {hasGpu && (
                  <div className="ml-4">
                    <Input
                      type="number"
                      color="secondary"
                      value={field.value || ""}
                      error={!!fieldState.error}
                      onChange={event => field.onChange(parseFloat(event.target.value))}
                      min={1}
                      step={1}
                      max={validationConfig.maxGpuAmount}
                      inputClassName="w-[100px]"
                    />
                  </div>
                )}
              </div>

              {hasGpu && (
                <Slider
                  value={[field.value || 0]}
                  min={1}
                  max={validationConfig.maxGpuAmount}
                  step={1}
                  color="secondary"
                  aria-label="GPUs"
                  className="pt-2"
                  onValueChange={newValue => field.onChange(newValue)}
                />
              )}

              <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
            </FormItem>
          )}
        />
      </div>

      {hasGpu && (
        <>
          <div className="my-4">
            <p className="text-xs text-muted-foreground">
              Picking specific GPU models below, filters out providers that don't have those GPUs and may reduce the number of bids you receive.
            </p>
          </div>

          {formGpuModels.map((formGpu, formGpuIndex) => {
            const currentGpu = currentService.profile.gpuModels && currentService.profile.gpuModels[formGpuIndex];
            const models = gpuModels?.find(u => u.name === currentGpu?.vendor)?.models || [];
            const interfaces = models.find(m => m.name === currentGpu?.name)?.interface || [];
            const memorySizes = models.find(m => m.name === currentGpu?.name)?.memory || [];

            return (
              <div className="mb-2" key={`${formGpuIndex}${formGpu.vendor}${formGpu.name}${formGpu.memory}${formGpu.interface}`}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <div className="col-span-2">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.vendor`}
                      defaultValue=""
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel id="gpu-vendor-select-label" size="small">
                            Vendor
                          </InputLabel>
                          <MuiSelect
                            labelId="gpu-vendor-select-label"
                            value={field.value || ""}
                            onChange={field.onChange}
                            variant="outlined"
                            label="Vendor"
                            fullWidth
                            size="small"
                            MenuProps={{ disableScrollLock: true }}
                          >
                            {gpuVendors.map(u => (
                              <MenuItem key={u.id} value={u.value}>
                                {u.value}
                              </MenuItem>
                            ))}
                          </MuiSelect>
                        </FormControl>
                      )}
                    />
                  </div>
                  {gpuModels ? (
                    <>
                      <div className="col-span-3">
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.name`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-model-select-label" size="small">
                                Model
                              </InputLabel>
                              <MuiSelect
                                labelId="gpu-model-select-label"
                                value={field.value || ""}
                                onChange={event => {
                                  field.onChange(event);
                                  setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`, "");
                                  setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`, "");
                                }}
                                variant="outlined"
                                size="small"
                                label="Model"
                                fullWidth
                                IconComponent={
                                  (field.value?.length || 0) > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            field.onChange("");
                                            setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`, "");
                                            setValue(`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`, "");
                                          }}
                                        >
                                          <Xmark className="text-xs" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
                                MenuProps={{ disableScrollLock: true }}
                              >
                                {models.map(gpu => (
                                  <MenuItem key={gpu.name} value={gpu.name}>
                                    {gpu.name}
                                  </MenuItem>
                                ))}
                              </MuiSelect>
                            </FormControl>
                          )}
                        />
                      </div>
                      <div className="col-span-3">
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.memory`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-memory-select-label" size="small">
                                Memory
                              </InputLabel>
                              <MuiSelect
                                labelId="gpu-memory-select-label"
                                value={field.value || ""}
                                onChange={field.onChange}
                                variant="outlined"
                                size="small"
                                disabled={!currentGpu?.name}
                                label="Memory"
                                fullWidth
                                IconComponent={
                                  (field.value?.length || 0) > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            field.onChange("");
                                          }}
                                        >
                                          <Xmark fontSize="small" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
                                MenuProps={{ disableScrollLock: true }}
                              >
                                {memorySizes.map(x => (
                                  <MenuItem key={x} value={x}>
                                    {x}
                                  </MenuItem>
                                ))}
                              </MuiSelect>
                            </FormControl>
                          )}
                        />
                      </div>
                      <div className="col-span-3">
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.gpuModels.${formGpuIndex}.interface`}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel id="gpu-interface-select-label" size="small">
                                Interface
                              </InputLabel>
                              <MuiSelect
                                labelId="gpu-interface-select-label"
                                value={field.value || ""}
                                onChange={field.onChange}
                                variant="outlined"
                                size="small"
                                disabled={!currentGpu?.name}
                                label="Interface"
                                fullWidth
                                IconComponent={
                                  (field.value?.length || 0) > 0
                                    ? () => (
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            field.onChange("");
                                          }}
                                        >
                                          <Xmark fontSize="small" />
                                        </IconButton>
                                      )
                                    : undefined
                                }
                                MenuProps={{ disableScrollLock: true }}
                              >
                                {interfaces.map(x => (
                                  <MenuItem key={x} value={x}>
                                    {x}
                                  </MenuItem>
                                ))}
                              </MuiSelect>
                            </FormControl>
                          )}
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-center">
                        {formGpuIndex !== 0 && (
                          <Button onClick={() => removeFormGpuModel(formGpuIndex)} size="icon" type="button" variant="ghost">
                            <Bin />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="ml-4 flex items-center">
                      <Spinner />
                      <span className="ml-2 whitespace-nowrap text-sm text-muted-foreground">Loading GPU models...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {gpuModels && hasGpu && (
        <div className="mt-2 flex items-center justify-end">
          <Button size="sm" onClick={onAddGpuModel} type="button">
            Add GPU
          </Button>
        </div>
      )}
    </FormPaper>
  );
};
