import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { HttpService } from "../http/http.service";
import type { SendVerificationCodeResponse, VerifyEmailResponse } from "./auth-http.types";

export class AuthHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  /** @deprecated Use {@link sendVerificationCode} instead. This targets the legacy link-based verification endpoint. */
  async sendVerificationEmail(userId: string): Promise<AxiosResponse> {
    return this.post("/v1/send-verification-email", { data: { userId } });
  }

  async sendVerificationCode(): Promise<SendVerificationCodeResponse> {
    return this.extractData(await this.post<SendVerificationCodeResponse>("/v1/send-verification-code"));
  }

  async verifyEmailCode(code: string): Promise<void> {
    await this.post("/v1/verify-email-code", { data: { code } });
  }

  async verifyEmail(email: string): Promise<VerifyEmailResponse> {
    return this.extractData(await this.post<VerifyEmailResponse>("/v1/verify-email", { data: { email } }, { withCredentials: true }));
  }
}
