import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_CLIENTE } from "@/lib/sessao-cliente";

export const dynamic = "force-dynamic";

export async function POST() {
  cookies().delete(COOKIE_CLIENTE);
  return NextResponse.json({ ok: true });
}
