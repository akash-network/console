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
        <div
          className="inline-flex align-top"
          // sx={{ display: "inline-flex", alignItems: "flex-start" }}
        >
          {parts.map((part, i) => {
            switch (part.type) {
              case "currency":
                return (
                  <span
                    key={i}
                    className="self-middle mr-1 mt-2 text-lg"
                    // sx={{ fontSize: "1rem", alignSelf: "center", marginRight: ".25rem", marginTop: "-.5rem" }}
                  >
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
