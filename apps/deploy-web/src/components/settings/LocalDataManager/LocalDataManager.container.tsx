import { LocalData, LocalDataManagerComponent } from "./LocalDataManager.component";
import React, { useCallback } from "react";

export const LocalDataManagerContainer = () => {
  const importLocalData = useCallback((data: LocalData) => {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, data[key]);
    });
  }, []);

  const readLocalData = useCallback(() => {
    return localStorage;
  }, []);

  const reload = () => window.location.reload();

  return <LocalDataManagerComponent read={readLocalData} write={importLocalData} onDone={reload} />;
};
