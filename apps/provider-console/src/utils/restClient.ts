// import { notification } from "antd";
import axios from "axios";

import authClient from "./authClient";
import { checkAndRefreshToken } from "./tokenUtils";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const restClient = axios.create({
  baseURL: `http://5cujrkcvn9e234vilf1iglkf98.ingress.hurricane.akash.pub/`,
  timeout: 60000
});

restClient.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    // whatever you want to do with the error
    if (typeof error.response === "undefined") {
      errorNotification("Server is not reachable or CORS is not enable on the server!");
    } else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx

      const originalRequest = error.config;

      if (error.response.status === 401 && error.response.data.detail === "Signature has expired" && !originalRequest.retry) {
        originalRequest.retry = true;

        try {
          const newToken = await checkAndRefreshToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return restClient(originalRequest);
          } else {
            // Token refresh failed, redirect to login or handle accordingly
            // For example: history.push("/auth/login");
            throw new Error("Token refresh failed");
          }
        } catch (refreshError) {
          console.error("Error refreshing token:", refreshError);
          throw refreshError;
        }
      }

      if (error.response.status === 401 && error.response.data.detail !== "Signature has expired") {
        console.log(error)
        // purgeStorage();

        // TODO: fix token removal logic
        // console.log("Removing Tokens")
        // localStorage.removeItem("accessToken");
        // localStorage.removeItem("refreshToken");
        // history.push("/auth/login");
      }

      errorNotification("Server Error!");
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
