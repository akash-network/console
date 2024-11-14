"use client";
import { forwardRef, ReactNode, useImperativeHandle } from "react";
import { Control, useFieldArray } from "react-hook-form";
import { Button, CustomTooltip, FormField, FormInput } from "@akashnetwork/ui/components";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { AcceptType, SdlBuilderFormValuesType } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  children?: ReactNode;
  accept: AcceptType[];
};

export type AcceptRefType = {
  _removeAccept: (index: number | number[]) => void;
};

export const AcceptFormControl = forwardRef<AcceptRefType, Props>(({ control, serviceIndex, exposeIndex, accept: _accept }, ref) => {
  const {
    fields: accept,
    remove: removeAccept,
    append: appendAccept
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose.${exposeIndex}.accept`,
    keyName: "id"
  });

  const onAddAccept = () => {
    appendAccept({ id: nanoid(), value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeAccept(index: number | number[]) {
      removeAccept(index);
    }
  }));

  return (
    <FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div className="mb-4 flex items-center">
        <strong className="text-sm">Accept</strong>

        <CustomTooltip title={<>List of hosts/domains to accept connections for.</>}>
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>
      </div>

      {accept.map((acc, accIndex) => {
        return (
          <div key={acc.id} className={cn("w-full", { ["mb-2"]: accIndex + 1 !== accept.length })}>
            <div className="flex items-end">
              <div className="flex-grow">
                <FormField
                  control={control}
                  name={`services.${serviceIndex}.expose.${exposeIndex}.accept.${accIndex}.value`}
                  render={({ field }) => (
                    <FormInput
                      type="text"
                      label="Value"
                      color="secondary"
                      placeholder="example.com"
                      value={field.value}
                      onChange={event => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>

              <div className="pl-2">
                <Button onClick={() => removeAccept(accIndex)} size="icon" variant="ghost">
                  <Bin />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <div className={cn("flex items-center", { ["mt-4"]: _accept && _accept.length > 0 })}>
        <Button variant="default" size="sm" onClick={onAddAccept}>
          Add Accept
        </Button>
      </div>
    </FormPaper>
  );
});
