import { UserMenu } from "./user-menu";

export function GradientHeader({
  title,
  subtitle,
  email,
  children,
}: {
  title: string;
  subtitle?: string;
  email: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-gm-gradient px-4 pt-6 pb-6 text-white">
      <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
            <span className="text-base">🌈</span>
            <span>GrantMatch AI</span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-md text-sm text-white/80">{subtitle}</p>
          )}
        </div>
        <UserMenu email={email} />
      </div>
      {children && (
        <div className="mx-auto mt-4 max-w-3xl">{children}</div>
      )}
    </div>
  );
}
