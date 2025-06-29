import type { AxiosInstance } from "axios";

import { getAllItems } from "../utils/pagination.utils";

export type RestApiCertificatesResponseType = {
  certificates: RestApiCertificate[];
  pagination: {
    next_key: string | null;
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

export class CertificatesService {
  constructor(private readonly axios: AxiosInstance) {}

  async getCertificates(params: GetCertificatesParams): Promise<RestApiCertificatesResponseType> {
    const queryParams: Record<string, string | number> = {
      "filter.owner": params.address,
      limit: Number(params.limit) || 20
    };

    if (params.state) queryParams["filter.state"] = params.state;
    if (params["pagination.key"]) queryParams["pagination.key"] = params["pagination.key"];
    if (params["pagination.count_total"]) queryParams["pagination.count_total"] = params["pagination.count_total"];

    const response = await this.axios.get<RestApiCertificatesResponseType>("/akash/cert/v1beta3/certificates/list", { params: queryParams });
    return response.data;
  }

  async getAllCertificates(params: GetCertificatesParams): Promise<RestApiCertificate[]> {
    return getAllItems(async pageParams => {
      const response = await this.getCertificates({ limit: 1000, ...params, ...pageParams });
      return {
        items: response.certificates,
        pagination: response.pagination
      };
    });
  }
}

type GetCertificatesParams = {
  address: string;
  state?: string;
  limit?: number;
  "pagination.key"?: string | null;
  "pagination.count_total"?: string;
};
