import * as Sentry from "@sentry/nextjs";
import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const authClient = axios.create({
  baseURL: browserEnvConfig.NEXT_PUBLIC_BASE_SECURITY_URL,
  timeout: 30000
});

authClient.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    let errorMessage = "An unexpected error occurred";

    if (typeof error.response === "undefined") {
      errorMessage = "Server is not reachable or CORS is not enabled on the server!";
    } else if (error.response) {
      errorMessage = "Server Error!";
    } else if (error.request) {
      errorMessage = "Server is not responding!";
    } else {
      errorMessage = error.message;
    }

    Sentry.captureException(error, {
      extra: {
        errorMessage,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
      },
    });

    errorNotification(errorMessage);
    throw error;
  }
);

export default authClient;
