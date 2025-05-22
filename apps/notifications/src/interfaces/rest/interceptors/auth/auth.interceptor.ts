import { defineAbility } from "@casl/ability";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { Err } from "ts-results";

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers["x-user-id"];

    if (!userId) {
      return of(Err(new UnauthorizedException()));
    }

    request.ability = defineAbility(can => {
      can("manage", "ContactPoint", { userId });
      can("manage", "Alert", { userId });
    });

    return next.handle();
  }
}
