import React from "react";
import { Card, CardContent } from "@akashnetwork/ui/components";

export const DashboardCardSkeleton: React.FC = () => (
  <Card>
    <CardContent className="rounded-lg p-6 shadow-md">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
          <div className="mt-2 h-8 w-32 animate-pulse rounded bg-gray-200"></div>
          <div className="mt-1 h-4 w-16 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <div className="h-24 w-full animate-pulse rounded bg-gray-200"></div>
        </div>
      </div>
    </CardContent>
  </Card>
);
