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

  return { title: findGraphMetric("graph", snapshot)?.title ?? "Graph not found" };
}

export default async function GraphRoute({ params }: IGraphProps) {
  const { snapshot } = await params;

  if (!findGraphMetric("graph", snapshot)) {
    notFound();
  }

  return (
    <PageContainer>
      <GraphPage kind="graph" urlParam={snapshot} />
    </PageContainer>
  );
}
