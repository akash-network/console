"use client";
import { FormattedNumberParts } from "react-intl";
import React from "react";

type Props = {
  value: number;
  precision?: number;
  style?: "currency" | "unit" | "decimal" | "percent";
  currency?: string;
};

export const FormattedDecimalCurrency: React.FunctionComponent<Props> = ({ value, precision = 6, style, currency }) => {
  return (
    <FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
      {parts => (
        <div className="inline-flex items-start">
          {parts.map((part, i) => {
            switch (part.type) {
              case "currency":
                return (
                  <span key={i} className="mr-1 self-center text-lg">
                    {part.value}
                  </span>
                );

              default:
                return <React.Fragment key={i}>{part.value}</React.Fragment>;
            }
          })}
        </div>
      )}
    </FormattedNumberParts>
  );
};
