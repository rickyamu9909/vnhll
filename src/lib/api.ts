import { NextResponse } from "next/server";

function jsonBody(payload: unknown) {
  return JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return new NextResponse(jsonBody({ ok: true, data }), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

export function jsonFail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
