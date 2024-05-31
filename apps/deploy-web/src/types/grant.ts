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
