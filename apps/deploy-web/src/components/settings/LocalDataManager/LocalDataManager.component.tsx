import React, { FC, useCallback, useRef } from "react";
import { Download, Upload } from "iconoir-react";

import { Button } from "@akashnetwork/ui/components";
import { usePopup } from "@src/context/PopupProvider/PopupProvider";

export type LocalData = Record<string, any>;

interface LocalDataManagerProps {
  read: () => LocalData;
  write: (data: LocalData) => void;
  onDone?: () => void;
}

export const LocalDataManagerComponent: FC<LocalDataManagerProps> = ({ read, write, onDone }) => {
  const ref = useRef<HTMLInputElement>(null);
  const { confirm } = usePopup();

  const triggerFileUpload = useCallback(async () => {
    const isConfirmed = await confirm({
      title: "Import Local Data",
      message: "Existing local data will be overwritten. Are you sure you want to proceed?"
    });
    if (isConfirmed) {
      ref.current?.click();
    }
  }, [ref.current]);

  const importLocalData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = JSON.parse(reader.result as string);
      write(data);

      if (typeof onDone === "function") {
        onDone();
      }
    };
    reader.readAsText(file);
  }, []);

  const downloadLocalData = useCallback(() => {
    const data = JSON.stringify(read());
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "console.akash.network.data.json";
    link.click();
  }, []);

  return (
    <div className="grid-col-1 mt-4 grid gap-4 md:grid-cols-2">
      <Button onClick={downloadLocalData} size="sm" className="mt-6">
        <Download className="text-sm" />
        Export Local Data
      </Button>

      <input onChange={importLocalData} type="file" ref={ref} hidden accept=".json" />

      <Button onClick={triggerFileUpload} size="sm" className="mt-6">
        <Upload className="text-sm" />
        Import Local Data
      </Button>
    </div>
  );
};
