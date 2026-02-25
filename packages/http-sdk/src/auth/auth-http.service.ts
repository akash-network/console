import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { SendVerificationCodeResponse, VerifyEmailCodeResponse, VerifyEmailResponse } from "./auth-http.types";

export class AuthHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async sendVerificationEmail(userId: string) {
    return this.post("/v1/send-verification-email", { data: { userId } });
  }

  async sendVerificationCode(userId: string) {
    return this.extractData(await this.post<SendVerificationCodeResponse>("/v1/send-verification-code", { data: { userId } }));
  }

  async verifyEmailCode(userId: string, code: string) {
    return this.extractData(await this.post<VerifyEmailCodeResponse>("/v1/verify-email-code", { data: { userId, code } }));
  }

  async verifyEmail(email: string) {
    return this.extractData(await this.post<VerifyEmailResponse>("/v1/verify-email", { data: { email } }, { withCredentials: true }));
  }
}
