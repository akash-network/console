"use client";
import type { ReactNode } from "react";
import { forwardRef, useImperativeHandle } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button, CustomTooltip, FormField, FormInput } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import type { PlacementAttributeType, SdlBuilderFormValuesType } from "@src/types";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  children?: ReactNode;
  attributes: PlacementAttributeType[];
};

export type AttributesRefType = {
  _removeAttribute: (index: number | number[]) => void;
};

export const AttributesFormControl = forwardRef<AttributesRefType, Props>(({ control, serviceIndex, attributes: _attributes = [] }, ref) => {
  const {
    fields: attributes,
    remove: removeAttribute,
    append: appendAttribute
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.placement.attributes`,
    keyName: "id"
  });

  const onAddAttribute = () => {
    appendAttribute({ id: nanoid(), key: "", value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeAttribute(index: number | number[]) {
      removeAttribute(index);
    }
  }));

  return (
    <FormPaper className="h-full">
      <div className={cn("flex items-start justify-between", { ["mb-4"]: !!_attributes.length })}>
        <div className="flex items-center">
          <strong className="text-sm">Attributes</strong>

          <CustomTooltip title={<>Filter providers that have these attributes.</>}>
            <InfoCircle className="ml-2 text-sm text-muted-foreground" />
          </CustomTooltip>
        </div>

        <Button variant="default" size="sm" onClick={onAddAttribute}>
          Add Attribute
        </Button>
      </div>

      {attributes.length > 0 ? (
        attributes.map((att, attIndex) => {
          return (
            <div key={att.id} className={cn({ ["mb-2"]: attIndex + 1 !== _attributes.length })}>
              <div className="flex items-end">
                <div className="flex flex-grow items-center">
                  {/** TODO All list of attribute keys and values from pre-defined provider attributes */}
                  <div>
                    <FormField
                      control={control}
                      name={`services.${serviceIndex}.placement.attributes.${attIndex}.key`}
                      render={({ field }) => (
                        <FormInput type="text" label="Key" className="w-full" value={field.value} onChange={event => field.onChange(event.target.value)} />
                      )}
                    />
                  </div>

                  <div className="ml-2">
                    <FormField
                      control={control}
                      name={`services.${serviceIndex}.placement.attributes.${attIndex}.value`}
                      render={({ field }) => (
                        <FormInput type="text" label="Value" className="w-full" value={field.value} onChange={event => field.onChange(event.target.value)} />
                      )}
                    />
                  </div>
                </div>

                <div className="pl-2">
                  <Button onClick={() => removeAttribute(attIndex)} size="icon" variant="ghost">
                    <Bin />
                  </Button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="mb-2 text-xs text-muted-foreground">None</div>
      )}
    </FormPaper>
  );
});
