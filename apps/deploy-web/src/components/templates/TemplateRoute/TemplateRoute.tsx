"use client";
import type { FC } from "react";
import type { DehydratedState } from "@tanstack/react-query";

import { TemplatePage } from "@src/components/templates/TemplatePage/TemplatePage";
import { UserTemplate } from "@src/components/templates/UserTemplate";
import type { VisitorPageProps } from "@src/lib/pages/visitorAccess/visitorAccess";
import type { ITemplate } from "@src/types";

export const DEPENDENCIES = {
  TemplatePage,
  UserTemplate
};

export interface ServerRemovedTemplate {
  title: string | null;
}

export type TemplateRouteProps =
  | ({ id: string; isMarketplace: true; removedTemplate?: ServerRemovedTemplate; dehydratedState?: DehydratedState } & VisitorPageProps)
  | { id: string; template: ITemplate; isMarketplace?: never };

export const TemplateRoute: FC<TemplateRouteProps & { dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES, ...props }) =>
  props.isMarketplace ? (
    <d.TemplatePage key={props.id} id={props.id} removedTemplate={props.removedTemplate} />
  ) : (
    <d.UserTemplate id={props.id} template={props.template} />
  );
