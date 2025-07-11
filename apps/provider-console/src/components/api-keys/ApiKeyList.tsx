import React, { useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@akashnetwork/ui/components";
import { Calendar, Clock, Copy, Eye, EyeClosed, Key, Trash } from "iconoir-react";

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
  const [copied, setCopied] = useState(false);

  const hasApiKey = !!apiKey;

  const handleCopy = () => {
    if (apiKey?.apiKey) {
      navigator.clipboard
        .writeText(apiKey.apiKey)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(error => {
          console.error("Failed to copy API key:", error);
        });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const isExpired = apiKey?.expiresAt
    ? (() => {
        try {
          const expirationDate = new Date(apiKey.expiresAt);
          return !isNaN(expirationDate.getTime()) && expirationDate < new Date();
        } catch {
          return false;
        }
      })()
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your API access credentials</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="p-6">
          {!hasApiKey ? (
            <div className="py-12 text-center">
              <Key className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">No API Key Available</h3>
              <p className="mb-4 text-gray-500 dark:text-gray-400">Create your first API key to start integrating with our services.</p>
              <Button onClick={onCreateApiKey} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Your First API Key"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status and Info Section */}
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${apiKey.isActive ? "bg-green-500" : "bg-red-500"}`}></div>
                    <span className="font-medium text-gray-900 dark:text-white">{apiKey.isActive ? "Active" : "Inactive"} API Key</span>
                    {isExpired && <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">Expired</span>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-gray-600 dark:text-gray-400">Created:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatDate(apiKey.createdAt)}</span>
                    </div>

                    {apiKey.lastUsedAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Last used:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatDate(apiKey.lastUsedAt)}</span>
                      </div>
                    )}

                    {apiKey.expiresAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Expires:</span>
                        <span className={`font-medium ${isExpired ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                          {formatDate(apiKey.expiresAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="destructive" size="sm" onClick={() => updateApiKeyToDelete(apiKey)} disabled={isDeleting} className="flex items-center gap-2">
                  <Trash className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>

              {/* API Key Section */}
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-white">API Key</h4>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowKey(v => !v)} className="flex items-center gap-2">
                      {showKey ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showKey ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className={`flex items-center gap-2 ${copied ? "border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20" : ""}`}
                    >
                      {copied ? (
                        <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
                  <code className="break-all font-mono text-sm text-gray-900 dark:text-white">
                    {showKey ? apiKey.apiKey : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
                  </code>
                </div>

                {!showKey && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Click "Show" to reveal your API key. Keep it secure and never share it publicly.
                  </p>
                )}
              </div>

              {/* Usage Guide Section */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="mb-1 font-medium text-gray-900 dark:text-white">Ready to integrate?</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Learn how to use your API key with our comprehensive documentation.</p>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/swagger`}
                    className="text-sm font-medium text-gray-900 hover:underline dark:text-white"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View API Documentation →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!apiKeyToDelete} onOpenChange={() => onDeleteClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone and will immediately revoke access for any applications using this key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteApiKey} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
