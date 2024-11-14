import { useEffect, useState } from "react";
import { useEventListener } from "usehooks-ts";

import { useWallet } from "@src/context/WalletProvider";

export const useLocalStorage = () => {
  const { address } = useWallet();

  const getLocalStorageItem = (key: string) => {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");

    return localStorage.getItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`);
  };

  const setLocalStorageItem = (key: string, value: string) => {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");

    localStorage.setItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`, value);
  };

  const removeLocalStorageItem = (key: string) => {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");
    localStorage.removeItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`);
  };

  return {
    removeLocalStorageItem,
    setLocalStorageItem,
    getLocalStorageItem
  };
};

export function useCustomLocalStorage<T>(key: string, initialValue: T) {
  const readValue = () => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (parseJSON(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = (value: T | ((newValue: T) => T)) => {
    if (typeof window == "undefined") {
      console.warn(`Tried setting localStorage key “${key}” even though environment is not a client`);
    }

    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      window.localStorage.setItem(key, JSON.stringify(newValue));
      setStoredValue(newValue);
      window.dispatchEvent(new Event("local-storage"));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  };

  useEffect(() => {
    setStoredValue(readValue());
  }, []);

  const handleStorageChange = () => {
    setStoredValue(readValue());
  };

  useEventListener("storage", handleStorageChange);

  useEventListener("local-storage", handleStorageChange);

  return [storedValue, setValue];
}

function parseJSON(value: string) {
  try {
    return value === "undefined" ? undefined : JSON.parse(value ?? "");
  } catch (error) {
    return value === "undefined" ? undefined : value;
  }
}
