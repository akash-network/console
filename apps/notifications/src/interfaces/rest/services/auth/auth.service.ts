import type { MongoAbility } from "@casl/ability";
import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { DefaultChannelOwner } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { reachesUnattributedRows, readRequestIdentity, type RequestIdentity } from "./request-identity";

declare module "express" {
  export interface Request {
    ability?: MongoAbility;
  }
}

@Injectable({
  scope: Scope.REQUEST
})
export class AuthService {
  get userId(): string {
    return this.#identity.userId;
  }

  get organizationId(): string | null {
    return this.#identity.organizationId;
  }

  get projectId(): string | null {
    return this.#identity.projectId;
  }

  get reachesUnattributedRows(): boolean {
    return reachesUnattributedRows(this.#identity);
  }

  /** A team organization has one default whoever asks; a personal one keeps its owner's default, unattributed included. */
  get defaultChannelOwner(): DefaultChannelOwner {
    const identity = this.#identity;

    if (identity.organizationId && (identity.membership || !reachesUnattributedRows(identity))) {
      return { kind: "organization", organizationId: identity.organizationId };
    }

    return { kind: "user", userId: identity.userId, organizationId: identity.organizationId };
  }

  get ability(): MongoAbility {
    if (!this.request.ability) {
      this.loggerService.error("User is not authorized");
      throw new UnauthorizedException();
    }
    return this.request.ability;
  }

  get #identity(): RequestIdentity {
    const identity = readRequestIdentity(this.request.headers);

    if (!identity) {
      this.loggerService.error("User is not authorized");
      throw new UnauthorizedException();
    }

    return identity;
  }

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(AuthService.name);
  }
}
