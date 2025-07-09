import type { UserProfile } from "@auth0/nextjs-auth0/client";
import type { AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";

import { parseCookies, parseSetCookies, serializeCookies } from "./cookies";
import { loginViaOauth } from "./loginViaOauth";

export class AppHttpClient {
  private readonly client: AxiosInstance;
  private userProfile?: UserProfile & { id: string };

  constructor(appUrl: string) {
    this.client = axios.create({
      baseURL: appUrl,
      validateStatus: () => true,
      headers: {
        "Content-Type": "application/json"
      },
      adapter: "fetch"
    });

    this.client.interceptors.request.use(config => {
      config.headers["Content-Type"] = config.url?.startsWith("/api") ? "application/json; charset=utf-8" : "text/html; charset=utf-8";
      return config;
    });

    this.client.interceptors.response.use(response => {
      updateCookies(this.client, response);
      return response;
    });
  }

  async loginViaOauth(): Promise<void> {
    const cookies = await loginViaOauth(this.client.defaults.baseURL!);
    this.client.defaults.headers.common.Cookie = serializeCookies(cookies);
    const response = await this.client.get("/api/auth/me");
    this.userProfile = response.data;
  }

  async startTrial(): Promise<void> {
    await this.client.post("/api/proxy/v1/start-trial", {
      data: {
        userId: this.userProfile?.id
      }
    });
  }

  async get<T extends AxiosResponse<string>>(url: string): Promise<T> {
    return this.client.get(url);
  }
}

function updateCookies(client: AxiosInstance, response: AxiosResponse) {
  if (response.headers["set-cookie"]) {
    const cookies = response.headers["set-cookie"];
    const newCookies = parseSetCookies(Array.isArray(cookies) ? cookies.join(",") : cookies);
    const existingRawCookies = client.defaults.headers.common.Cookie as string;
    const existingCookies = existingRawCookies ? parseCookies(existingRawCookies) : null;

    client.defaults.headers.common.Cookie = serializeCookies({
      ...existingCookies,
      ...newCookies
    });
  }
}
