import { getSession } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { listSuggestions } from "@/lib/market";

export async function GET() {
  const user = await getSession();
  if (!user) return jsonFail("未登录", 401);
  const rows = await listSuggestions(user.id);
  return jsonOk(rows);
}
