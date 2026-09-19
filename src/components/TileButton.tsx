"use client";

import Image from "next/image";
import { TILE_IMAGE, TILE_NAME_JA, type TileId } from "@/lib/tiles";

type Props = {
  tile: TileId;
  selected?: boolean;
  recommended?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  size?: "xs" | "sm" | "md" | "lg" | "hand";
  /** When true, render as non-interactive figure (rivers). */
  faceOnly?: boolean;
  /** Soft yellow glow for table selection (matches riichi UI). */
  glow?: boolean;
  /** Optional wrapper class (e.g. scale on narrow phones). */
  className?: string;
};

const SIZE = {
  xs: { w: 22, h: 30 },
  sm: { w: 32, h: 44 },
  md: { w: 48, h: 64 },
  lg: { w: 56, h: 76 },
  hand: { w: 44, h: 60 },
};

export function TileButton({
  tile,
  selected,
  recommended,
  dimmed,
  highlighted,
  onClick,
  size = "md",
  faceOnly,
  glow,
  className: extraClass = "",
}: Props) {
  const { w, h } = SIZE[size];
  const showGlow = glow || selected;
  const className = [
    "relative shrink-0 rounded-md transition-transform touch-manipulation",
    !faceOnly && onClick ? "active:scale-95" : "",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
    showGlow
      ? "-translate-y-1.5 ring-2 ring-amber-300/90"
      : "",
    recommended && !showGlow ? "ring-2 ring-emerald-500 -translate-y-1" : "",
    highlighted && !showGlow ? "ring-2 ring-amber-400" : "",
    dimmed ? "opacity-40" : "",
    onClick && !faceOnly ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
    extraClass,
  ].join(" ");

  // Suit PNGs are transparent; white face makes tiles readable on felt.
  const img = (
    <span
      className="relative block overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-stone-300/80"
      style={{ width: w, height: h }}
    >
      <Image
        src={TILE_IMAGE[tile]}
        alt={TILE_NAME_JA[tile]}
        width={w}
        height={h}
        className="h-full w-full object-contain"
        draggable={false}
        priority={size !== "xs"}
      />
    </span>
  );

  if (faceOnly || !onClick) {
    return (
      <span className={className} aria-label={TILE_NAME_JA[tile]}>
        {img}
        {recommended && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white whitespace-nowrap">
            推奨
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={TILE_NAME_JA[tile]}
      className={className}
    >
      {img}
      {recommended && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white whitespace-nowrap">
          推奨
        </span>
      )}
    </button>
  );
}
