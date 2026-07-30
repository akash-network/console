/**
 * Animated Akash mark shown while the app boots (the initial-load gates).
 *
 * The three shards of the official mark pulse from dim to lit in a staggered chase, so the light appears to
 * travel around the mark. Delays follow the mark's visual order (bottom shard leads); the pulse keyframes live
 * in the app tailwind config (`akash-loading-shard`), while theme-token fills and `motion-reduce` classes keep
 * it following light/dark and honouring reduced motion.
 */
const SHARDS = [
  { d: "M321.355 279.4L400.615 419.038H240.511L160.415 279.4Z", delayMs: 600 },
  { d: "M400.572 419.061L480.536 279.423L320.476 0.0800781H160.415L400.572 419.061Z", delayMs: 300 },
  { d: "M80.3874 139.682H240.449L80.454 419.025L0.357422 279.387L80.3874 139.682Z", delayMs: 0 }
];

const MARK_ASPECT_RATIO = 420 / 481;

export const AkashLoadingMark = ({ width = 96 }: { width?: number }) => {
  return (
    <svg width={width} height={Math.round(width * MARK_ASPECT_RATIO)} viewBox="0 0 481 420" fill="none" role="status" aria-label="Loading">
      {SHARDS.map(shard => (
        <path
          key={shard.d}
          d={shard.d}
          className="animate-akash-loading-shard fill-border motion-reduce:animate-none motion-reduce:fill-foreground"
          style={{ animationDelay: `${shard.delayMs}ms` }}
        />
      ))}
    </svg>
  );
};
