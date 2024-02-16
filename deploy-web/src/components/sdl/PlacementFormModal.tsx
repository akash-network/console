"use client";
import { ReactNode, useRef } from "react";
import { Popup } from "../shared/Popup";
import { Control, Controller } from "react-hook-form";
import { Placement, SdlBuilderFormValues, Service } from "@src/types";
import { FormPaper } from "./FormPaper";
import { SignedByFormControl, SignedByRefType } from "./SignedByFormControl";
import { AttributesFormControl, AttributesRefType } from "./AttributesFormControl";
import { CustomTooltip } from "../shared/CustomTooltip";
import { PriceValue } from "../shared/PriceValue";
import { getAvgCostPerMonth, toReadableDenom } from "@src/utils/priceUtils";
import { uAktDenom } from "@src/utils/constants";
import { useSdlDenoms } from "@src/hooks/useDenom";
import { FormattedNumber } from "react-intl";
import { USDLabel } from "../shared/UsdLabel";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { InfoCircle } from "iconoir-react";
import { FormControl, FormItem, FormLabel } from "../ui/form";
import { FormInput, InputWithIcon } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
  serviceIndex: number;
  services: Service[];
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  placement: Placement;
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

export const PlacementFormModal: React.FunctionComponent<Props> = ({ control, services, serviceIndex, onClose, placement: _placement }) => {
  const signedByRef = useRef<SignedByRefType>(null);
  const attritubesRef = useRef<AttributesRefType>(null);
  const supportedSdlDenoms = useSdlDenoms();
  const currentService = services[serviceIndex];
  const selectedDenom = supportedSdlDenoms.find(x => x.value === currentService.placement.pricing.denom);

  const _onClose = () => {
    const attributesToRemove: number[] = [];
    const signedByAnyToRemove: number[] = [];
    const signedByAllToRemove: number[] = [];

    _placement.attributes?.forEach((e, i) => {
      if (!e.key.trim() || !e.value.trim()) {
        attributesToRemove.push(i);
      }
    });

    _placement.signedBy?.anyOf.forEach((e, i) => {
      if (!e.value.trim()) {
        signedByAnyToRemove.push(i);
      }
    });

    _placement.signedBy?.allOf.forEach((e, i) => {
      if (!e.value.trim()) {
        signedByAllToRemove.push(i);
      }
    });

    attritubesRef.current?._removeAttribute(attributesToRemove);
    signedByRef.current?._removeSignedByAnyOf(signedByAnyToRemove);
    signedByRef.current?._removeSignedByAllOf(signedByAllToRemove);

    onClose();
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Edit placement"
      actions={[
        {
          label: "Done",
          color: "secondary",
          variant: "ghost",
          side: "right",
          onClick: _onClose
        }
      ]}
      onClose={_onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <FormPaper
        className="flex p-4 pb-8"
        // sx={{
        //   display: "flex",
        //   padding: "1rem",
        //   paddingBottom: "2rem"
        // }}
      >
        <div className="flex-grow">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Controller
                control={control}
                name={`services.${serviceIndex}.placement.name`}
                rules={{
                  required: "Placement name is required",
                  validate: value => {
                    const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                    const hasValidStartingChar = /^[a-z]/.test(value);
                    const hasValidEndingChar = !value.endsWith("-");

                    if (!hasValidChars) {
                      return "Invalid name. It must only be lower case letters, numbers and dashes.";
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
                    label="Name"
                    // fullWidth
                    value={field.value}
                    error={fieldState.error?.message}
                    // size="small"
                    onChange={event => field.onChange(event.target.value)}
                    endIcon={
                      <CustomTooltip title={<>The name of the placement.</>}>
                        <InfoCircle className="text-muted-foreground" />
                      </CustomTooltip>
                    }
                    // InputProps={{
                    //   endAdornment: (
                    //     <InputAdornment position="end">
                    //       <CustomTooltip title={<>The name of the placement.</>}>
                    //         <InfoCircle className="text-muted-foreground" />
                    //       </CustomTooltip>
                    //     </InputAdornment>
                    //   )
                    // }}
                  />
                )}
              />
            </div>

            <div>
              {/** TODO Token Form Control */}
              <FormControl className="flex w-full flex-row items-center">
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.placement.pricing.denom`}
                  defaultValue=""
                  rules={{
                    required: true
                  }}
                  render={({ fieldState, field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Token</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {supportedSdlDenoms.map(t => {
                                return (
                                  <SelectItem key={t.id} value={t.value}>
                                    {t.value}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    );
                    // return (
                    //   <Select {...field} labelId="sdl-token" label="Token" size="small" error={!!fieldState.error}>
                    //     {supportedSdlDenoms.map(token => (
                    //       <MenuItem key={token.id} value={token.value}>
                    //         {token.label}
                    //       </MenuItem>
                    //     ))}
                    //   </Select>

                    // );
                  }}
                />

                <div className="ml-2 flex flex-grow items-center">
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.placement.pricing.amount`}
                    rules={{ required: "Pricing is required" }}
                    render={({ field, fieldState }) => (
                      <FormInput
                        type="number"
                        // variant="outlined"
                        label={`Pricing, ${toReadableDenom(currentService.placement.pricing.denom)}`}
                        // fullWidth
                        value={field.value}
                        // error={!!fieldState.error}
                        description={fieldState.error?.message}
                        // size="small"
                        min={1}
                        step={1}
                        max={10000000}
                        // inputProps={{ min: 1, step: 1, max: 10000000 }}
                        onChange={event => field.onChange(parseFloat(event.target.value))}
                      />
                    )}
                  />
                  <CustomTooltip
                    title={
                      <>
                        The maximum amount of {selectedDenom?.label} you're willing to pay per block (~6 seconds).
                        <br />
                        <br />
                        Akash will only show providers costing <strong>less</strong> than{" "}
                        <strong>
                          {selectedDenom?.value === uAktDenom ? (
                            <>
                              ~<PriceValue denom={uAktDenom} value={getAvgCostPerMonth(_placement.pricing.amount)} />
                            </>
                          ) : (
                            <>
                              <span>
                                <FormattedNumber value={udenomToDenom(getAvgCostPerMonth(_placement.pricing.amount))} maximumFractionDigits={2} />
                              </span>
                              <USDLabel />
                            </>
                          )}
                        </strong>
                        &nbsp;per month
                      </>
                    }
                  >
                    <InfoCircle className="ml-4 text-muted-foreground" />
                  </CustomTooltip>
                </div>
              </FormControl>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SignedByFormControl
                control={control}
                serviceIndex={serviceIndex}
                signedByAnyOf={_placement.signedBy?.anyOf || []}
                signedByAllOf={_placement.signedBy?.allOf || []}
                ref={signedByRef}
              />
            </div>

            <div>
              <AttributesFormControl control={control} serviceIndex={serviceIndex} attributes={_placement.attributes || []} ref={attritubesRef} />
            </div>
          </div>
        </div>
      </FormPaper>
    </Popup>
  );
};
