import { getSession } from "@auth0/nextjs-auth0";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import httpProxy from "http-proxy";

export default (req, res) => {
  return new Promise((resolve, reject) => {
    // removes the api prefix from url
    req.url = req.url.replace(/^\/api\/proxy/, "");

    console.log("proxy:", req.url);
    const session = getSession(req, res);

    // don't forwards the cookies to the target server
    req.headers.cookie = "";

    if (session?.accessToken) {
      req.headers.authorization = `Bearer ${session.accessToken}`;
    }

    const proxy = httpProxy.createProxyServer({
      changeOrigin: true,
      target: BASE_API_MAINNET_URL,
      // headers: {
      //   "ngrok-skip-browser-warning": "true"
      // },
      secure: false,
      autoRewrite: false
    });

    proxy.once("proxyRes", resolve).once("error", reject).web(req, res);
  });
};

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
