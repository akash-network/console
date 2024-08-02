import { HttpService } from "@akashnetwork/http-sdk";
import { AxiosRequestConfig, AxiosResponse } from "axios";

export interface ApiOutput<T> {
  data: T;
}

export class ApiHttpService extends HttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  post<T = any, R = ApiOutput<AxiosResponse<T>>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.post(url, data, config);
  }

  get<T = any, R = ApiOutput<AxiosResponse<T>>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return super.get(url, config);
  }

  protected extractApiData<T = unknown>(response: ApiOutput<AxiosResponse<T>>): AxiosResponse<T>["data"] {
    return this.extractData(response.data);
  }
}
