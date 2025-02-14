import { useState } from "react";
import { FormattedDate } from "react-intl";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Trash } from "iconoir-react";
import { NextSeo } from "next-seo";

import { CreateApiKeyModal } from "@src/components/api-keys/CreateApiKeyModal";
import Layout from "@src/components/layout/Layout";
import { RequiredUserContainer } from "@src/components/user/RequiredUserContainer";
import { useUserApiKeys } from "@src/queries/useApiKeysQuery";

export default function ApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: apiKeys } = useUserApiKeys();

  return (
    <RequiredUserContainer>
      <Layout>
        <NextSeo title="API Keys" />
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
                  <TableCell>
                    <FormattedDate value={key.createdAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt && <FormattedDate value={key.lastUsedAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />}
                  </TableCell>
                  <TableCell>
                    <Button variant="default" size="icon" className="h-8 w-8 rounded-full text-xs">
                      <Trash />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {apiKeys?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No API keys found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {isCreateModalOpen && <CreateApiKeyModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />}
        </div>
      </Layout>
    </RequiredUserContainer>
  );
}
