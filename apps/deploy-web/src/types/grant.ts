export type GrantType = {
  granter: string;
  grantee: string;
  expiration: string;
  authorization: {
    "@type": string;
    spend_limit: {
      denom: string;
      amount: string;
    };
  };
};

export type AllowanceType = {
  granter: string;
  grantee: string;
  allowance: {
    "@type": string;
    expiration: string;
    spend_limit: {
      denom: string;
      amount: string;
    }[];
  };
};

export type PaginatedAllowanceType = {
  allowances: AllowanceType[];
  pagination?: {
    next_key: string | null;
    total: number;
  };
};

export type PaginatedGrantType = {
  grants: GrantType[];
  pagination?: {
    next_key: string | null;
    total: number;
  };
};
