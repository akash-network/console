import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";
import { Err, Ok } from "ts-results";

@Injectable()
export class HttpResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      map(result => {
        if (result instanceof Err) {
          throw result.val;
        }

        if (result instanceof Ok) {
          return result.val;
        }

        return result;
      })
    );
  }
}
