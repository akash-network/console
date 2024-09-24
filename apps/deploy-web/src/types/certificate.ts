export type RestApiCertificatesResponseType = {
  certificates: RestApiCertificate[];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestApiCertificate = {
  certificate: {
    cert: string;
    pubkey: string;
    state: string;
  };
  serial: string;
};
