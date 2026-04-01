import { HttpService } from "../http/http.service";
import type { HttpRequestConfig, HttpResponse } from "../http/http.types";

export interface ApiOutput<T> {
  data: T;
}

export class ApiHttpService extends HttpService {
  constructor(config?: Pick<HttpRequestConfig, "baseURL" | "headers" | "timeout">) {
    super(config);
  }

  // @ts-expect-error - Narrowing response type for API services that wrap responses in ApiOutput<T>
  post<T = any>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<ApiOutput<T>>> {
    return super.post(url, data, config) as Promise<HttpResponse<ApiOutput<T>>>;
  }

  // @ts-expect-error - Narrowing response type for API services that wrap responses in ApiOutput<T>
  patch<T = any>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<ApiOutput<T>>> {
    return super.patch(url, data, config) as Promise<HttpResponse<ApiOutput<T>>>;
  }

  // @ts-expect-error - Narrowing response type for API services that wrap responses in ApiOutput<T>
  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<ApiOutput<T>>> {
    return super.get(url, config) as Promise<HttpResponse<ApiOutput<T>>>;
  }

  protected extractApiData<T = unknown>(response: HttpResponse<ApiOutput<T>>): ApiOutput<T>["data"] {
    return this.extractData(response).data;
  }
}
