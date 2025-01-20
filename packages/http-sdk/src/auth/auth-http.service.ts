import { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

export class AuthHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async sendVerificationEmail(userId: string) {
    return this.post("/v1/send-verification-email", { data: { userId } });
  }
}
