import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.operationLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return jsonOk(rows);
}
