import { NextResponse } from "next/server";
import { geocodificar, type EnderecoInput } from "@/lib/geocode";

export const dynamic = "force-dynamic";

// Público: usado durante o cadastro do cliente para obter lat/lng do endereço.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as EnderecoInput;
  const coords = await geocodificar(body);
  return NextResponse.json(coords ?? { lat: null, lng: null });
}
