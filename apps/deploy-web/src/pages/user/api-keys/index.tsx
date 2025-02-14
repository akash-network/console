import { useState } from "react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import { CreateApiKeyModal } from "@src/components/api-keys/CreateApiKeyModal";
import { useUserApiKeys } from "@src/queries/useApiKeysQuery";

export default function ApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: apiKeys } = useUserApiKeys();

  const handleCreateKey = async () => {
    setIsCreateModalOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>Create Key</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>name</TableHead>
            <TableHead>key</TableHead>
            <TableHead>created</TableHead>
            <TableHead>last used</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys?.map(key => (
            <TableRow key={key.id}>
              <TableCell>{key.name}</TableCell>
              <TableCell>{key.keyFormat}</TableCell>
              <TableCell>{key.createdAt}</TableCell>
              <TableCell>{key.lastUsedAt}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  •••
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateApiKeyModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateKey={handleCreateKey} />
    </div>
  );
}
