export type RestLeaseListResponse = {
  leases: {
    lease: {
      lease_id: {
        owner: string;
        dseq: string;
        gseq: number;
        oseq: number;
        provider: string;
      };
      state: string;
      price: {
        denom: string;
        amount: string;
      };
      created_at: string;
      closed_on: string;
    };
    escrow_payment: {
      account_id: {
        scope: string;
        xid: string;
      };
      payment_id: string;
      owner: string;
      state: string;
      rate: {
        denom: string;
        amount: string;
      };
      balance: {
        denom: string;
        amount: string;
      };
      withdrawn: {
        denom: string;
        amount: string;
      };
    };
  }[];
  pagination: {
    next_key: string;
    total: string;
  };
};
