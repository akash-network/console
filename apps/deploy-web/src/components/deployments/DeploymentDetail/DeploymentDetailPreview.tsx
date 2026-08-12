"use client";
import type { FC } from "react";

import { useFlag } from "@src/hooks/useFlag";
import Layout from "../../layout/Layout";
import { Title } from "../../shared/Title";
import { DeploymentDetail } from "./DeploymentDetail";

export const DEPENDENCIES = {
  useFlag,
  Layout,
  DeploymentDetail
};

export interface DeploymentDetailPreviewProps {
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Development-only mirror of the canonical deployment detail page on a parallel route, so the redesign
 * can be e2e-tested and demoed while the canonical route keeps serving the legacy page. It renders the very
 * same {@link DeploymentDetail} the canonical route does; only the gating flag differs. Removed as a whole
 * (route file + this file) once the redesign is rolled out — no other file changes.
 */
export const DeploymentDetailPreview: FC<DeploymentDetailPreviewProps> = ({ dseq, dependencies: d = DEPENDENCIES }) => {
  const isPreviewEnabled = d.useFlag("deployment_detail_preview");

  if (!isPreviewEnabled) {
    return (
      <d.Layout>
        <div className="mt-8 text-center">
          <Title className="mb-2">404</Title>
          <p>This page is not available.</p>
        </div>
      </d.Layout>
    );
  }

  return <d.DeploymentDetail dseq={dseq} />;
};
