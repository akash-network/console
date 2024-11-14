declare module "pino-fluentd" {
  import { Writable } from "stream";

  interface PinoFluentdOptions {
    tag: string;
    host: string;
    port: number;
    "trace-level": string;
  }

  export default function pinoFluentd(options: PinoFluentdOptions): Writable;
}
