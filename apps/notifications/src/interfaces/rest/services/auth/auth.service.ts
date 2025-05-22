import type { MongoAbility } from "@casl/ability";
import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";

import { LoggerService } from "@src/common/services/logger/logger.service";

declare module "express" {
  export interface Request {
    ability?: MongoAbility;
  }
}

@Injectable({
  scope: Scope.REQUEST
})
export class AuthService {
  get userId() {
    if (!this.request.headers["x-user-id"]) {
      this.loggerService.error("User is not authorized");
      throw new UnauthorizedException();
    }
    return this.request.headers["x-user-id"];
  }

  get ability() {
    if (!this.request.ability) {
      this.loggerService.error("User is not authorized");
      throw new UnauthorizedException();
    }
    return this.request.ability;
  }

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(AuthService.name);
  }
}
