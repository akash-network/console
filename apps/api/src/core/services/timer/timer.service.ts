import { singleton } from "tsyringe";

@singleton()
export class TimerService {
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
