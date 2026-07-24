import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTranslationsMap, Locale } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get("locale") as Locale | null;
  const session = await getSession();
  const locale: Locale = localeParam || (session?.locale as Locale) || "zh";
  const dict = await getTranslationsMap(locale);
  return NextResponse.json(
    { ok: true, data: { locale, dict } },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
