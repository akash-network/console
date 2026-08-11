/**
 * A runner was asked to stop (SIGTERM / container disposal) before finishing its work. The process
 * must exit non-zero so a K8s Job resumes from its checkpoint on the next attempt instead of being
 * marked Complete with the range still unfinished.
 */
export class RunnerInterruptedError extends Error {}
