import type { Provider } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

export const MockProvider = <T>(
  Constructor: new (...args: any[]) => T,
): Provider => {
  return { provide: Constructor, useValue: mock<T>() };
};
