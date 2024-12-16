import { Sema } from "async-sema";

export const Semaphore = () => (target: object, propertyName: string, descriptor: PropertyDescriptor) => {
  const semaphores = new Map<string, Sema>();

  const originalMethod = descriptor.value;

  const getSemaphore = (key: string): Sema => {
    let semaphore = semaphores.get(key);
    if (!semaphore) {
      semaphore = new Sema(1);
      semaphores.set(key, semaphore);
    }
    return semaphore;
  };

  descriptor.value = async function semaphoredFunction(...args: unknown[]) {
    const key = JSON.stringify(args);
    const semaphore = getSemaphore(key);
    await semaphore.acquire();
    try {
      return await originalMethod.apply(this, args);
    } finally {
      semaphore.release();
      semaphores.delete(key);
    }
  };
};
