"use client";
import { ReactNode, useRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import {
  Button,
  Checkbox,
  CustomTooltip,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  Popup,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { ExposeType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { protoTypes } from "@src/utils/sdl/data";
import { AcceptFormControl, AcceptRefType } from "./AcceptFormControl";
import { FormPaper } from "./FormPaper";
import { HttpOptionsFormControl } from "./HttpOptionsFormControl";
import { ToFormControl, ToRefType } from "./ToFormControl";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValuesType, any>;
  children?: ReactNode;
  services: ServiceType[];
  expose: ExposeType[];
};

export const ExposeFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, onClose, expose: _expose, services }) => {
  const acceptRef = useRef<AcceptRefType>(null);
  const toRef = useRef<ToRefType>(null);
  const {
    fields: expose,
    remove: removeExpose,
    append: appendExpose
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose`,
    keyName: "id"
  });

  const onAddExpose = () => {
    appendExpose({ id: nanoid(), port: 80, as: 80, global: true });
  };

  const _onClose = () => {
    const acceptToRemove: number[] = [];
    const toToRemove: number[] = [];

    _expose.forEach(e => {
      e.accept?.forEach((a, ii) => {
        if (!a.value.trim()) {
          acceptToRemove.push(ii);
        }
      });

      e.to?.forEach((a, ii) => {
        if (!a.value.trim()) {
          toToRemove.push(ii);
        }
      });
    });

    acceptRef.current?._removeAccept(acceptToRemove);
    toRef.current?._removeTo(toToRemove);

    onClose();
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title={
        <div className="flex items-center">
          Edit Port Expose
          <CustomTooltip
            title={
              <>
                Expose is a list of settings describing what can connect to the service.
                <br />
                <br />
                Map container ports to exposed http/https/tcp ports.
                <br />
                <br />
                <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>
            }
          >
            <InfoCircle className="ml-2 text-xs text-muted-foreground" />
          </CustomTooltip>
        </div>
      }
      actions={[
        {
          label: "Close",
          color: "secondary",
          variant: "ghost",
          side: "left",
          onClick: _onClose
        },
        {
          label: "Add Expose",
          color: "primary",
          variant: "default",
          side: "right",
          onClick: onAddExpose
        }
      ]}
      onClose={_onClose}
      maxWidth="xl"
      enableCloseOnBackdropClick
    >
      {expose.map((exp, expIndex) => {
        const currentExpose = _expose[expIndex];

        return (
          <FormPaper key={exp.id} className={cn("bg-popover", { ["mb-4"]: expIndex + 1 !== expose.length })} contentClassName="flex">
            <div className="flex-grow">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <div>
                  <FormField
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.port`}
                    render={({ field }) => (
                      <FormInput
                        type="number"
                        label={
                          <div className="inline-flex items-center">
                            Port
                            <CustomTooltip title={<>Container port to expose.</>}>
                              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                            </CustomTooltip>
                          </div>
                        }
                        min={1}
                        max={65535}
                        step={1}
                        value={field.value}
                        onChange={event => field.onChange(parseInt(event.target.value))}
                      />
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.as`}
                    render={({ field }) => (
                      <FormInput
                        type="number"
                        label={
                          <div className="inline-flex items-center">
                            As
                            <CustomTooltip title={<>Port number to expose the container port as.</>}>
                              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                            </CustomTooltip>
                          </div>
                        }
                        color="secondary"
                        value={field.value}
                        onChange={event => field.onChange(parseInt(event.target.value))}
                      />
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.proto`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protocol</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select protocol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {protoTypes.map(t => {
                                return (
                                  <SelectItem key={t.id} value={t.name}>
                                    {t.name}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <div className="flex h-full items-start">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.expose.${expIndex}.global`}
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox id={`global-${serviceIndex}-${expIndex}`} checked={field.value} onCheckedChange={field.onChange} />
                          <label
                            htmlFor={`global-${serviceIndex}-${expIndex}`}
                            className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Global
                          </label>
                        </div>
                      )}
                    />

                    <CustomTooltip title={<>Check if you want this service to be accessible from outside the datacenter.</>}>
                      <InfoCircle className="ml-4 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <AcceptFormControl
                    control={control}
                    serviceIndex={serviceIndex}
                    exposeIndex={expIndex}
                    ref={acceptRef}
                    accept={currentExpose?.accept || []}
                  />
                </div>

                <div>
                  <ToFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} ref={toRef} services={services} />
                </div>
              </div>

              <div className="mb-4">
                <FormField
                  control={control}
                  name={`services.${serviceIndex}.expose.${expIndex}.ipName`}
                  render={({ field }) => (
                    <FormInput
                      type="text"
                      label={
                        <div className="inline-flex items-center">
                          IP Name
                          <CustomTooltip
                            title={
                              <>
                                Optional.
                                <br />
                                <br />
                                Option for Tenants to request publicly routable IP addresses for the services they deploy
                                <br />
                                <br />
                                <a href="https://akash.network/docs/network-features/ip-leases/" target="_blank" rel="noopener">
                                  View official documentation.
                                </a>
                              </>
                            }
                          >
                            <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                          </CustomTooltip>
                        </div>
                      }
                      color="secondary"
                      value={field.value}
                      onChange={event => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>

              <div>
                <HttpOptionsFormControl control={control} serviceIndex={serviceIndex} exposeIndex={expIndex} services={services} />
              </div>
            </div>

            {expIndex !== 0 && (
              <div className="pl-2">
                <Button onClick={() => removeExpose(expIndex)} size="icon" variant="ghost">
                  <Bin />
                </Button>
              </div>
            )}
          </FormPaper>
        );
      })}
    </Popup>
  );
};
