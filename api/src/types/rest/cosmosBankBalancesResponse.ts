export type RestCosmosBankBalancesResponse = {
  balances: {
    denom: string;
    amount: string;
  }[];
  pagination: {
    next_key: string | null;
    total: number;
  };
};
