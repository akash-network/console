"use client";
import { ReactNode, useRef } from "react";
import { Popup } from "../shared/Popup";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Expose, SdlBuilderFormValues, Service } from "@src/types";
import { AcceptFormControl, AcceptRefType } from "./AcceptFormControl";
import { nanoid } from "nanoid";
import { ToFormControl, ToRefType } from "./ToFormControl";
import { protoTypes } from "@src/utils/sdl/data";
import { FormPaper } from "./FormPaper";
import { endpointNameValidationRegex } from "@src/utils/deploymentData/v1beta3";
import { HttpOptionsFormControl } from "./HttpOptionsFormControl";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Button } from "../ui/button";
import { Bin, InfoCircle } from "iconoir-react";
import { InputWithIcon } from "../ui/input";
import { cn } from "@src/utils/styleUtils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  services: Service[];
  expose: Expose[];
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

    _expose.forEach((e, i) => {
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
                <a href="https://docs.akash.network/readme/stack-definition-language#services.expose" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>
            }
          >
            <InfoCircle className="ml-4 text-muted-foreground" />
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
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      {expose.map((exp, expIndex) => {
        const currentExpose = _expose[expIndex];

        return (
          <FormPaper
            key={exp.id}
            className={cn("flex p-4 pb-8", { ["mb-4"]: expIndex + 1 !== expose.length })}
            // sx={{
            //   display: "flex",
            //   padding: "1rem",
            //   marginBottom: expIndex + 1 === expose.length ? 0 : "1rem",
            //   paddingBottom: "2rem"
            // }}
          >
            <div className="flex-grow">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <div>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.port`}
                    rules={{ pattern: { value: /^[1-9]d*$/, message: "Port numbers don't allow decimals." } }}
                    render={({ field, fieldState }) => (
                      <InputWithIcon
                        type="number"
                        // variant="outlined"
                        label="Port"
                        color="secondary"
                        // fullWidth
                        value={field.value}
                        error={fieldState.error?.message}
                        // size="small"
                        onChange={event => field.onChange(parseInt(event.target.value))}
                        endIcon={
                          <CustomTooltip title={<>Container port to expose.</>}>
                            <InfoCircle className="text-muted-foreground" />
                          </CustomTooltip>
                        }
                        // InputProps={{
                        //   endAdornment: (
                        //     <InputAdornment position="end">
                        //       <CustomTooltip arrow title={<>Container port to expose.</>}>
                        //         <InfoIcon color="disabled" fontSize="small" />
                        //       </CustomTooltip>
                        //     </InputAdornment>
                        //   )
                        // }}
                      />
                    )}
                  />
                </div>
                <div>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.as`}
                    rules={{ pattern: { value: /^[1-9]d*$/, message: "Port numbers don't allow decimals." } }}
                    render={({ field, fieldState }) => (
                      <InputWithIcon
                        type="number"
                        // variant="outlined"
                        label="As"
                        color="secondary"
                        // fullWidth
                        value={field.value}
                        error={fieldState.error?.message}
                        // size="small"
                        onChange={event => field.onChange(parseInt(event.target.value))}
                        endIcon={
                          <CustomTooltip title={<>Port number to expose the container port as.</>}>
                            <InfoCircle className="text-muted-foreground" />
                          </CustomTooltip>
                        }
                        // InputProps={{
                        //   endAdornment: (
                        //     <InputAdornment position="end">
                        //       <CustomTooltip arrow title={<>Port number to expose the container port as.</>}>
                        //         <InfoIcon color="disabled" fontSize="small" />
                        //       </CustomTooltip>
                        //     </InputAdornment>
                        //   )
                        // }}
                      />
                    )}
                  />
                </div>
                <div>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${expIndex}.proto`}
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select proto" />
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
                    )}
                  />
                </div>

                <div>
                  <div className="flex h-full items-center">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.expose.${expIndex}.global`}
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox id={`global-${serviceIndex}-${expIndex}`} checked={field.value} onChange={field.onChange} />
                          <label
                            htmlFor={`custom-options-${serviceIndex}-${expIndex}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Global
                          </label>
                        </div>
                      )}
                    />

                    <CustomTooltip title={<>Check if you want this service to be accessible from outside the datacenter.</>}>
                      <InfoCircle className="ml-4 text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2">
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

              <div className="mt-4">
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.expose.${expIndex}.ipName`}
                  rules={{
                    validate: value => {
                      const _val = value || "";
                      const hasValidChars = endpointNameValidationRegex.test(_val);
                      const hasValidStartingChar = /^[a-z]/.test(_val);
                      const hasValidEndingChar = !_val.endsWith("-");

                      if (!hasValidChars) {
                        return "Invalid ip name. It must only be lower case letters, numbers and dashes.";
                      } else if (!hasValidStartingChar) {
                        return "Invalid starting character. It can only start with a lowercase letter.";
                      } else if (!hasValidEndingChar) {
                        return "Invalid ending character. It can only end with a lowercase letter or number";
                      }

                      return true;
                    }
                  }}
                  render={({ field, fieldState }) => (
                    <InputWithIcon
                      type="text"
                      // variant="outlined"
                      label="IP Name"
                      color="secondary"
                      // fullWidth
                      value={field.value}
                      error={fieldState.error?.message}
                      // size="small"
                      onChange={event => field.onChange(event.target.value)}
                      endIcon={
                        <CustomTooltip
                          title={
                            <>
                              Optional.
                              <br />
                              <br />
                              Option for Tenants to request publicly routable IP addresses for the services they deploy
                              <br />
                              <br />
                              <a href="https://docs.akash.network/features/ip-leases/ip-leases-features-and-limitations" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          }
                        >
                          <InfoCircle className="text-muted-foreground" />
                        </CustomTooltip>
                      }
                      // InputProps={{
                      //   endAdornment: (
                      //     <InputAdornment position="end">
                      //       <CustomTooltip
                      //         arrow
                      //         title={
                      //           <>
                      //             Optional.
                      //             <br />
                      //             <br />
                      //             Option for Tenants to request publicly routable IP addresses for the services they deploy
                      //             <br />
                      //             <br />
                      //             <a href="https://docs.akash.network/features/ip-leases/ip-leases-features-and-limitations" target="_blank" rel="noopener">
                      //               View official documentation.
                      //             </a>
                      //           </>
                      //         }
                      //       >
                      //         <InfoIcon color="disabled" fontSize="small" />
                      //       </CustomTooltip>
                      //     </InputAdornment>
                      //   )
                      // }}
                    />
                  )}
                />
              </div>

              <div className="mt-4">
                <HttpOptionsFormControl
                  control={control}
                  serviceIndex={serviceIndex}
                  exposeIndex={expIndex}
                  services={services}
                />
              </div>
            </div>

            {expIndex !== 0 && (
              <div className="pl-2">
                <Button onClick={() => removeExpose(expIndex)} size="icon">
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
