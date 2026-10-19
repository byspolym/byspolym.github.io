import { cn } from "@/lib/utils";

export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <img
      src="/crest-official.jpg"
      alt="Bayelsa State Polytechnic crest"
      width={size}
      height={size}
      className={cn("bg-white object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={compact ? 28 : 36} />
      <div className="leading-tight">
        <div className="font-display text-[1.05rem] font-semibold tracking-tight">
          Byspolyhub
        </div>
        {!compact && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
            Bayelsa State Polytechnic
          </div>
        )}
      </div>
    </div>
  );
}
