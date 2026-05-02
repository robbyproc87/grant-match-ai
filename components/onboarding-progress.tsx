export function OnboardingProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-white/80">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-white" : "bg-white/30"}`}
        />
      ))}
      <span className="ml-2 font-medium">Step {step} of 3</span>
    </div>
  );
}
