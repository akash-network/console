// import { notification } from 'antd'
import axios from "axios";
import * as Sentry from "@sentry/nextjs";

const errorNotification = (error = "Error Occurred") => {
  // notification.error({
  //   message: error,
  // })
  console.log(error);
};

const authClient = axios.create({
  baseURL: `http://aisrlqh46hd27cm7o29rqo3378.ingress.hurricane.akash.pub`,
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

    // Log the error to Sentry
    Sentry.captureException(error, {
      extra: {
        errorMessage,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
      },
    });

    // Display error notification (you can uncomment and use your preferred notification method)
    errorNotification(errorMessage);

    throw error;
  }
);

export default authClient;
