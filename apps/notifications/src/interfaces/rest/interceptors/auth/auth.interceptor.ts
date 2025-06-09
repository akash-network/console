import { defineAbility } from "@casl/ability";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { Err } from "ts-results";

const UNPROTECTED = "UNPROTECTED";
export const Unprotected = () => SetMetadata(UNPROTECTED, true);

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const isUnprotected = Reflect.getMetadata(UNPROTECTED, context.getClass()) || Reflect.getMetadata(UNPROTECTED, context.getHandler());

    if (isUnprotected) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.headers["x-user-id"];

    if (!userId) {
      return of(Err(new UnauthorizedException()));
    }

    request.ability = defineAbility(can => {
      can("manage", "NotificationChannel", { userId });
      can("manage", "Alert", { userId });
    });

    return next.handle();
  }
}
