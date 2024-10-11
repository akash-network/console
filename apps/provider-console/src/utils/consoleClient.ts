// import { notification } from "antd";
import axios from "axios";

import authClient from "./authClient";

const errorNotification = (error = "Error Occurred") => {
  console.log(error);
};

const consoleClient = axios.create({
  baseURL: `https://console-api.akash.network/v1`,
  timeout: 60000
});

consoleClient.interceptors.response.use(
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


export default consoleClient;
