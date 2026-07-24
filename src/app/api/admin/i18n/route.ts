import { NextRequest } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { parseCsv, toCsv } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const format = req.nextUrl.searchParams.get("format");
  const rows = await prisma.translation.findMany({ orderBy: [{ groupName: "asc" }, { key: "asc" }] });

  if (format === "csv") {
    const csv = toCsv(rows.map((r) => ({ key: r.key, zh: r.zh, vi: r.vi, groupName: r.groupName })));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ynhll-i18n.csv"',
      },
    });
  }

  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const contentType = req.headers.get("content-type") || "";
  let items: Array<{ key: string; zh: string; vi: string; groupName: string }> = [];

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const text = await req.text();
    try {
      items = parseCsv(text);
    } catch (e) {
      return jsonFail((e as Error).message);
    }
  } else {
    const body = await req.json();
    if (Array.isArray(body.items)) {
      items = body.items;
    } else if (typeof body.csv === "string") {
      try {
        items = parseCsv(body.csv);
      } catch (e) {
        return jsonFail((e as Error).message);
      }
    } else if (body.key) {
      items = [
        {
          key: String(body.key),
          zh: String(body.zh || ""),
          vi: String(body.vi || ""),
          groupName: String(body.groupName || "common"),
        },
      ];
    }
  }

  if (!items.length) return jsonFail("没有可导入的翻译行");

  let count = 0;
  for (const item of items) {
    if (!item.key) continue;
    await prisma.translation.upsert({
      where: { key: item.key },
      create: {
        key: item.key,
        zh: item.zh || "",
        vi: item.vi || "",
        groupName: item.groupName || "common",
      },
      update: {
        zh: item.zh || "",
        vi: item.vi || "",
        groupName: item.groupName || "common",
      },
    });
    count++;
  }

  return jsonOk({ imported: count });
}
