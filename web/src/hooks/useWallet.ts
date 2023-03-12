import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { KeplrWallet, keplrState, showKeplrWindow } from "../recoil/atoms";
import { getKeplr } from "../_helpers/keplr-utils";

export function useWallet() {
  const [keplr, setKeplr] = useRecoilState(keplrState);
  const isConnected = keplr.isSignedIn;
  const [, setShowKeplrPopup] = useRecoilState(showKeplrWindow);

  useEffect(() => {
    if (isConnected) {
      getKeplr()
        .then((res) => {
          setKeplr(res);
        })
        .catch(() => {
          disconnectWallet();
        });
    }
  }, [isConnected]);

  const connectWallet = () => {
    if (!window.keplr) {
      setShowKeplrPopup(true);
      return;
    }

    getKeplr()
      .then((res) => {
        setKeplr(res);
        localStorage.setItem('walletConnected', 'true');
      })
      .catch(() => {
        disconnectWallet();
      });
  };

  const disconnectWallet = () => {
    if (isConnected) {
      localStorage.setItem('walletConnected', 'false');
      setKeplr({
        isSignedIn: false,
        accounts: []
      });
    }
  };

  return {
    isConnected,
    connect: connectWallet,
    disconnect: disconnectWallet,
  };
}