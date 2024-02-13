"use client";
import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { PlacementAttribute, SdlBuilderFormValues } from "@src/types";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Bin, InfoCircle } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";
import { FormInput, Input } from "../ui/input";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  attributes: PlacementAttribute[];
};

export type AttributesRefType = {
  _removeAttribute: (index: number | number[]) => void;
};

// const useStyles = makeStyles()(theme => ({
//   root: {
//     marginTop: "1rem",
//     padding: "1rem",
//     paddingBottom: 0,
//     height: "100%",
//     display: "flex",
//     flexDirection: "column",
//     justifyContent: "space-between",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.grey[300]
//   },
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   },
//   none: {
//     fontSize: ".7rem",
//     color: theme.palette.grey[500],
//     marginBottom: ".5rem"
//   }
// }));

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
    <Card className="mt-4 flex h-full flex-col justify-between bg-muted p-4">
      <CardContent>
        <div
          className={cn("flex items-start justify-between", { ["mb-4"]: !!_attributes.length })}
          // sx={{ marginBottom: _attributes.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <div className="flex items-center">
            <span className="text-sm">
              <strong>Attributes</strong>
            </span>
            <CustomTooltip title={<>Filter providers that have these attributes.</>}>
              <InfoCircle className="ml-4 text-muted-foreground" />
            </CustomTooltip>
          </div>

          <Button variant="default" size="sm" onClick={onAddAttribute}>
            Add Attribute
          </Button>
        </div>

        {attributes.length > 0 ? (
          attributes.map((att, attIndex) => {
            return (
              <div
                key={att.id}
                className={cn({ ["mb-2"]: attIndex + 1 !== _attributes.length })}
                // sx={{ marginBottom: attIndex + 1 === _attributes.length ? 0 : ".5rem" }}
              >
                <div className="flex">
                  <div className="flex flex-grow items-center">
                    {/** TODO All list of attribute keys and values from pre-defined provider attributes */}
                    <div>
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.attributes.${attIndex}.key`}
                        render={({ field }) => (
                          <FormInput
                            type="text"
                            // variant="outlined"
                            label="Key"
                            color="secondary"
                            className="w-full"
                            value={field.value}
                            // size="small"
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
                            // variant="outlined"
                            label="Value"
                            color="secondary"
                            className="w-full"
                            value={field.value}
                            // size="small"
                            onChange={event => field.onChange(event.target.value)}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="pl-2">
                    <Button onClick={() => removeAttribute(attIndex)} size="icon">
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
      </CardContent>
    </Card>
  );
});
