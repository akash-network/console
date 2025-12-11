import { type Counter, type Histogram, type Meter, metrics, type UpDownCounter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

export interface MetricOptions {
  description?: string;
  unit?: string;
}

@singleton()
export class MetricsService {
  /**
   * Gets or creates a meter for a specific component
   * @param name - Component name (e.g., "wallet-balance-reload-check", "payment-service")
   * @param version - Version of the component (default: "1.0.0")
   * @returns OpenTelemetry Meter instance
   */
  getMeter(name: string, version: string = "1.0.0"): Meter {
    return metrics.getMeter(name, version);
  }

  /**
   * Creates a counter metric
   * @param meter - Meter instance from getMeter()
   * @param name - Metric name (should follow Prometheus naming conventions: lowercase with underscores)
   * @param options - Metric options
   * @returns Counter instance
   */
  createCounter(meter: Meter, name: string, options?: MetricOptions): Counter {
    return meter.createCounter(name, {
      description: options?.description,
      unit: options?.unit
    });
  }

  /**
   * Creates a histogram metric
   * @param meter - Meter instance from getMeter()
   * @param name - Metric name (should follow Prometheus naming conventions: lowercase with underscores)
   * @param options - Metric options
   * @returns Histogram instance
   */
  createHistogram(meter: Meter, name: string, options?: MetricOptions): Histogram {
    return meter.createHistogram(name, {
      description: options?.description,
      unit: options?.unit
    });
  }

  /**
   * Creates an up/down counter metric
   * @param meter - Meter instance from getMeter()
   * @param name - Metric name (should follow Prometheus naming conventions: lowercase with underscores)
   * @param options - Metric options
   * @returns UpDownCounter instance
   */
  createUpDownCounter(meter: Meter, name: string, options?: MetricOptions): UpDownCounter {
    return meter.createUpDownCounter(name, {
      description: options?.description,
      unit: options?.unit
    });
  }
}
