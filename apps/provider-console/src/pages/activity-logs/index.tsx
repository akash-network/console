"use client";

import { Layout } from "@src/components/layout/Layout";
import { ActivityLogList } from "@src/components/shared/ActivityLogList";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useProviderActions } from "@src/queries/useProviderQuery";

const ActivityLogs: React.FC = () => {
  const { data: actions = [] } = useProviderActions();
  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Activity Logs</Title>
        </div>
      </div>
      <div className="mt-10">
        <div className="text-sm font-semibold">
          <div className="items-center space-x-2">
            <ActivityLogList actions={actions} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: ActivityLogs, authLevel: "wallet" });
