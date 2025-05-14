import axios, { Axios, type AxiosRequestConfig, type AxiosResponse } from "axios";

export class HttpService extends Axios {
  constructor(config?: AxiosRequestConfig) {
    const { headers, ...defaults } = axios.defaults;
    super({
      ...defaults,
      ...config
    });
  }

  protected extractData<T = unknown>(response: AxiosResponse<T>): AxiosResponse<T>["data"] {
    return response.data;
  }
}
