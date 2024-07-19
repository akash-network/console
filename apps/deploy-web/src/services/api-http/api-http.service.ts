import axios, { Axios, AxiosRequestConfig, AxiosResponse } from "axios";

import { BASE_API_URL } from "@src/utils/constants";

export interface ApiOutput<T> {
  data: T;
}

export class ApiHttpService extends Axios {
  constructor() {
    const { headers, ...defaults } = axios.defaults;
    super({
      ...defaults,
      baseURL: BASE_API_URL
    });
  }

  post<T = any, R = ApiOutput<AxiosResponse<T>>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.post(url, data, config);
  }

  get<T = any, R = ApiOutput<AxiosResponse<T>>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.get(url, config);
  }

  protected extractData<T = unknown>(response: ApiOutput<AxiosResponse<T>>): AxiosResponse<T>["data"] {
    return response.data.data;
  }
}
