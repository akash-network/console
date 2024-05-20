export type CosmosBankSupplyResponse = {
  supply: { denom: string; amount: string }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};
