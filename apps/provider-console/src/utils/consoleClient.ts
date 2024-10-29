// import { notification } from "antd";
import { browserEnvConfig } from "@src/config/browser-env.config";

import * as Sentry from "@sentry/nextjs";
import axios from "axios";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const consoleClient = axios.create({
  baseURL: browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_MAINNET_URL,
  timeout: 60000
});

consoleClient.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    let errorMessage = "An unexpected error occurred";
    if (typeof error.response === "undefined") {
      errorMessage = "Server is not reachable or CORS is not enable on the server!";
      errorNotification("Server is not reachable or CORS is not enable on the server!");
    } else if (error.response) {
      errorMessage = "Server Error!";
      errorNotification("Server Error!");
    } else if (error.request) {
      errorMessage = "Server is not responding!";
      errorNotification("Server is not responding!");
    } else {
      errorMessage = error.message;
      errorNotification(error.message);
    }
    Sentry.captureException(error, {
      extra: {
        errorMessage,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
      },
    });
    throw error;
  }
);


export default consoleClient;
