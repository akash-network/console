import type { Semaphore } from "./pg-semaphore";
import { createSemaphoreDecorator } from "./semaphore.decorator";

describe("Semaphore decorator", () => {
  it("calls original method and returns result", async () => {
    const { instance } = setup();

    const result = await instance.process("arg1");

    expect(result).toBe("processed:arg1");
  });

  it("creates semaphore with key including class name, method name and args", async () => {
    const { instance, MockPgSemaphore } = setup();

    await instance.process("test-arg");

    expect(MockPgSemaphore).toHaveBeenCalledWith('TestClass.process:["test-arg"]');
  });

  it("uses withLock to execute the method", async () => {
    const { instance, mockWithLock } = setup();

    await instance.process("arg");

    expect(mockWithLock).toHaveBeenCalled();
  });

  it("creates new semaphore for each call", async () => {
    const { instance, MockPgSemaphore } = setup();

    await instance.process("same-arg");
    await instance.process("same-arg");

    expect(MockPgSemaphore).toHaveBeenCalledTimes(2);
  });

  it("creates semaphore with different keys for different arguments", async () => {
    const { instance, MockPgSemaphore } = setup();

    await instance.process("arg1");
    await instance.process("arg2");

    expect(MockPgSemaphore).toHaveBeenCalledTimes(2);
    expect(MockPgSemaphore).toHaveBeenCalledWith('TestClass.process:["arg1"]');
    expect(MockPgSemaphore).toHaveBeenCalledWith('TestClass.process:["arg2"]');
  });

  it("handles multiple arguments in key", async () => {
    const { instance, MockPgSemaphore } = setup();

    await instance.multiArg("a", 123, true);

    expect(MockPgSemaphore).toHaveBeenCalledWith('TestClass.multiArg:["a",123,true]');
  });

  it("propagates errors from original method", async () => {
    const { instance } = setup();

    await expect(instance.throwing()).rejects.toThrow("test error");
  });

  it("preserves this context", async () => {
    const { instance } = setup();

    const result = await instance.useThis("value");

    expect(result).toBe("prefix:value");
  });

  function setup() {
    const mockWithLock = jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn());
    const MockPgSemaphore = jest.fn().mockImplementation((key: string) => ({
      key,
      withLock: mockWithLock
    }));
    const SemaphoreDecorator = createSemaphoreDecorator(key => MockPgSemaphore(key) as Semaphore);

    class TestClass {
      prefix = "prefix";

      @SemaphoreDecorator()
      async process(arg: string): Promise<string> {
        return `processed:${arg}`;
      }

      @SemaphoreDecorator()
      async multiArg(a: string, b: number, c: boolean): Promise<string> {
        return `${a}-${b}-${c}`;
      }

      @SemaphoreDecorator()
      async throwing(): Promise<void> {
        throw new Error("test error");
      }

      @SemaphoreDecorator()
      async useThis(value: string): Promise<string> {
        return `${this.prefix}:${value}`;
      }
    }

    const instance = new TestClass();

    return { instance, TestClass, MockPgSemaphore, mockWithLock };
  }
});
