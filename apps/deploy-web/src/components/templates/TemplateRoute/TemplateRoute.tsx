"use client";
import type { FC } from "react";

import { TemplatePage } from "@src/components/templates/TemplatePage/TemplatePage";
import { UserTemplate } from "@src/components/templates/UserTemplate";
import type { ITemplate } from "@src/types";

export const DEPENDENCIES = {
  TemplatePage,
  UserTemplate
};

export type TemplateRouteProps = { id: string; isMarketplace: true } | { id: string; template: ITemplate; isMarketplace?: never };

export const TemplateRoute: FC<TemplateRouteProps & { dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES, ...props }) =>
  props.isMarketplace ? <d.TemplatePage key={props.id} id={props.id} /> : <d.UserTemplate id={props.id} template={props.template} />;
