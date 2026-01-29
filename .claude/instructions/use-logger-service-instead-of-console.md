## Use `LoggerService` instead of `console.log/warn/error`

## Description
- Never use `console.log`, `console.warn`, `console.error`, or `console.info` in application code
- Always inject and use `LoggerService` from `@src/core` (or `@src/core/providers/logging.provider`)
- Log messages should use structured objects with an `event` field for easy filtering

## Examples

### Good
```typescript
import { LoggerService } from "@src/core";

@singleton()
export class MyService {
  constructor(private readonly logger: LoggerService) {}

  async doSomething() {
    try {
      // ...
    } catch (error) {
      this.logger.error({ event: "OPERATION_FAILED", error });
    }
  }
}
```

### Bad
```typescript
@singleton()
export class MyService {
  async doSomething() {
    try {
      // ...
    } catch (e) {
      console.error("Something failed", e);
    }
  }
}
```
