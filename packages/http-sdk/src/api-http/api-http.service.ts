import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { HttpService } from "../http/http.service";

export interface ApiOutput<T> {
  data: T;
}

export class ApiHttpService extends HttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  post<T = any, R = AxiosResponse<ApiOutput<T>>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.post<ApiOutput<T>, R, D>(url, data, config) as Promise<R>;
  }

  patch<T = any, R = AxiosResponse<ApiOutput<T>>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.patch<ApiOutput<T>, R, D>(url, data, config) as Promise<R>;
  }

  get<T = any, R = AxiosResponse<ApiOutput<T>>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.get<ApiOutput<T>, R, D>(url, config) as Promise<R>;
  }

  protected extractApiData<T = unknown>(response: AxiosResponse<ApiOutput<T>>): ApiOutput<T>["data"] {
    return this.extractData(response).data;
  }
}
