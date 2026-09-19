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
  size?: "xs" | "sm" | "md" | "lg";
  /** When true, render as non-interactive figure (rivers). */
  faceOnly?: boolean;
};

const SIZE = {
  xs: { w: 28, h: 38 },
  sm: { w: 36, h: 48 },
  md: { w: 48, h: 64 },
  lg: { w: 56, h: 76 },
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
}: Props) {
  const { w, h } = SIZE[size];
  const className = [
    "relative shrink-0 rounded-md transition-transform touch-manipulation",
    !faceOnly && onClick ? "active:scale-95" : "",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
    selected ? "-translate-y-3 ring-2 ring-sky-400 shadow-lg" : "",
    recommended ? "ring-2 ring-emerald-400 -translate-y-2" : "",
    highlighted ? "ring-2 ring-amber-400" : "",
    dimmed ? "opacity-40" : "",
    onClick && !faceOnly ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
  ].join(" ");

  const img = (
    <Image
      src={TILE_IMAGE[tile]}
      alt={TILE_NAME_JA[tile]}
      width={w}
      height={h}
      className="rounded-sm shadow-sm"
      draggable={false}
      priority={size !== "xs"}
    />
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
