import { FormattedNumber } from "react-intl";
import { ceilDecimal } from "@src/utils/mathHelpers";
import CircularProgress from "@mui/material/CircularProgress";
import { ReactNode } from "react";
import { usePricing } from "@src/context/PricingProvider";

type Props = {
  children?: ReactNode;
  value: string | number;
  showLt?: boolean;
};

export const AktPriceValue: React.FunctionComponent<Props> = ({ value, showLt }) => {
  const { isLoaded, price } = usePricing();
  const _value = (typeof value === "string" ? parseFloat(value) : value) * price;
  const computedValue = _value > 0 ? ceilDecimal(_value) : 0;

  return (
    <>
      {!isLoaded && <CircularProgress size=".8rem" color="secondary" />}
      {showLt && price && _value !== computedValue && "< "}
      {price && (
        <FormattedNumber
          value={computedValue}
          // eslint-disable-next-line react/style-prop-object
          style="currency"
          currency="USD"
        />
      )}
    </>
  );
};
