import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GraphPage } from "@/components/graph/GraphPage";
import { PageContainer } from "@/components/PageContainer";
import { findGraphMetric } from "@/lib/graphMetrics/graphMetrics";

interface IGraphProps {
  params: Promise<{ snapshot: string }>;
}

export async function generateMetadata({ params }: IGraphProps): Promise<Metadata> {
  const { snapshot } = await params;

  return { title: findGraphMetric("bme-graph", snapshot)?.title ?? "Graph not found" };
}

export default async function BmeGraphRoute({ params }: IGraphProps) {
  const { snapshot } = await params;

  if (!findGraphMetric("bme-graph", snapshot)) {
    notFound();
  }

  return (
    <PageContainer>
      <GraphPage kind="bme-graph" urlParam={snapshot} />
    </PageContainer>
  );
}
