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
