"use client";
import React from "react";
import { FormattedNumberParts } from "react-intl";

type Props = {
  value: number;
  precision?: number;
  style?: "currency" | "unit" | "decimal" | "percent";
  currency?: string;
};

export const FormattedDecimal: React.FunctionComponent<Props> = ({ value, precision = 6, style, currency }) => {
  return (
    <FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
      {parts => (
        <>
          {parts.map((part, i) => {
            switch (part.type) {
              case "integer":
              case "group":
                return <b key={i}>{part.value}</b>;

              case "decimal":
              case "fraction":
                return (
                  <small key={i} className="text-xs text-muted-foreground">
                    {part.value}
                  </small>
                );

              default:
                return <React.Fragment key={i}>{part.value}</React.Fragment>;
            }
          })}
        </>
      )}
    </FormattedNumberParts>
  );
};
