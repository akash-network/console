import React, { useCallback } from "react";
import { Separator } from "@akashnetwork/ui/components";
import { CheckCircle, Play, XmarkCircle } from "iconoir-react";
import { useRouter } from "next/router";

interface ProviderAction {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "pending" | "failed" | "not_started";
  start_time: string;
  end_time?: string;
}

interface ActivityLogsListProps {
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

export const ActivityLogList: React.FC<ActivityLogsListProps> = ({ actions }) => {
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
    router.push(`/activity-logs/${actionId}`);
  };

  return (
    <div className="mt-5 w-full">
      <div className="mb-4 grid grid-cols-12 items-center gap-4 px-4 text-sm font-medium text-gray-500">
        <div className="col-span-4">Action</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-4">Timestamp</div>
        <div className="col-span-2 text-right">Status</div>
      </div>
      <Separator />
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {actions.length > 0 ? (
          actions.map(action => (
            <li key={action.id} className="cursor-pointer py-4 hover:bg-gray-50 dark:hover:bg-gray-600/50" onClick={() => handleRowClick(action.id)}>
              <div className="grid grid-cols-12 items-center gap-4 px-4">
                <div className="col-span-4">
                  <p className="text-sm font-medium">{action.name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-sm">{calculateTimeLapse(action.start_time, action.end_time)}</p>
                </div>
                <div className="col-span-4">
                  <p className="text-muted-foreground text-sm">{formatDate(action.start_time)}</p>
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
              <div className="col-span-12 text-center">
                <p className="text-base text-lg text-gray-500">
                  No activity logs to display. <br />
                </p>
                <p className="text-md pt-2 text-gray-500">
                  This is likely because this Provider was not set up using Provider Console and/or hasn&apos;t had any changes made to it via Provider Console.
                </p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
};
