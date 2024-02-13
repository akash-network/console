"use client";
import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { SdlBuilderFormValues, SignedBy } from "@src/types";
import { nanoid } from "nanoid";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Card, CardContent } from "../ui/card";
import { Bin, InfoCircle } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";
import { Button } from "../ui/button";
import { FormInput } from "../ui/input";

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
      <Card className="mt-4 flex h-full flex-col justify-between bg-muted p-4">
        <CardContent>
          <div className="mb-4 flex items-center">
            <span className="text-sm">
              <strong>Signed By</strong>
            </span>

            <CustomTooltip
              title={
                <>
                  This will filter bids based on which address (auditor) audited the provider.
                  <br />
                  <br />
                  This allows for requiring a third-party certification of any provider that you deploy to.
                  <br />
                  <br />
                  <a href="https://docs.akash.network/readme/stack-definition-language#profiles.placement.signedby" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoCircle className="ml-4 text-sm text-muted-foreground" />
            </CustomTooltip>
          </div>

          <div
            className={cn("flex items-start justify-between", { ["mb-4"]: !!_signedByAnyOf.length })}
            // sx={{ marginBottom: _signedByAnyOf.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
          >
            <div className="flex items-center">
              <span className="text-sm">
                <strong>Any of</strong>
              </span>
              <CustomTooltip title={<>Filter providers that have been audited by ANY of these accounts.</>}>
                <InfoCircle className="ml-4 text-sm text-muted-foreground" />
              </CustomTooltip>
            </div>

            <Button variant="default" size="sm" onClick={onAddSignedAnyOf}>
              Add Any Of
            </Button>
          </div>

          {signedByAnyOf.length > 0 ? (
            signedByAnyOf.map((anyOf, anyOfIndex) => {
              return (
                <div
                  key={anyOf.id}
                  className={cn({ ["mb-4"]: anyOfIndex + 1 === _signedByAnyOf.length, ["mb-2"]: anyOfIndex + 1 !== _signedByAnyOf.length })}
                  // sx={{ marginBottom: anyOfIndex + 1 === _signedByAnyOf.length ? "1rem" : ".5rem" }}
                >
                  <div className="flex">
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
                      <Button onClick={() => removeAnyOf(anyOfIndex)} size="icon">
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

          <div
            className={cn("flex items-start justify-between", { ["mb-4"]: !!_signedByAllOf.length })}
            // sx={{ marginBottom: _signedByAllOf.length ? "1rem" : 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
          >
            <div className="flex items-center">
              <span className="text-sm">
                <strong>All of</strong>
              </span>
              <CustomTooltip title={<>Filter providers that have been audited by ALL of these accounts.</>}>
                <InfoCircle className="ml-4 text-sm text-muted-foreground" />
              </CustomTooltip>
            </div>

            <Button color="primary" variant="default" size="sm" onClick={onAddSignedAllOf}>
              Add All Of
            </Button>
          </div>

          {signedByAllOf.length > 0 ? (
            signedByAllOf.map((allOf, allOfIndex) => {
              return (
                <div
                  key={allOf.id}
                  className={cn({ ["mb-2"]: allOfIndex + 1 !== _signedByAllOf.length })}
                  // sx={{ marginBottom: allOfIndex + 1 === _signedByAllOf.length ? 0 : ".5rem" }}
                >
                  <div className="flex">
                    <div className="flex-grow">
                      {/** TODO Add list of auditors */}
                      <Controller
                        control={control}
                        name={`services.${serviceIndex}.placement.signedBy.allOf.${allOfIndex}.value`}
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
                      <Button onClick={() => removeAllOf(allOfIndex)} size="icon">
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
  }
);
