"use client";
import React, { useEffect, useState } from "react";
import { Separator, Spinner } from "@akashnetwork/ui/components";
import { ArrowDown, ArrowRight, Check, Xmark } from "iconoir-react";

import { useProviderActionStatus } from "@src/queries/useProviderQuery";
import { formatLocalTime, formatTimeLapse } from "@src/utils/dateUtils";

export const ProviderActionDetails: React.FC<{ actionId: string | null }> = ({ actionId }) => {
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([]);
  const { data: actionDetails, isLoading } = useProviderActionStatus(actionId);

  useEffect(() => {
    if (actionDetails) {
      setOpenAccordions(new Array(actionDetails.tasks.length).fill(false));
    }
  }, [actionDetails]);

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
                  onClick={() => toggleAccordion(index)}
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
