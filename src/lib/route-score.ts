import { haversineKm, type Coord } from "./geo";

export type ScoreInput = {
  orderOrigin?: Coord | null;
  orderDest?: Coord | null;
  pickupAt?: Date | null;
  vehicleType?: string | null;
  weightTons?: number | null;
  cargoType?: string | null;
  needAirport?: boolean;
  needPort?: boolean;
  capLocation?: Coord | null;
  capDest?: Coord | null;
  availableFrom?: Date | null;
  availableTo?: Date | null;
  capVehicleType?: string | null;
  loadTons?: number | null;
  cargoTypes?: string | null;
  airportOk?: boolean;
  portOk?: boolean;
};

export type ScoreResult = {
  score: number;
  level: "high" | "mid" | "low";
  distanceKm: number;
  basis: "DEST" | "PICKUP" | "ROUTE";
  reason: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function levelOf(score: number): ScoreResult["level"] {
  if (score >= 70) return "high";
  if (score >= 45) return "mid";
  return "low";
}

function levelLabel(level: ScoreResult["level"]) {
  return level === "high" ? "高" : level === "mid" ? "中" : "低";
}

/** 顺路度 0~100；无可用坐标时返回 null（不生成建议） */
export function scoreRouteFit(input: ScoreInput): ScoreResult | null {
  const reasons: string[] = [];
  let score = 0;
  let distanceKm = 0;
  let basis: ScoreResult["basis"] = "PICKUP";

  if (input.capLocation && input.orderOrigin) {
    const pickupKm = haversineKm(input.capLocation, input.orderOrigin);
    distanceKm = Math.round(pickupKm * 100) / 100;
    basis = "PICKUP";
    // 0km=40分，30km≈20分，80km≈0
    const pickupScore = clamp(40 - pickupKm * 0.5, 0, 40);
    score += pickupScore;
    if (pickupKm <= 15) reasons.push(`空车距装货点约 ${distanceKm} 公里`);
    else if (pickupKm <= 40) reasons.push(`空车距装货点约 ${distanceKm} 公里，尚可赶到`);
    else reasons.push(`空车距装货点约 ${distanceKm} 公里，偏远`);
  } else if (input.capDest && input.orderDest) {
    const destKm = haversineKm(input.capDest, input.orderDest);
    distanceKm = Math.round(destKm * 100) / 100;
    basis = "DEST";
    score += clamp(25 - destKm * 0.4, 0, 25);
    reasons.push(`目的偏好与送货点约 ${distanceKm} 公里`);
  } else {
    return null;
  }

  if (input.capDest && input.orderDest && basis === "PICKUP") {
    const destKm = haversineKm(input.capDest, input.orderDest);
    const destScore = clamp(25 - destKm * 0.35, 0, 25);
    score += destScore;
    if (destKm <= 25) reasons.push("返程方向与订单目的较顺");
    else if (destScore > 8) reasons.push("目的方向大致顺路");
    basis = "ROUTE";
  } else if (!input.capDest) {
    score += 8;
    reasons.push("未填目的偏好，按装货点距离评估");
  }

  if (input.pickupAt && input.availableFrom && input.availableTo) {
    const t = input.pickupAt.getTime();
    if (t >= input.availableFrom.getTime() && t <= input.availableTo.getTime()) {
      score += 15;
      reasons.push("可接货时间覆盖预约装货");
    } else {
      const nearest = Math.min(Math.abs(t - input.availableFrom.getTime()), Math.abs(t - input.availableTo.getTime()));
      const hours = nearest / 3600000;
      score += clamp(15 - hours * 2, 0, 15);
      if (hours <= 6) reasons.push("时间窗接近，可协调");
      else reasons.push("时间窗偏差较大");
    }
  } else {
    score += 5;
  }

  if (input.vehicleType && input.capVehicleType) {
    if (input.vehicleType === input.capVehicleType) {
      score += 10;
      reasons.push("车型匹配");
    } else {
      score += 3;
      reasons.push("车型不同，需确认");
    }
  } else {
    score += 5;
  }

  if (input.weightTons != null && input.loadTons != null) {
    if (input.loadTons >= input.weightTons) {
      score += 8;
      reasons.push("载重足够");
    } else {
      score -= 10;
      reasons.push("载重可能不足");
    }
  }

  if (input.cargoType && input.cargoTypes) {
    const ok = input.cargoTypes.split(/[,，|/]/).map((s) => s.trim()).filter(Boolean);
    if (!ok.length || ok.includes(input.cargoType) || ok.includes("GENERAL") || ok.includes("ALL")) {
      score += 5;
    } else {
      score -= 5;
      reasons.push("货物类型可能不匹配");
    }
  }

  if (input.needAirport && input.airportOk === false) {
    score -= 15;
    reasons.push("该运力不可进机场");
  }
  if (input.needPort && input.portOk === false) {
    score -= 15;
    reasons.push("该运力不可进港口");
  }

  score = clamp(Math.round(score), 0, 100);
  const level = levelOf(score);
  const reason = `顺路度${levelLabel(level)}（${score}）· ${reasons.slice(0, 3).join("；")}`;
  return { score, level, distanceKm, basis, reason };
}

export function scoreLevelLabel(level: ScoreResult["level"]) {
  return levelLabel(level);
}

/** 大厅展示门槛：过低不推送，避免噪音 */
export const SUGGEST_MIN_SCORE = 35;
