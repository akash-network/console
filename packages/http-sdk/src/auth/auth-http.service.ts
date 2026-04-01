import { HttpService } from "../http/http.service";
import type { HttpRequestConfig } from "../http/http.types";
import type { VerifyEmailResponse } from "./auth-http.types";

export class AuthHttpService extends HttpService {
  constructor(config?: Pick<HttpRequestConfig, "baseURL">) {
    super(config);
  }

  async sendVerificationEmail(userId: string) {
    return this.post("/v1/send-verification-email", { data: { userId } });
  }

  async verifyEmail(email: string) {
    return this.extractData(await this.post<VerifyEmailResponse>("/v1/verify-email", { data: { email } }, { withCredentials: true }));
  }
}
