"use client";
import { Layout } from "@src/components/layout/Layout";
import { ProviderActionList } from "@src/components/shared/ProviderActionList";
import { useEffect, useState } from "react";
import restClient from "@src/utils/restClient";
import { Title } from "@src/components/shared/Title";

const ActionsList: React.FC = () => {
  const [actions, setActions] = useState<any[]>([]);
  useEffect(() => {
    const fetchActions = async () => {
      const response: any = await restClient.get(`/actions`);
      setActions(response.actions);
    };
    fetchActions();
  }, []);
  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>User Actions</Title>
        </div>
      </div>
      <div className="mt-10">
        <div className="text-sm font-semibold">
          <div className="items-center space-x-2">
            <ProviderActionList actions={actions} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ActionsList;
