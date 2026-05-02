import { fitColor } from "@/lib/utils";

export function FitBadge({ score }: { score: number }) {
  const color = fitColor(score);
  const filled = Math.ceil(score / 20);
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-sm font-bold" style={{ color }}>
        {score}%
      </div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: i <= filled ? color : "#e5e7eb" }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">fit</span>
    </div>
  );
}
