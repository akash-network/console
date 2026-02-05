import type { Semaphore as SemaphoreImpl } from "./pg-semaphore";
import { SemaphoreFactory } from "./pg-semaphore";

type SemaphoreCreator = (key: string) => SemaphoreImpl;

export const createSemaphoreDecorator = (createSemaphore: SemaphoreCreator) => () => (target: object, propertyName: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  const keyPrefix = `${target.constructor.name}.${propertyName}`;

  descriptor.value = async function semaphoredFunction(...args: unknown[]) {
    const key = `${keyPrefix}:${JSON.stringify(args)}`;
    const semaphore = createSemaphore(key);
    return semaphore.withLock(() => originalMethod.apply(this, args));
  };
};

export const Semaphore = createSemaphoreDecorator(key => SemaphoreFactory.create(key));
