import { useState } from "react";
import { FormattedDate } from "react-intl";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { Button, Popup, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Trash } from "iconoir-react";

import { CreateApiKeyModal } from "@src/components/api-keys/CreateApiKeyModal";
import { VerifiedPayingCustomerRequiredLink } from "@src/components/user/VerifiedPayingCustomerRequiredLink";
import { useWallet } from "@src/context/WalletProvider";

interface Props {
  apiKeys: ApiKeyResponse[] | undefined;
  isDeleting: boolean;
  apiKeyToDelete: ApiKeyResponse | null;
  onDeleteApiKey: (apiKey: ApiKeyResponse) => void;
  onDeleteClose: () => void;
  updateApiKeyToDelete: (apiKey: ApiKeyResponse) => void;
}

export function ApiKeyList({ apiKeys, onDeleteApiKey, onDeleteClose, isDeleting, apiKeyToDelete, updateApiKeyToDelete }: Props) {
  const { isTrialing } = useWallet();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      {isCreateModalOpen && <CreateApiKeyModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />}
      {!!apiKeyToDelete && (
        <Popup
          fullWidth
          variant="custom"
          actions={[
            {
              label: "Close",
              color: "primary",
              variant: "secondary",
              side: "left",
              onClick: onDeleteClose
            },
            {
              label: "Confirm",
              color: "secondary",
              variant: "default",
              side: "right",
              disabled: isDeleting,
              isLoading: isDeleting,
              onClick: () => onDeleteApiKey(apiKeyToDelete)
            }
          ]}
          onClose={onDeleteClose}
          maxWidth="sm"
          enableCloseOnBackdropClick
          open={!!apiKeyToDelete}
          title="Delete API Key"
        >
          Are you sure you want to delete API Key: <b>{apiKeyToDelete?.name}</b>?
        </Popup>
      )}

      <div className="py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
          </div>
          <VerifiedPayingCustomerRequiredLink onClick={() => setIsCreateModalOpen(true)}>
            <Button>Create Key</Button>
          </VerifiedPayingCustomerRequiredLink>
        </div>

        <div className="rounded-lg bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2/12">Name</TableHead>
                <TableHead className="w-4/12">Key</TableHead>
                <TableHead className="w-4/12">Created</TableHead>
                <TableHead className="w-4/12">Last Used</TableHead>
                <TableHead className="w-1/12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys
                ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                ?.map(key => (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell>{key.keyFormat}</TableCell>
                    <TableCell>
                      <FormattedDate value={key.createdAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <FormattedDate value={key.lastUsedAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="default" size="icon" className="h-8 w-8 rounded-full text-xs" onClick={() => updateApiKeyToDelete(key)}>
                        <Trash />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

              {(apiKeys?.length === 0 || isTrialing) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No API keys found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
