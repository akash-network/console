// import { notification } from "antd";
import axios from "axios";
import * as Sentry from "@sentry/nextjs";

import authClient from "./authClient";
import { checkAndRefreshToken } from "./tokenUtils";
import { BASE_API_PROVIDER_CONSOLE_URL } from "./constants";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const restClient = axios.create({
  baseURL: BASE_API_PROVIDER_CONSOLE_URL,
  timeout: 60000
});

restClient.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    // Capture the error with Sentry
    Sentry.captureException(error);

    // whatever you want to do with the error
    if (typeof error.response === "undefined") {
      console.log(error)
      errorNotification("Server is not reachable or CORS is not enable on the server!");
    } else if (error.response) {
      Sentry.setContext("api_error", {
        status: error.response.status,
        data: error.response.data,
        url: error.config.url,
        method: error.config.method,
      });
      if (error.response.status >= 400 && error.response.status < 500) {
        errorNotification(`Client Error: ${error.response.status}`);
      } else if (error.response.status >= 500) {
        errorNotification(`Server Error: ${error.response.status}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      errorNotification("Server is not responding!");
    } else {
      // Something happened in setting up the request that triggered an Error
      errorNotification(error.message);
    }
    throw error;
  }
);

restClient.interceptors.request.use(async request => {
  request.headers = request.headers ?? {};
  const token = await checkAndRefreshToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  } else {
    // Handle the case when there's no valid token
    // For example: redirect to login page or throw an error
    throw new Error("No valid token available");
  }
  request.headers["ngrok-skip-browser-warning"] = "69420";
  return request;
});

export default restClient;
