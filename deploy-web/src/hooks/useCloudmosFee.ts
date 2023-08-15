import { usePricing } from "@src/context/PricingProvider";
import { BidDto } from "@src/types/deployment";
import { feePercent, maxFee } from "@src/utils/constants";
import { aktToUakt, getAvgCostPerMonth, uaktToAKT } from "@src/utils/priceUtils";

export const useCloudmosFee = (bids: { [dseq: string]: BidDto }) => {
  const { isLoaded, price, isLoading } = usePricing();
  let totalEstMonthlyCost: number = 0,
    usdCost: number = 0,
    uaktCost: number = 0,
    fee: number = 0;

  if (!!price) {
    Object.keys(bids)
      .map(dseq => bids[dseq])
      .forEach(bid => {
        const avgMonthlyCost = getAvgCostPerMonth(parseFloat(bid.price.amount));

        totalEstMonthlyCost += avgMonthlyCost;
      });

    uaktCost = totalEstMonthlyCost * (feePercent / 100);
    // Cap the fee to .2$
    usdCost = Math.min(uaktToAKT(uaktCost) * price, maxFee);
    fee = aktToUakt(usdCost / price);
  }

  return { fee, isLoaded, isLoading };
};
