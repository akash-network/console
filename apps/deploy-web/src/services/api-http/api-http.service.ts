import axios, { Axios, AxiosResponse } from "axios";

import { BASE_API_URL } from "@src/utils/constants";

export class ApiHttpService extends Axios {
  constructor() {
    const { headers, ...defaults } = axios.defaults;
    super({
      ...defaults,
      baseURL: BASE_API_URL
    });
  }

  extractData<T = unknown>(response: AxiosResponse<T>): AxiosResponse<T>["data"] {
    return response.data;
  }
}
