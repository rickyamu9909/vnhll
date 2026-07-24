import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getTranslationsMap, Locale } from "@/lib/i18n";
import { jsonOk } from "@/lib/api";

export async function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get("locale") as Locale | null;
  const session = await getSession();
  const locale: Locale = localeParam || (session?.locale as Locale) || "zh";
  const dict = await getTranslationsMap(locale);
  return jsonOk({ locale, dict });
}
