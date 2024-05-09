"use client";
import { bytesToShrink } from "@src/utils/unitUtils";
import React from "react";
import { FormattedNumber } from "react-intl";

export interface HumanReadableBytesProps {
  value: number;
}

export const HumanReadableBytes: React.FunctionComponent<HumanReadableBytesProps> = ({ value }) => {
  if (typeof value !== "number") return null;

  const result = bytesToShrink(value);

  return (
    <>
      <FormattedNumber value={result.value} maximumFractionDigits={2} />
      <span className="pl-2 text-sm">{result.unit}</span>
    </>
  );
};
