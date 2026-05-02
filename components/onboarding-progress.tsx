export function OnboardingProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gm-purple600" : "bg-muted"}`}
        />
      ))}
      <span className="ml-2 font-medium text-foreground">Step {step} of 3</span>
    </div>
  );
}
