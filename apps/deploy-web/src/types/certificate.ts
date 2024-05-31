export type RestApiCertificatesResponseType = {
  certificates: {
    certificate: {
      cert: string;
      pubkey: string;
      state: string;
    };
    serial: string;
  }[];
  pagination: {
    next_key: string;
    total: string;
  };
};
