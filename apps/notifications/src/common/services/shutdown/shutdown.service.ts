import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class ShutdownService {
  private sub: Subject<void> = new Subject();

  onShutdown(shutdownFn: () => void): void {
    this.sub.subscribe(() => shutdownFn());
  }

  shutdown() {
    this.sub.next();
  }
}
