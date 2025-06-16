import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@akashnetwork/ui/components";
import { Trash } from "iconoir-react";

interface ApiKeyListProps {
  apiKeys: ApiKeyResponse[] | undefined;
  onDeleteApiKey: () => void;
  onDeleteClose: () => void;
  isDeleting: boolean;
  apiKeyToDelete: ApiKeyResponse | null;
  updateApiKeyToDelete: (apiKey: ApiKeyResponse) => void;
}

export const ApiKeyList: React.FC<ApiKeyListProps> = ({ apiKeys, onDeleteApiKey, onDeleteClose, isDeleting, apiKeyToDelete, updateApiKeyToDelete }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button variant="default">Create New API Key</Button>
      </div>

      <div className="rounded-lg border">
        <div className="p-4">
          <div className="space-y-4">
            {apiKeys?.map(apiKey => (
              <div key={apiKey.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <h3 className="font-medium">{apiKey.name}</h3>
                  <p className="text-sm text-gray-500">Created: {new Date(apiKey.createdAt).toLocaleDateString()}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => updateApiKeyToDelete(apiKey)} disabled={isDeleting}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
