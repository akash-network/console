"use client";
import React, { useEffect, useRef, useState } from "react";
import { Separator, Spinner } from "@akashnetwork/ui/components";
import { LazyLog, ScrollFollow } from "@melloware/react-logviewer";
import { EventSourcePolyfill } from "event-source-polyfill";
import { ArrowDown, ArrowRight, Check, Xmark } from "iconoir-react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useProviderActionStatus } from "@src/queries/useProviderQuery";
import { formatLocalTime, formatTimeLapse } from "@src/utils/dateUtils";
import restClient from "@src/utils/restClient";
import { checkAndRefreshToken } from "@src/utils/tokenUtils";

interface TaskLogs {
  [taskId: string]: string;
}

interface StaticLog {
  type: string;
  message: string;
}

interface StaticLogsResponse {
  logs: StaticLog[];
}

export const ActivityLogDetails: React.FC<{ actionId: string | null }> = ({ actionId }) => {
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLogs>({});
  const logStreams = useRef<{ [taskId: string]: EventSourcePolyfill | null }>({});
  const { data: actionDetails, isLoading } = useProviderActionStatus(actionId);

  useEffect(() => {
    if (actionDetails) {
      const initialAccordions = actionDetails.tasks.map(task => task.status === "in_progress");
      setOpenAccordions(initialAccordions);
    }
  }, [actionDetails]);

  useEffect(() => {
    if (actionDetails?.tasks) {
      Object.values(logStreams.current).forEach(stream => stream?.close());
      logStreams.current = {};

      actionDetails.tasks.forEach((task, index) => {
        if (task.status === "in_progress") {
          setOpenAccordions(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
          setupLogStream(task.id);
        }
      });
    }

    return () => {
      Object.values(logStreams.current).forEach(stream => stream?.close());
      logStreams.current = {};
    };
  }, [actionDetails?.tasks]);

  const fetchTaskLogs = async (taskId: string) => {
    const response = await restClient.get<StaticLogsResponse, StaticLogsResponse>(`/tasks/logs/archive/${taskId}`);
    setTaskLogs(prev => ({
      ...prev,
      [taskId]: response.logs.map((log: StaticLog) => `${log.type === "stderr" ? "[ERROR] " : ""}${log.message}`).join("\n")
    }));
  };

  const setupLogStream = async (taskId: string) => {
    if (logStreams.current[taskId]) return;

    const token = await checkAndRefreshToken();
    const eventSource = new EventSourcePolyfill(`${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/tasks/logs/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    logStreams.current[taskId] = eventSource;

    eventSource.onmessage = event => {
      try {
        const logData = JSON.parse(event.data);
        const formattedMessage = `${logData.type === "stderr" ? "[ERROR] " : ""}${logData.message}`;

        setTaskLogs(prev => ({
          ...prev,
          [taskId]: prev[taskId] ? `${prev[taskId]}\n${formattedMessage}` : formattedMessage
        }));
      } catch (error) {
        console.error("Error parsing log message:", error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      logStreams.current[taskId] = null;
    };
  };

  const handleAccordionToggle = (index: number, task: (typeof actionDetails.tasks)[0]) => {
    setOpenAccordions(prev => {
      const newState = [...prev];
      newState[index] = !newState[index];

      if (newState[index]) {
        if (task.status === "in_progress") {
          setupLogStream(task.id);
        } else if (!taskLogs[task.id]) {
          fetchTaskLogs(task.id);
        }
      } else {
        logStreams.current[task.id]?.close();
        logStreams.current[task.id] = null;
      }

      return newState;
    });
  };

  const renderLogs = (logs: string) => {
    if (!logs) {
      return (
        <div className="mt-4 flex items-center justify-center" style={{ height: 300 }}>
          <Spinner className="text-blue-500" />
        </div>
      );
    }

    return (
      <div className="mt-4" style={{ height: 300 }}>
        <ScrollFollow
          startFollowing={true}
          render={({ follow, onScroll }) => (
            <LazyLog
              text={logs}
              follow={follow}
              onScroll={onScroll}
              highlight={[]}
              extraLines={1}
              ansi
              caseInsensitive
              selectableLines
              enableLineNumbers={false}
              containerStyle={{
                maxHeight: "300px",
                borderRadius: "0.375rem"
              }}
            />
          )}
        />
      </div>
    );
  };

  if (actionId === null) {
    return (
      <div className="flex w-full flex-col items-center pt-10">
        <div className="w-full max-w-2xl">
          <h3 className="text-xl font-bold">Job ID Not Found</h3>
          <p className="text-muted-foreground text-sm">Unable to retrieve provider setup process information.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex w-full flex-col pt-2">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {actionDetails?.status === "in_progress" && <Spinner className="text-blue-500" size="small" />}
            {actionDetails?.status === "completed" && <Check className="h-5 w-5 text-green-500" />}
            {actionDetails?.status === "failed" && <Xmark className="h-5 w-5 text-red-500" />}
            <span className="text-xl font-semibold">{actionDetails?.name}</span>
          </div>
          <Separator />
          <p className="text-sm text-gray-500">{actionDetails?.id}</p>
          <p className="text-sm text-gray-500">
            Started: {formatLocalTime(actionDetails?.start_time)}
            {actionDetails?.end_time && ` | Ended: ${formatLocalTime(actionDetails?.end_time)}`}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border">
            {actionDetails?.tasks.map((task, index) => (
              <div key={index}>
                <div
                  className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                  onClick={() => handleAccordionToggle(index, task)}
                >
                  <div className="flex items-center">
                    {openAccordions[index] ? <ArrowDown className="mr-2 h-5 w-5" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                    <span>{task.description}</span>
                  </div>
                  <div className="flex items-center">
                    {task.start_time && (
                      <p className="mr-2 text-xs text-gray-500">
                        {task.status === "in_progress"
                          ? formatTimeLapse(task.start_time, null)
                          : task.end_time
                            ? formatTimeLapse(task.start_time, task.end_time)
                            : ""}
                      </p>
                    )}
                    {task.status === "completed" && <Check className="h-4 w-4 text-green-500" />}
                    {task.status === "in_progress" && <Spinner className="text-blue-500" size="small" />}
                    {task.status === "not_started" && <div className="h-5 w-5 rounded-full border-2"></div>}
                    {task.status === "failed" && <Xmark className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                {openAccordions[index] && (
                  <div className="border-t p-4">
                    <p className="text-sm">{task.description}</p>
                    {task.start_time && <p className="text-xs text-gray-500">Started: {formatLocalTime(task.start_time)}</p>}
                    {task.end_time && <p className="text-xs text-gray-500">Ended: {formatLocalTime(task.end_time)}</p>}

                    {renderLogs(taskLogs[task.id])}
                  </div>
                )}
                {index < actionDetails?.tasks.length - 1 && <div className="border-t"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
