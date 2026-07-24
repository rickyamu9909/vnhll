import { getSession } from "@/lib/auth";
import { jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  return jsonOk(user);
}
