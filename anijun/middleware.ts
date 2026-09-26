import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const STAGING_HOST = "anijun.vercel.app";
const MAIN_HOST = "www.anijun.org";
const RU_COUNTRIES = new Set(["ru", "russia"]);

function detectCountry(request: NextRequest): string {
  const headers = request.headers;
  return (
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    headers.get("x-geo-country") ||
    ""
  ).toLowerCase();
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();

  if (host === STAGING_HOST) {
    const country = detectCountry(request);
    if (country && !RU_COUNTRIES.has(country)) {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      url.hostname = MAIN_HOST;
      url.port = "";
      return NextResponse.redirect(url, 307);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
