"use client";
import { ReactNode, useRef } from "react";
import { Control } from "react-hook-form";
import { FormattedNumber } from "react-intl";
import { CustomTooltip, FormField, FormInput, Popup } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useSdlDenoms } from "@src/hooks/useDenom";
import { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth, toReadableDenom, uaktToAKT } from "@src/utils/priceUtils";
import { PriceValue } from "../shared/PriceValue";
import { USDLabel } from "../shared/UsdLabel";
import { AttributesFormControl, AttributesRefType } from "./AttributesFormControl";
import { FormPaper } from "./FormPaper";
import { SignedByFormControl, SignedByRefType } from "./SignedByFormControl";

type Props = {
  serviceIndex: number;
  services: ServiceType[];
  onClose: () => void;
  control: Control<SdlBuilderFormValuesType, any>;
  children?: ReactNode;
  placement: PlacementType;
};

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
      maxWidth="xl"
      enableCloseOnBackdropClick
    >
      <FormPaper contentClassName="flex">
        <div className="flex-grow">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FormField
                control={control}
                name={`services.${serviceIndex}.placement.name`}
                render={({ field, fieldState }) => (
                  <FormInput
                    type="text"
                    label={
                      <div className="flex items-center">
                        Name
                        <CustomTooltip title={<>The name of the placement.</>}>
                          <InfoCircle className="ml-2 text-sm text-muted-foreground" />
                        </CustomTooltip>
                      </div>
                    }
                    value={field.value}
                    error={!!fieldState.error}
                    onChange={event => field.onChange(event.target.value)}
                  />
                )}
              />
            </div>

            <div>
              <FormField
                control={control}
                name={`services.${serviceIndex}.placement.pricing.amount`}
                render={({ field, fieldState }) => (
                  <FormInput
                    type="number"
                    label={
                      <div className="flex items-center">
                        Pricing, ${toReadableDenom(currentService.placement.pricing.denom)}
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
                                    ~<PriceValue denom={uAktDenom} value={getAvgCostPerMonth(uaktToAKT(_placement.pricing.amount))} />
                                  </>
                                ) : (
                                  <>
                                    <span>
                                      <FormattedNumber value={getAvgCostPerMonth(udenomToDenom(_placement.pricing.amount))} maximumFractionDigits={2} />
                                    </span>
                                    <USDLabel />
                                  </>
                                )}
                              </strong>
                              &nbsp;per month
                            </>
                          }
                        >
                          <InfoCircle className="ml-2 text-sm text-muted-foreground" />
                        </CustomTooltip>
                      </div>
                    }
                    value={field.value}
                    error={!!fieldState.error}
                    min={1}
                    step={1}
                    max={10000000}
                    onChange={event => field.onChange(parseFloat(event.target.value))}
                  />
                )}
              />
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
