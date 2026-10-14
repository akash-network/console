import type { CustomDecorator } from "@nestjs/common";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { Err } from "ts-results";

import { abilityFor } from "@src/interfaces/rest/services/auth/request-ability";
import { readRequestIdentity } from "@src/interfaces/rest/services/auth/request-identity";

const UNPROTECTED = "UNPROTECTED";
export const Unprotected = (): CustomDecorator<typeof UNPROTECTED> => SetMetadata(UNPROTECTED, true);

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const isUnprotected = Reflect.getMetadata(UNPROTECTED, context.getClass()) || Reflect.getMetadata(UNPROTECTED, context.getHandler());

    if (isUnprotected) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const identity = readRequestIdentity(request.headers);

    if (!identity) {
      return of(Err(new UnauthorizedException()));
    }

    request.ability = abilityFor(identity);

    return next.handle();
  }
}
