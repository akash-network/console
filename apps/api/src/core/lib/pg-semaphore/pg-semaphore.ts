import { Sema } from "async-sema";
import type { Sql, TransactionSql } from "postgres";

export interface Semaphore {
  withLock<T>(fn: (tx?: TransactionSql) => Promise<T>): Promise<T>;
  /**
   * Returns the number of callers currently in flight (waiting or executing).
   * In-flight = callers that have entered withLock() but not yet returned.
   */
  nrInFlight(): number;
}

/**
 * Converts a string key to a 32-bit integer for use with PostgreSQL advisory locks.
 * Uses a simple hash function (djb2) to convert arbitrary strings to integers.
 */
function hashStringToInt(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * A distributed semaphore implementation using PostgreSQL advisory locks.
 *
 * Uses transaction-level locks (`pg_advisory_xact_lock`) which are automatically
 * released when the transaction ends, making it safe for connection pooling and
 * crash recovery.
 */
export class PgSemaphore implements Semaphore {
  private static defaultSql: Sql | null = null;

  private readonly lockKey: number;

  private readonly sql: Sql;

  private inFlightCount = 0;

  /**
   * Configures the default SQL instance for all PgSemaphore instances.
   * Call this once at application startup.
   *
   * @param sql - A postgres.js SQL instance.
   */
  static configure(sql: Sql): void {
    PgSemaphore.defaultSql = sql;
  }

  /**
   * Returns the default SQL instance.
   *
   * @throws Error if not configured.
   */
  static getDefaultSql(): Sql {
    if (!PgSemaphore.defaultSql) {
      throw new Error("PgSemaphore not configured. Call PgSemaphore.configure(sql) first.");
    }
    return PgSemaphore.defaultSql;
  }

  /**
   * Creates a new PgSemaphore instance.
   *
   * @param key - A unique string key identifying this semaphore.
   * @param sql - Optional postgres.js SQL instance. If not provided, uses the default from configure().
   */
  constructor(key: string, sql?: Sql) {
    this.lockKey = hashStringToInt(key);
    this.sql = sql ?? PgSemaphore.getDefaultSql();
  }

  /**
   * Executes a function while holding the advisory lock.
   *
   * This method uses transaction-level locks that are automatically released
   * when the transaction ends, making it safe for use with connection pooling.
   *
   * @param fn - The function to execute while holding the lock.
   * @returns The result of the function.
   */
  async withLock<T>(fn: (tx?: TransactionSql) => Promise<T>): Promise<T> {
    this.inFlightCount++;
    try {
      return (await this.sql.begin(async tx => {
        await tx`SELECT pg_advisory_xact_lock(${this.lockKey})`;
        return await fn(tx);
      })) as T;
    } finally {
      this.inFlightCount--;
    }
  }

  /**
   * Returns the number of callers currently in flight (waiting or executing).
   * In-flight = callers that have entered withLock() but not yet returned.
   *
   * Note: This only tracks local callers in this process instance.
   * For distributed count, query `pg_locks` system view.
   */
  nrInFlight(): number {
    return this.inFlightCount;
  }
}

/**
 * An in-memory semaphore implementation using async-sema.
 * Intended for unit tests only.
 *
 * Uses a static cache to ensure all instances with the same key share the same Sema,
 * providing proper serialization within a single process.
 */
export class MemorySemaphore implements Semaphore {
  private static semaMap = new Map<number, Sema>();

  private static inFlightMap = new Map<number, number>();

  private readonly lockKey: number;

  private readonly sema: Sema;

  /**
   * Creates a new MemorySemaphore instance.
   *
   * @param key - A unique string key identifying this semaphore.
   */
  constructor(key: string) {
    this.lockKey = hashStringToInt(key);
    this.sema = MemorySemaphore.getOrCreateSema(this.lockKey);
  }

  private static getOrCreateSema(lockKey: number): Sema {
    let sema = MemorySemaphore.semaMap.get(lockKey);
    if (!sema) {
      sema = new Sema(1);
      MemorySemaphore.semaMap.set(lockKey, sema);
    }
    return sema;
  }

  /**
   * Executes a function while holding the lock.
   *
   * @param fn - The function to execute while holding the lock.
   * @returns The result of the function.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    MemorySemaphore.inFlightMap.set(this.lockKey, (MemorySemaphore.inFlightMap.get(this.lockKey) ?? 0) + 1);
    try {
      await this.sema.acquire();
      try {
        return await fn();
      } finally {
        this.sema.release();
      }
    } finally {
      MemorySemaphore.inFlightMap.set(this.lockKey, (MemorySemaphore.inFlightMap.get(this.lockKey) ?? 1) - 1);
    }
  }

  /**
   * Returns the number of callers currently in flight (waiting or executing).
   * In-flight = callers that have entered withLock() but not yet returned.
   */
  nrInFlight(): number {
    return MemorySemaphore.inFlightMap.get(this.lockKey) ?? 0;
  }
}

type SemaphoreClass = new (key: string) => Semaphore;

/**
 * Factory for creating semaphore instances.
 * Allows switching between PgSemaphore (production) and MemorySemaphore (tests).
 */
export class SemaphoreFactory {
  private static semaphoreClass: SemaphoreClass = PgSemaphore;

  /**
   * Configures the factory to use PgSemaphore with the given SQL instance.
   */
  static configure(sql: Sql): void {
    PgSemaphore.configure(sql);
    SemaphoreFactory.semaphoreClass = PgSemaphore;
  }

  /**
   * Configures the factory to use MemorySemaphore (for unit tests).
   */
  static useMemory(): void {
    SemaphoreFactory.semaphoreClass = MemorySemaphore;
  }

  /**
   * Creates a new semaphore instance using the configured implementation.
   */
  static create(key: string): Semaphore {
    return new SemaphoreFactory.semaphoreClass(key);
  }
}
