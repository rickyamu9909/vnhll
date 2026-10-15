import { NextRequest } from "next/server";
import { MatchPath } from "@prisma/client";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney, toBigIntMoney } from "@/lib/money";
import { acceptPathA, advanceOrder, assignSub, placeBid, setDriverStage, sweepDeadlines } from "@/lib/market";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  await sweepDeadlines();
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      cargoItems: true,
      carrierBids: user!.role === "CARRIER_SUB" ? { where: { bidderUserId: user!.id } } : { include: { bidder: { select: { username: true, displayName: true, parentUserId: true } } } },
      customer: { select: { displayName: true, company: true } },
    },
  });
  if (!order) return jsonFail("订单不存在", 404);
  const view = serializeMoney(order as unknown as Record<string, unknown>);
  const mine = order.carrierBids.find((bid) => bid.bidderUserId === user!.id);
  view.myBidPriceVnd = mine ? mine.priceVnd.toString() : null;
  view.carrierBids = order.carrierBids.map((b) => ({ ...b, priceVnd: b.priceVnd.toString() }));
  if (user!.role === "CARRIER_SUB") {
    delete view.platformFeeVnd;
    delete view.driverIncomeVnd;
    delete view.commissionBps;
    if (order.matchPath === MatchPath.A) {
      delete view.targetPriceVnd;
      delete view.customerBidVnd;
      delete view.dealPriceVnd;
    }
  }
  return jsonOk(view);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const action = String(body.action || "");
  try {
    if (action === "accept") return jsonOk(await acceptPathA(params.id, user!.id));
    if (action === "bid") return jsonOk(await placeBid(params.id, user!.id, toBigIntMoney(body.priceVnd)));
    if (action === "assign") return jsonOk(await assignSub(params.id, user!.id, String(body.subUserId)));
    if (action === "advance") return jsonOk(await advanceOrder(params.id, user!.id, false));
    if (action === "stage") return jsonOk(await setDriverStage(params.id, user!.id, String(body.stage || "")));
    return jsonFail("未知操作");
  } catch (e) {
    return jsonFail((e as Error).message || "操作失败");
  }
}
