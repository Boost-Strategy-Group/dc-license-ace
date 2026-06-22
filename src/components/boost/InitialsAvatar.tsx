type Props = { name: string; src?: string | null; size?: number };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function InitialsAvatar({ name, src, size = 40 }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-md bg-muted text-foreground/80 font-semibold grid place-items-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-label={`${name} logo`}
    >
      {initials(name)}
    </div>
  );
}
