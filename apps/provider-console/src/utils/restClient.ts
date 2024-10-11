// import { notification } from "antd";
import axios from "axios";

import authClient from "./authClient";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const restClient = axios.create({
  baseURL: `https://b588-99-209-150-74.ngrok-free.app`,
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
          const refreshToken = localStorage.getItem("refreshToken");
          const walletAddress = localStorage.getItem("walletAddress");

          const refreshResponse = await authClient.post("/auth/refresh", {
            refresh_token: refreshToken,
            address: walletAddress
          });

          if (refreshResponse.data.status === "success") {
            localStorage.setItem("accessToken", refreshResponse.data.access_token);
            localStorage.setItem("refreshToken", refreshResponse.data.refresh_token);

            originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
            return restClient.request(originalRequest);
          } else {
            // Handle refresh token failure
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("walletAddress");
            // Redirect to login page or handle as needed
            // history.push("/auth/login");
            throw new Error("Refresh token failed");
          }
        } catch (refreshError) {
          // Handle refresh token request error
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
  request.headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
  request.headers["ngrok-skip-browser-warning"] = "69420";
  return request;
});
export default restClient;
