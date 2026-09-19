import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export const PLAYER_COOKIE = "khc_player_id";

export async function readPlayerIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PLAYER_COOKIE)?.value ?? null;
}

export async function setPlayerIdCookie(playerId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, playerId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function newPlayerId(): string {
  return uuidv4();
}
