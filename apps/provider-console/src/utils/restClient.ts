import * as Sentry from "@sentry/nextjs";
import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { checkAndRefreshToken } from "./tokenUtils";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const restClient = axios.create({
  baseURL: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL,
  timeout: 60000
});

restClient.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    Sentry.captureException(error);
    if (typeof error.response === "undefined") {
      errorNotification("Server is not reachable or CORS is not enable on the server!");
    } else if (error.response) {
      Sentry.setContext("api_error", {
        status: error.response.status,
        data: error.response.data,
        url: error.config.url,
        method: error.config.method
      });
      if (error.response.status >= 400 && error.response.status < 500) {
        errorNotification(`Client Error: ${error.response.status}`);
      } else if (error.response.status >= 500) {
        errorNotification(`Server Error: ${error.response.status}`);
      }
    } else if (error.request) {
      errorNotification("Server is not responding!");
    } else {
      errorNotification(error.message);
    }
    throw error;
  }
);

const waitForToken = async (maxAttempts = 5, delayMs = 1000): Promise<string | null> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await checkAndRefreshToken();
    if (token) return token;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
};

restClient.interceptors.request.use(async request => {
  request.headers = request.headers ?? {};
  const token = await waitForToken();
  if (!token) {
    return Promise.reject(new Error("Unable to obtain valid token after multiple attempts"));
  }

  request.headers.Authorization = `Bearer ${token}`;
  request.headers["ngrok-skip-browser-warning"] = "69420";
  return request;
});

export default restClient;
