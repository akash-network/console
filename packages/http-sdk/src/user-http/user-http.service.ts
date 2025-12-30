import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

export interface UserOutput {
  id: string;
  userId?: string;
  username?: string;
  email?: string;
  emailVerified: boolean;
  stripeCustomerId?: string;
  bio?: string;
  subscribedToNewsletter: boolean;
  youtubeUsername?: string;
  twitterUsername?: string;
  githubUsername?: string;
}

export class UserHttpService extends HttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }
}
