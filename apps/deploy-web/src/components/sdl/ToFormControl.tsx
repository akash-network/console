"use client";
import { forwardRef, ReactNode, useImperativeHandle } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { SdlBuilderFormValues, Service } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Button } from "@akashnetwork/ui/components";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: Service[];
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

export type ToRefType = {
  _removeTo: (index: number | number[]) => void;
};

export const ToFormControl = forwardRef<ToRefType, Props>(({ control, serviceIndex, exposeIndex, services }, ref) => {
  const {
    fields: accept,
    remove: removeTo,
    append: appendTo
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose.${exposeIndex}.to`,
    keyName: "id"
  });
  const currentService = services[serviceIndex];
  const otherServices = services.filter(s => currentService?.id !== s.id);

  const onAddTo = () => {
    appendTo({ id: nanoid(), value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeTo(index: number | number[]) {
      removeTo(index);
    }
  }));

  return (
    <FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="mb-4 flex items-center">
            <strong className="text-sm">To</strong>

            <CustomTooltip
              title={
                <>
                  List of entities allowed to connect.
                  <br />
                  <br />
                  If the service is marked as global, it will allow connections from outside the datacenter.
                  <br />
                  <br />
                  <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexposeto" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
            </CustomTooltip>
          </div>
        </div>

        {accept.map((acc, accIndex) => {
          return (
            <div key={acc.id} className={cn({ ["mb-2"]: accIndex + 1 !== accept.length })}>
              <div className="flex items-end">
                <div className="flex-grow">
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.expose.${exposeIndex}.to.${accIndex}.value`}
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {otherServices.map(t => {
                              return (
                                <SelectItem key={t.id} value={t.title}>
                                  {t.title}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="pl-2">
                  <Button onClick={() => removeTo(accIndex)} size="icon" variant="ghost">
                    <Bin />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {otherServices.length === 0 && <div className="mb-4 text-xs text-muted-foreground">There's no other service to expose to.</div>}
      </div>

      <div className="flex items-center">
        <Button variant="default" size="sm" onClick={onAddTo} disabled={otherServices.length === 0}>
          Add To
        </Button>
      </div>
    </FormPaper>
  );
});
