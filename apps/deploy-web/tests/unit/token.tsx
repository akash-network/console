import { useAtom } from "jotai";

import { tokens } from "@src/store/remoteDeployStore";

import { renderHook } from "@testing-library/react";

export const writeToken = ({ accessToken, refreshToken, type }: { accessToken: string; refreshToken: string; type: "bitbucket" | "github" | "gitlab" }) => {
  renderHook(() => {
    const [token, setToken] = useAtom(tokens);

    if (token.accessToken !== accessToken) {
      setToken({ accessToken, refreshToken, type });
    }
  });
};

export const readToken = () => {
  const { result } = renderHook(() => {
    const [token] = useAtom(tokens);
    return token.accessToken;
  });

  return result.current;
};
