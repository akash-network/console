import { useEffect } from "react";
import useWebSocket, { Options } from "react-use-websocket";

export const useCustomWebSocket = (url: string, options: Options) => {
  const ws = useWebSocket(url, options);

  useEffect(() => {
    const timeout = setInterval(() => {
      ws.sendJsonMessage({ type: "ping" });
    }, 30 * 1000);

    return () => clearInterval(timeout);
  }, []);

  return ws;
};
