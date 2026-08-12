/** Keeps multi-row inserts well under postgres.js's ~65k bind-parameter limit. */
export const INSERT_CHUNK_SIZE = 2_000;
