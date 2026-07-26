import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, makeSessionToken, safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TRINTA_DIAS = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as {
    password?: string;
  };

  const senhaCerta = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // Sem senha/segredo configurados no servidor, ninguém entra (falha segura).
  if (
    !senhaCerta ||
    !secret ||
    typeof password !== "string" ||
    !safeEqual(password, senhaCerta)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await makeSessionToken(secret);
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TRINTA_DIAS,
  });

  return NextResponse.json({ ok: true });
}
