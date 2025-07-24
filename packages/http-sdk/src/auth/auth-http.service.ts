import { HttpService } from "../http/http.service";

export class AuthHttpService extends HttpService {
  async sendVerificationEmail(userId: string) {
    return this.post("/v1/send-verification-email", { data: { userId } });
  }
}
