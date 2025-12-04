"use client";
import React from "react";
import { Cpu, Database, Flash, Server } from "iconoir-react";

import { roundDecimal } from "@src/utils/mathHelpers";
import type { bytesToShrink } from "@src/utils/unitUtils";
import { ResourceCard } from "./ResourceCard";

type Props = {
  totalCpu: number;
  totalGpu?: number;
  memory: ReturnType<typeof bytesToShrink>;
  storage: ReturnType<typeof bytesToShrink>;
};

export const ResourceStatsGrid: React.FC<Props> = ({ totalCpu, totalGpu, memory, storage }) => {
  return (
    <div>
      <h3 className="mb-4 text-sm font-medium">Total resources leased</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ResourceCard icon={<Cpu className="h-6 w-6" />} value={totalCpu} label="CPUs" />

        <ResourceCard icon={<Flash className="h-6 w-6" />} value={totalGpu || 0} label="GPUs" />

        <ResourceCard icon={<Server className="h-6 w-6" />} value={`${roundDecimal(memory.value, 0)} ${memory.unit}`} label="Memory" />

        <ResourceCard icon={<Database className="h-6 w-6" />} value={`${roundDecimal(storage.value, 2)} ${storage.unit}`} label="Storage" />
      </div>
    </div>
  );
};
