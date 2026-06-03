"use client";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { FormattedNumber } from "react-intl";
import { CustomTooltip, FormField, FormInput, Popup } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useSupportedDenoms } from "@src/hooks/useDenom";
import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth, toReadableDenom, uaktToAKT } from "@src/utils/priceUtils";
import { PriceValue } from "../shared/PriceValue";
import { USDLabel } from "../shared/UsdLabel";
import type { AttributesRefType } from "./AttributesFormControl";
import { AttributesFormControl } from "./AttributesFormControl";
import { FormPaper } from "./FormPaper";
import type { SignedByRefType } from "./SignedByFormControl";
import { SignedByFormControl } from "./SignedByFormControl";

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
  const supportedSdlDenoms = useSupportedDenoms();
  const currentService = services[serviceIndex];
  const placementIndex = usePlacementIndexForService(control, serviceIndex);
  const selectedDenom = supportedSdlDenoms.find(x => x.value === currentService.pricing.denom);

  const closeAfterPruningEmptyRows = () => {
    const attributesToRemove: number[] = [];
    const signedByAnyToRemove: number[] = [];
    const signedByAllToRemove: number[] = [];

    _placement.attributes?.forEach((e, i) => {
      if (!e.key.trim() || !e.value?.trim()) {
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
          onClick: closeAfterPruningEmptyRows
        }
      ]}
      onClose={closeAfterPruningEmptyRows}
      maxWidth="xl"
      enableCloseOnBackdropClick
    >
      <FormPaper contentClassName="flex">
        <div className="flex-grow">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FormField
                control={control}
                name={`placements.${placementIndex}.name`}
                render={({ field }) => (
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
                    onChange={event => field.onChange(event.target.value)}
                  />
                )}
              />
            </div>

            <div>
              <FormField
                control={control}
                name={`services.${serviceIndex}.pricing.amount`}
                render={({ field }) => (
                  <FormInput
                    type="number"
                    label={
                      <div className="flex items-center">
                        Pricing, ${toReadableDenom(currentService.pricing.denom)}
                        <CustomTooltip
                          title={
                            <>
                              The maximum amount of {selectedDenom?.label} you're willing to pay per block (~6 seconds).
                              <br />
                              <br />
                              Akash will only show providers costing <strong>less</strong> than{" "}
                              <strong>
                                {selectedDenom?.value === UAKT_DENOM ? (
                                  <>
                                    ~<PriceValue denom={UAKT_DENOM} value={getAvgCostPerMonth(uaktToAKT(currentService.pricing.amount))} />
                                  </>
                                ) : (
                                  <>
                                    <span>
                                      <FormattedNumber value={getAvgCostPerMonth(udenomToDenom(currentService.pricing.amount))} maximumFractionDigits={2} />
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
                placementIndex={placementIndex}
                signedByAnyOf={_placement.signedBy?.anyOf || []}
                signedByAllOf={_placement.signedBy?.allOf || []}
                ref={signedByRef}
              />
            </div>

            <div>
              <AttributesFormControl control={control} placementIndex={placementIndex} attributes={_placement.attributes || []} ref={attritubesRef} />
            </div>
          </div>
        </div>
      </FormPaper>
    </Popup>
  );
};

/**
 * Resolves the index of the placement referenced by the service at
 * `serviceIndex` inside `placements`. Returns `-1` when the reference can't be
 * resolved so callers can gate placement-bound UI on a valid index instead of
 * silently editing the first placement.
 */
export function usePlacementIndexForService(control: Control<SdlBuilderFormValuesType>, serviceIndex: number) {
  const placementId = useWatch({ control, name: `services.${serviceIndex}.placementId` });
  const placements = useWatch({ control, name: "placements" });
  return placements?.findIndex(p => p.id === placementId) ?? -1;
}
