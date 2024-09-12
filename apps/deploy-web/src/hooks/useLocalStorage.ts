import { useEffect, useState } from "react";
import { useEventListener } from "usehooks-ts";

import { useWallet } from "@src/context/WalletProvider";
import networkStore from "@src/store/networkStore";

export const useLocalStorage = () => {
  const { address } = useWallet();
  const selectedNetwork = networkStore.useSelectedNetwork();

  const getLocalStorageItem = (key: string) => {
    return localStorage.getItem(`${selectedNetwork.id}${address ? "/" + address : ""}/${key}`);
  };

  const setLocalStorageItem = (key: string, value: string) => {
    localStorage.setItem(`${selectedNetwork.id}${address ? "/" + address : ""}/${key}`, value);
  };

  const removeLocalStorageItem = (key: string) => {
    localStorage.removeItem(`${selectedNetwork.id}${address ? "/" + address : ""}/${key}`);
  };

  return {
    removeLocalStorageItem,
    setLocalStorageItem,
    getLocalStorageItem
  };
};

export function useCustomLocalStorage<T>(key: string, initialValue: T) {
  // Get from local storage then
  // parse stored json or return initialValue
  const readValue = () => {
    // Prevent build error "window is undefined" but keep keep working
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

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((newValue: T) => T)) => {
    // Prevent build error "window is undefined" but keeps working
    if (typeof window == "undefined") {
      console.warn(`Tried setting localStorage key “${key}” even though environment is not a client`);
    }

    try {
      // Allow value to be a function so we have the same API as useState
      const newValue = value instanceof Function ? value(storedValue) : value;

      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(newValue));

      // Save state
      setStoredValue(newValue);

      // We dispatch a custom event so every useLocalStorage hook are notified
      window.dispatchEvent(new Event("local-storage"));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  };

  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStorageChange = () => {
    setStoredValue(readValue());
  };

  // this only works for other documents, not the current one
  useEventListener("storage", handleStorageChange);

  // this is a custom event, triggered in writeValueToLocalStorage
  // See: useLocalStorage()
  useEventListener("local-storage", handleStorageChange);

  return [storedValue, setValue];
}

// A wrapper for "JSON.parse()"" to support "undefined" value
function parseJSON(value: string) {
  try {
    return value === "undefined" ? undefined : JSON.parse(value ?? "");
  } catch (error) {
    return value === "undefined" ? undefined : value;
  }
}
