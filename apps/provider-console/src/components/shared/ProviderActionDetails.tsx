"use client";
import { Separator } from "@akashnetwork/ui/components";
import React, { useState, useEffect } from "react";
import { CheckIcon, Loader2Icon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import restClient from "@src/utils/restClient";

interface Task {
  title: string;
  description: string;
  status: "completed" | "in_progress" | "not_started" | "failed";
  start_time: string | null;
  end_time: string | null;
}

interface ApiResponse {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "failed";
  start_time: string;
  end_time: string | null;
  tasks: Task[];
}

const formatLocalTime = (utcTime: string | null) => {
  if (!utcTime) return null;
  // Parse the UTC time string
  const [datePart, timePart] = utcTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  // Create a Date object in UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short"
  };

  return utcDate.toLocaleString(undefined, options);
};

const formatTimeLapse = (start: string, end: string | null) => {
  const startDate = new Date(start + "Z"); // Append 'Z' to ensure UTC interpretation
  const endDate = end ? new Date(end + "Z") : new Date(); // Use current time in UTC for in-progress tasks

  const durationMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

export const ProviderActionDetails: React.FunctionComponent<{ actionId: string | null }> = ({ actionId }) => {
  const [processData, setProcessData] = useState<ApiResponse | null>(null);
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response: any = await restClient.get(`/build-provider-status/${actionId}`);
        setProcessData(response);
        setOpenAccordions(new Array(response.data.tasks.length).fill(false));
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [actionId]);

  const toggleAccordion = (index: number) => {
    setOpenAccordions(prev => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
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

  if (!processData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex w-full flex-col pt-2">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {processData.status === "in_progress" && <Loader2Icon className="h-5 w-5 animate-spin text-blue-500" />}
            {processData.status === "completed" && <CheckIcon className="h-5 w-5 text-green-500" />}
            {processData.status === "failed" && <XIcon className="h-5 w-5 text-red-500" />}
            <span className="text-lg font-semibold">
              {processData.name} - {processData.status.charAt(0).toUpperCase() + processData.status.slice(1)}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Started: {formatLocalTime(processData.start_time)}
            {processData.end_time && ` | Ended: ${formatLocalTime(processData.end_time)}`}
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-md border">
            {processData.tasks.map((task, index) => (
              <div key={index}>
                <div className="flex cursor-pointer items-center justify-between p-4" onClick={() => toggleAccordion(index)}>
                  <div className="flex items-center">
                    {openAccordions[index] ? <ChevronDownIcon className="mr-2 h-5 w-5" /> : <ChevronRightIcon className="mr-2 h-5 w-5" />}
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
                    {task.status === "completed" && <CheckIcon className="h-4 w-4 text-green-500" />}
                    {task.status === "in_progress" && <Loader2Icon className="h-5 w-5 animate-spin text-blue-500" />}
                    {task.status === "not_started" && <div className="h-5 w-5 rounded-full border-2"></div>}
                    {task.status === "failed" && <XIcon className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                {openAccordions[index] && (
                  <div className="border-t p-4">
                    <p className="text-sm">{task.description}</p>
                    {task.start_time && <p className="text-xs text-gray-500">Started: {formatLocalTime(task.start_time)}</p>}
                    {task.end_time && <p className="text-xs text-gray-500">Ended: {formatLocalTime(task.end_time)}</p>}
                  </div>
                )}
                {index < processData.tasks.length - 1 && <div className="border-t"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
