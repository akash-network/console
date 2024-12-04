import React, { useCallback } from "react";
import { CheckCircle, Play, XmarkCircle } from "iconoir-react";
import { useRouter } from "next/router";

interface ProviderAction {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  start_time: string;
  end_time?: string;
}

interface ProviderActionListProps {
  actions: ProviderAction[];
}

interface StatusIconProps {
  status: ProviderAction["status"];
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="text-green-500" />;
    case "in_progress":
      return <Play className="text-blue-500" />;
    case "failed":
      return <XmarkCircle className="text-red-500" />;
    default:
      return <div className="h-6 w-6 rounded-full border-2 border-gray-300" />;
  }
};

export const ProviderActionList: React.FC<ProviderActionListProps> = ({ actions }) => {
  const router = useRouter();

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString + "Z");

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    });
  }, []);

  const calculateTimeLapse = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const timeLapse = endTime - startTime;
    return `${Math.floor(timeLapse / 1000)} seconds`;
  };

  const handleRowClick = (actionId: string) => {
    router.push(`/actions/${actionId}`);
  };

  return (
    <div className="w-full">
      <ul className="divide-y divide-gray-200">
        {actions.length > 0 ? (
          actions.map(action => (
            <li key={action.id} className="cursor-pointer py-4" onClick={() => handleRowClick(action.id)}>
              <div className="grid grid-cols-12 items-center gap-4">
                <div className="col-span-4">
                  <p className="text-sm font-medium">{action.name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">{calculateTimeLapse(action.start_time, action.end_time)}</p>
                </div>
                <div className="col-span-4">
                  <p className="text-sm text-gray-500">{formatDate(action.start_time)}</p>
                </div>
                <div className="col-span-2 flex justify-end">
                  <StatusIcon status={action.status} />
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="py-4">
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-12">
                <p className="text-base text-gray-500">No recent actions to display.</p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
};
