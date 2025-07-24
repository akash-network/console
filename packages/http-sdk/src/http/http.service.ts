import { type AxiosInstance, type AxiosResponse } from "axios";

export class HttpService {
  constructor(private readonly _axios: AxiosInstance) {}

  protected extractData<T = unknown>(response: AxiosResponse<T>): AxiosResponse<T>["data"] {
    return response.data;
  }

  get<T = unknown, R = AxiosResponse<T>>(...args: Parameters<AxiosInstance["get"]>): Promise<R> {
    return this.axios.get(...args);
  }

  post<T = unknown, R = AxiosResponse<T>>(...args: Parameters<AxiosInstance["post"]>): Promise<R> {
    return this.axios.post(...args);
  }

  patch<T = unknown, R = AxiosResponse<T>>(...args: Parameters<AxiosInstance["patch"]>): Promise<R> {
    return this.axios.patch(...args);
  }

  put<T = unknown, R = AxiosResponse<T>>(...args: Parameters<AxiosInstance["put"]>): Promise<R> {
    return this.axios.put(...args);
  }

  delete<T = unknown, R = AxiosResponse<T>>(...args: Parameters<AxiosInstance["delete"]>): Promise<R> {
    return this.axios.delete(...args);
  }

  get axios() {
    return this._axios;
  }
}
