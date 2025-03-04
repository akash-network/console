import axios, { Axios, AxiosRequestConfig, AxiosResponse } from "axios";

export class HttpService extends Axios {
  constructor(config?: AxiosRequestConfig) {
    const { headers, ...defaults } = axios.defaults;
    super({
      ...defaults,
      ...config
    });
  }

  protected extractData<T = unknown, U extends AxiosResponse<T> = AxiosResponse<T>>(response: U): U["data"] {
    return response.data;
  }
}
