import { scoreBand, SCORE_BAND_STYLE } from "@/lib/score";
import { cn } from "@/lib/utils";

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const st = SCORE_BAND_STYLE[scoreBand(score)];
  return <span className={cn("inline-flex min-w-9 justify-center rounded border px-1 text-xs font-semibold tabular-nums", st.chip, className)}>{score.toFixed(1)}</span>;
}

export function ScoreLegend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>スコア:</span>
      {(Object.keys(SCORE_BAND_STYLE) as (keyof typeof SCORE_BAND_STYLE)[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={cn("size-2.5 rounded-full", SCORE_BAND_STYLE[k].dot)} />
          {SCORE_BAND_STYLE[k].label}
        </span>
      ))}
    </div>
  );
}
