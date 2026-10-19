import { Link } from "@tanstack/react-router";
import type { Profile } from "@/lib/types";
import { avatarHue, cn, initials } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

export function UserAvatar({
  profile,
  size = 40,
  to,
  showOnline,
  online,
}: {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url" | "is_verified">;
  size?: number;
  to?: string;
  showOnline?: boolean;
  online?: boolean;
}) {
  const inner = (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.full_name}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full text-xs font-semibold",
            avatarHue(profile.id + profile.full_name),
          )}
        >
          {initials(profile.full_name)}
        </span>
      )}
      {profile.is_verified && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-forest text-forest-foreground ring-2 ring-background">
          <BadgeCheck className="size-3" />
        </span>
      )}
      {showOnline && (
        <span
          className={cn(
            "absolute bottom-0 left-0 size-2.5 rounded-full ring-2 ring-background",
            online ? "bg-forest" : "bg-muted-foreground/50",
          )}
        />
      )}
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="inline-flex">
        {inner}
      </Link>
    );
  }
  return inner;
}
