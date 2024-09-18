// import { notification } from "antd";
import axios from "axios";

import authClient from "./authClient";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const restClient = axios.create({
  baseURL: `https://8b1f-99-209-150-74.ngrok-free.app`,
  timeout: 60000
});

restClient.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // whatever you want to do with the error
    if (typeof error.response === "undefined") {
      errorNotification("Server is not reachable or CORS is not enable on the server!");
    } else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx

      const originalRequest = error.config;

      if (error.response.status === 401 && error.response.data.detail === "Signature has expired" && !originalRequest.retry) {
        originalRequest.retry = true;


        // TODO Refresh Token Login Goes here
        // if (window.refreshingToken) {
        //   setTimeout(() => {
        //     originalRequest.headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
        //     return restClient.request(originalRequest);
        //   }, 1500);
        // } else {
        //   window.refreshingToken = true;
        //   return authClient
        //     .post("/auth/refresh", {
        //       refresh_token: localStorage.getItem("refreshToken"),
        //       address: localStorage.getItem("walletAddress")
        //     })
        //     .then(res => {
        //       if (res.status === "success") {
        //         // 1) put token to LocalStorage
        //         localStorage.setItem("accessToken", res.data.access_token);
        //         localStorage.setItem("refreshToken", res.data.refresh_token);
        //         window.refreshingToken = false;
        //         // 2) Change Authorization header
        //         originalRequest.headers.Authorization = `Bearer ${getStorageItem("accessToken")}`;
        //         // 3) return originalRequest object with Axios.
        //         return restClient.request(originalRequest);
        //       }
        //       if (res.status === "error") {
        //         // purgeStorage();
        //         localStorage.removeItem("accessToken");
        //         localStorage.removeItem("refreshToken");
        //         // history.push("/auth/login");
        //       }
        //       return false;
        //     });
        // }


      }

      if (error.response.status === 401 && error.response.data.detail !== "Signature has expired") {
        // purgeStorage();

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
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
  request.headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
  request.headers["ngrok-skip-browser-warning"] = "69420";
  return request;
});
export default restClient;
