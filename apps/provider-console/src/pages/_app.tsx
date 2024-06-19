import type { AppProps } from "next/app";

import "@akashnetwork/ui/styles";
import "@src/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
