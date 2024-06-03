"use client";
import React from "react";
import { FormattedNumber } from "react-intl";

import { bytesToShrink } from "@/lib/unitUtils";

export interface HumanReadableBytesProps {
  value: number;
}

export const HumanReadableBytes: React.FunctionComponent<HumanReadableBytesProps> = ({ value }) => {
  if (typeof value !== "number") return null;

  const result = bytesToShrink(value);

  return (
    <>
      <FormattedNumber value={result.value} maximumFractionDigits={2} />
      <span className="text-sm pl-2">{result.unit}</span>
    </>
  );
};
