export type RestAkashBidListResponseType = {
  bids: [
    {
      bid: {
        bid_id: {
          owner: string;
          dseq: string;
          gseq: number;
          oseq: number;
          provider: string;
        };
        state: "open" | "active" | "closed";
        price: {
          denom: string;
          amount: string;
        };
        created_at: string;
      };
      escrow_account: {
        id: {
          scope: string;
          xid: string;
        };
        owner: string;
        state: string;
        balance: {
          denom: string;
          amount: string;
        };
        transferred: {
          denom: string;
          amount: string;
        };
        settled_at: string;
        depositor: string;
        funds: {
          denom: string;
          amount: string;
        };
      };
    }
  ];
  pagination: {
    next_key: string | null;
    total: string;
  };
};
