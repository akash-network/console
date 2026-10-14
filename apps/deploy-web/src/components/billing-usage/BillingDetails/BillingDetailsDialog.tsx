"use client";
import type { FC, FormEvent } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  Label,
  LoadingButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useUpdateBillingDetailsMutation } from "@src/queries/useBillingDetailsQueries";
import type { BillingDetails, BillingDetailsInput, TaxIdType } from "@src/types/billingDetails";
import { INVALID_TAX_ID_ERROR_CODE } from "@src/types/billingDetails";
import { COUNTRY_OPTIONS, TAX_ID_TYPE_OPTIONS } from "./billingDetailsOptions";

export const DEPENDENCIES = { useUpdateBillingDetailsMutation, useSnackbar };

export const INVALID_TAX_ID_MESSAGE = "This number isn't valid for the selected tax ID type.";

export const INVALID_DETAILS_MESSAGE = "Some details weren't accepted. Check them and try again.";

const NO_TAX_ID = "none";

const BAD_REQUEST_STATUS = 400;

type TaxIdChoice = TaxIdType | typeof NO_TAX_ID;

type Refusal = { taxId?: string; form?: string };

type Props = {
  billingDetails: BillingDetails | undefined;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const BillingDetailsDialog: FC<Props> = ({ billingDetails, onClose, dependencies: d = DEPENDENCIES }) => {
  const { mutateAsync: updateBillingDetails, isPending } = d.useUpdateBillingDetailsMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const [legalName, setLegalName] = useState(billingDetails?.legalName ?? "");
  const [line1, setLine1] = useState(billingDetails?.address?.line1 ?? "");
  const [line2, setLine2] = useState(billingDetails?.address?.line2 ?? "");
  const [city, setCity] = useState(billingDetails?.address?.city ?? "");
  const [state, setState] = useState(billingDetails?.address?.state ?? "");
  const [postalCode, setPostalCode] = useState(billingDetails?.address?.postalCode ?? "");
  const [country, setCountry] = useState(billingDetails?.address?.country ?? "");
  const [taxIdType, setTaxIdType] = useState<TaxIdChoice>(toTaxIdChoice(billingDetails?.taxId?.type));
  const [taxIdValue, setTaxIdValue] = useState(billingDetails?.taxId?.value ?? "");
  const [refusal, setRefusal] = useState<Refusal>({});
  const formId = useId();
  const taxIdErrorId = `${formId}-tax-id-error`;

  const hasTaxId = taxIdType !== NO_TAX_ID;
  const canSubmit = !!legalName.trim() && !!line1.trim() && !!country && (!hasTaxId || !!taxIdValue.trim()) && !isPending;

  const editTaxId = (change: () => void) => {
    change();
    setRefusal({});
  };

  const toInput = (): BillingDetailsInput => ({
    legalName: legalName.trim(),
    address: {
      line1: line1.trim(),
      line2: line2.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      postalCode: postalCode.trim() || null,
      country
    },
    taxId: hasTaxId ? { type: taxIdType, value: taxIdValue.trim() } : null
  });

  const reportRefusal = (error: unknown) => {
    if (extractApiErrorCode(error) === INVALID_TAX_ID_ERROR_CODE) {
      setRefusal({ taxId: INVALID_TAX_ID_MESSAGE });
    } else if (isApiError(error) && error.status === BAD_REQUEST_STATUS) {
      setRefusal({ form: INVALID_DETAILS_MESSAGE });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't save your billing details" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const isSaved = await updateBillingDetails({ data: toInput() }).then(
      () => true,
      error => {
        reportRefusal(error);
        return false;
      }
    );
    if (!isSaved) return;

    enqueueSnackbar(<Snackbar title="Billing details saved" subTitle="They'll appear on your next invoices." iconVariant="success" />, { variant: "success" });
    onClose();
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[560px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Billing details</DialogV2Title>
          <DialogV2Description>These details are printed on your invoices.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
            <Input
              id={`${formId}-legal-name`}
              label="Legal name"
              placeholder="Acme Corp"
              autoComplete="organization"
              autoFocus
              value={legalName}
              onChange={event => setLegalName(event.target.value)}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-country`}>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id={`${formId}-country`} aria-label="Country">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COUNTRY_OPTIONS.map(option => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              id={`${formId}-line1`}
              label="Address"
              placeholder="Street and number"
              autoComplete="address-line1"
              value={line1}
              onChange={event => setLine1(event.target.value)}
            />
            <Input
              id={`${formId}-line2`}
              label="Address line 2 (optional)"
              placeholder="Suite, floor, building"
              autoComplete="address-line2"
              value={line2}
              onChange={event => setLine2(event.target.value)}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input id={`${formId}-city`} label="City" autoComplete="address-level2" value={city} onChange={event => setCity(event.target.value)} />
              <Input
                id={`${formId}-state`}
                label="State or region"
                autoComplete="address-level1"
                value={state}
                onChange={event => setState(event.target.value)}
              />
              <Input
                id={`${formId}-postal-code`}
                label="Postal code"
                autoComplete="postal-code"
                value={postalCode}
                onChange={event => setPostalCode(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${formId}-tax-id-type`}>Tax ID type</Label>
                <Select value={taxIdType} onValueChange={value => editTaxId(() => setTaxIdType(value as TaxIdChoice))}>
                  <SelectTrigger id={`${formId}-tax-id-type`} aria-label="Tax ID type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TAX_ID}>No tax ID</SelectItem>
                    {Object.entries(TAX_ID_TYPE_OPTIONS).map(([type, option]) => (
                      <SelectItem key={type} value={type}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasTaxId && (
                <div className="flex flex-col gap-1.5">
                  <Input
                    id={`${formId}-tax-id-value`}
                    label="Tax ID"
                    placeholder={TAX_ID_TYPE_OPTIONS[taxIdType].example}
                    value={taxIdValue}
                    error={!!refusal.taxId}
                    aria-invalid={!!refusal.taxId}
                    aria-describedby={refusal.taxId ? taxIdErrorId : undefined}
                    onChange={event => editTaxId(() => setTaxIdValue(event.target.value))}
                  />
                  {refusal.taxId && (
                    <p id={taxIdErrorId} role="alert" className="text-xs text-destructive">
                      {refusal.taxId}
                    </p>
                  )}
                </div>
              )}
            </div>

            {refusal.form && (
              <p role="alert" className="text-xs text-destructive">
                {refusal.form}
              </p>
            )}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canSubmit}>
            Save
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

function toTaxIdChoice(type: string | undefined): TaxIdChoice {
  return type && type in TAX_ID_TYPE_OPTIONS ? (type as TaxIdType) : NO_TAX_ID;
}
