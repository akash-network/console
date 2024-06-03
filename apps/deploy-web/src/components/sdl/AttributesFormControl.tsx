"use client";
import { forwardRef, ReactNode, useImperativeHandle } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { PlacementAttribute, SdlBuilderFormValues } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { FormInput, Input } from "../ui/input";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  attributes: PlacementAttribute[];
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
            <InfoCircle className="text-muted-foreground ml-2 text-sm" />
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
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.placement.attributes.${attIndex}.key`}
                      render={({ field }) => (
                        <FormInput
                          type="text"
                          label="Key"
                          color="secondary"
                          className="w-full"
                          value={field.value}
                          onChange={event => field.onChange(event.target.value)}
                        />
                      )}
                    />
                  </div>

                  <div className="ml-2">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.placement.attributes.${attIndex}.value`}
                      render={({ field }) => (
                        <FormInput
                          type="text"
                          label="Value"
                          color="secondary"
                          className="w-full"
                          value={field.value}
                          onChange={event => field.onChange(event.target.value)}
                        />
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
        <div className="text-muted-foreground mb-2 text-xs">None</div>
      )}
    </FormPaper>
  );
});
