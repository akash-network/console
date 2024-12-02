"use client";

import { Layout } from "@src/components/layout/Layout";
import { ProviderActionList } from "@src/components/shared/ProviderActionList";
import { Title } from "@src/components/shared/Title";
import { useProviderActions } from "@src/queries/useProviderQuery";

const ActionsList: React.FC = () => {
  const { data: actions } = useProviderActions();
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
