"use client";
import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { SdlBuilderFormValues, Service } from "@src/types";
import { nanoid } from "nanoid";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Bin, InfoCircle } from "iconoir-react";
import { Tooltip, TooltipTrigger } from "../ui/tooltip";
import { TooltipContent } from "@radix-ui/react-tooltip";
import { cn } from "@src/utils/styleUtils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FormPaper } from "./FormPaper";
import { CustomTooltip } from "../shared/CustomTooltip";

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
          <div className="flex items-center mb-4">
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
                  <a href="https://docs.akash.network/readme/stack-definition-language#services.expose.to" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoCircle className="ml-2 text-xs text-muted-foreground " />
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
