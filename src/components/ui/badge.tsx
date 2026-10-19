import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, string> = {
    admin: "bg-accent text-accent-foreground",
    staff: "bg-navy text-navy-foreground",
    alumni: "bg-ochre text-ochre-foreground",
    student: "bg-secondary text-secondary-foreground",
  };
  return <Pill className={map[role]}>{role}</Pill>;
}

export function OfficialBadge() {
  return <Pill className="bg-accent text-accent-foreground">Official</Pill>;
}
