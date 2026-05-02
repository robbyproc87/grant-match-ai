import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-in flex flex-col items-center justify-center gap-3 p-10 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
