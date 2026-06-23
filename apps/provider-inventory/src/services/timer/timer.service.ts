import { setImmediate as immediate, setTimeout as delay } from "node:timers/promises";
import { singleton } from "tsyringe";

@singleton()
export class TimerService {
  delay = delay;
  delayCb = setTimeout;
  immediate = immediate;
}
