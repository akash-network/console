"use client";
import { forwardRef, ReactNode, useImperativeHandle } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { SdlBuilderFormValues, SignedBy } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { FormInput } from "../ui/input";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  signedByAnyOf: SignedBy[];
  signedByAllOf: SignedBy[];
};

export type SignedByRefType = {
  _removeSignedByAnyOf: (index: number | number[]) => void;
  _removeSignedByAllOf: (index: number | number[]) => void;
};

export const SignedByFormControl = forwardRef<SignedByRefType, Props>(
  ({ control, serviceIndex, signedByAnyOf: _signedByAnyOf = [], signedByAllOf: _signedByAllOf = [] }, ref) => {
    const {
      fields: signedByAnyOf,
      remove: removeAnyOf,
      append: appendAnyOf
    } = useFieldArray({
      control,
      name: `services.${serviceIndex}.placement.signedBy.anyOf`,
      keyName: "id"
    });
    const {
      fields: signedByAllOf,
      remove: removeAllOf,
      append: appendAllOf
    } = useFieldArray({
      control,
      name: `services.${serviceIndex}.placement.signedBy.allOf`,
      keyName: "id"
    });

    const onAddSignedAnyOf = () => {
      appendAnyOf({ id: nanoid(), value: "" });
    };

    const onAddSignedAllOf = () => {
      appendAllOf({ id: nanoid(), value: "" });
    };

    useImperativeHandle(ref, () => ({
      _removeSignedByAnyOf(index: number | number[]) {
        removeAnyOf(index);
      },
      _removeSignedByAllOf(index: number | number[]) {
        removeAllOf(index);
      }
    }));

    return (
      <FormPaper className="h-full">
        <div className="mb-4 flex items-center">
          <strong className="text-sm">Signed By</strong>

          <CustomTooltip
            title={
              <>
                This will filter bids based on which address (auditor) audited the provider.
                <br />
                <br />
                This allows for requiring a third-party certification of any provider that you deploy to.
                <br />
                <br />
                <a href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacementsignedby" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>
            }
          >
            <InfoCircle className="text-muted-foreground ml-2 text-sm" />
          </CustomTooltip>
        </div>

        <div
          className={cn("flex items-start justify-between", { ["mb-4"]: !!_signedByAnyOf.length })}
          // sx={{ marginBottom: _signedByAnyOf.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <div className="flex items-center">
            <strong className="text-sm">Any of</strong>
            <CustomTooltip title={<>Filter providers that have been audited by ANY of these accounts.</>}>
              <InfoCircle className="text-muted-foreground ml-2 text-sm" />
            </CustomTooltip>
          </div>

          <Button variant="default" size="sm" onClick={onAddSignedAnyOf}>
            Add Any Of
          </Button>
        </div>

        <div className="mb-4">
          {signedByAnyOf.length > 0 ? (
            signedByAnyOf.map((anyOf, anyOfIndex) => {
              return (
                <div
                  key={anyOf.id}
                  className={cn({ ["mb-4"]: anyOfIndex + 1 === _signedByAnyOf.length, ["mb-2"]: anyOfIndex + 1 !== _signedByAnyOf.length })}
                  // sx={{ marginBottom: anyOfIndex + 1 === _signedByAnyOf.length ? "1rem" : ".5rem" }}
                >
                  <div className="flex items-end">
                    <div className="flex-grow">
                      {/** TODO Add list of auditors */}
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.signedBy.anyOf.${anyOfIndex}.value`}
                        render={({ field }) => (
                          <FormInput
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

                    <div className="pl-2">
                      <Button onClick={() => removeAnyOf(anyOfIndex)} size="icon" variant="ghost">
                        <Bin />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground text-xs">None</div>
          )}
        </div>

        <div className={cn("flex items-start justify-between", { ["mb-4"]: !!_signedByAllOf.length })}>
          <div className="flex items-center">
            <strong className="text-sm">All of</strong>
            <CustomTooltip title={<>Filter providers that have been audited by ALL of these accounts.</>}>
              <InfoCircle className="text-muted-foreground ml-2 text-sm" />
            </CustomTooltip>
          </div>

          <Button color="primary" variant="default" size="sm" onClick={onAddSignedAllOf}>
            Add All Of
          </Button>
        </div>

        {signedByAllOf.length > 0 ? (
          signedByAllOf.map((allOf, allOfIndex) => {
            return (
              <div key={allOf.id} className={cn({ ["mb-2"]: allOfIndex + 1 !== _signedByAllOf.length })}>
                <div className="flex items-end">
                  <div className="flex-grow">
                    {/** TODO Add list of auditors */}
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.placement.signedBy.allOf.${allOfIndex}.value`}
                      render={({ field }) => (
                        <FormInput type="text" label="Value" color="secondary" value={field.value} onChange={event => field.onChange(event.target.value)} />
                      )}
                    />
                  </div>

                  <div className="pl-2">
                    <Button onClick={() => removeAllOf(allOfIndex)} size="icon" variant="ghost">
                      <Bin />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-muted-foreground text-xs">None</div>
        )}
      </FormPaper>
    );
  }
);
