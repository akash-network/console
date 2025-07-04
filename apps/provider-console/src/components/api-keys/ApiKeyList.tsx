import React, { useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@akashnetwork/ui/components";
import { Trash } from "iconoir-react";

import type { ApiKey } from "@src/types/apiKey";

interface ApiKeyListProps {
  apiKey: ApiKey | null | undefined;
  onDeleteApiKey: () => void;
  onDeleteClose: () => void;
  isDeleting: boolean;
  apiKeyToDelete: ApiKey | null;
  updateApiKeyToDelete: (apiKey: ApiKey) => void;
  onCreateApiKey: () => void;
  isCreating: boolean;
}

export const ApiKeyList: React.FC<ApiKeyListProps> = ({
  apiKey,
  onDeleteApiKey,
  onDeleteClose,
  isDeleting,
  apiKeyToDelete,
  updateApiKeyToDelete,
  onCreateApiKey,
  isCreating
}) => {
  const [showKey, setShowKey] = useState(false);

  const hasApiKey = !!apiKey;

  const handleCopy = () => {
    if (apiKey?.apiKey) {
      navigator.clipboard.writeText(apiKey.apiKey);
    }
  };
  console.log("apiKey", apiKey);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API Key</h1>
        <Button variant="default" disabled={hasApiKey || isCreating} onClick={onCreateApiKey}>
          {isCreating ? "Creating..." : "Create New API Key"}
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="p-4">
          <div className="space-y-4">
            {!hasApiKey ? (
              <div className="text-center text-gray-500">No API key available.</div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm text-gray-500">Created: {new Date(apiKey.createdAt).toLocaleDateString()}</p>
                  <div className="mt-2 flex items-center">
                    <span className="mr-4 font-mono text-lg">{showKey ? apiKey.apiKey : "****************************************************"}</span>
                    <Button variant="outline" size="sm" onClick={() => setShowKey(v => !v)}>
                      {showKey ? "Hide Key" : "Show Key"}
                    </Button>
                    <Button variant="outline" size="sm" className="ml-2" onClick={handleCopy}>
                      Copy API Key
                    </Button>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => updateApiKeyToDelete(apiKey)} disabled={isDeleting}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!apiKeyToDelete} onOpenChange={() => onDeleteClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>Are you sure you want to delete this API key? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteApiKey} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
