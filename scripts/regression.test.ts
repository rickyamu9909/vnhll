import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeadlines, parseOrderBody, stripCustomer } from "../src/lib/market";
import { calcByBps } from "../src/lib/money";
import { orderToFormValues, pickupIsPast, savedToForm, volumeFromItems } from "../src/lib/order-form";
import { haversineKm, matchPair } from "../src/lib/geo";
import { scoreRouteFit, SUGGEST_MIN_SCORE } from "../src/lib/route-score";
import { cleanRecordedAt, shareOnForStatus, stageEnablesTracking, trackFreshness, validCoord } from "../src/lib/track";
import { normalizeProofPhotos } from "../src/lib/market";
import { parseProofPhotos } from "../src/lib/proof-photos";
import { assertOrderRegion, knownProvince, provinceOptions, REGION_COUNTS, wardsOf } from "../src/lib/regions";
import { capacityMatchBlock, placeById } from "../src/lib/places";
import { parseSavedAddress } from "../src/lib/saved-address";

const HANOI = "Thành phố Hà Nội";
const HCMC = "Thành phố Hồ Chí Minh";
const CAMAU = "Tỉnh Cà Mau";

function sampleBody(over: Record<string, unknown> = {}) {
  return {
    originProvince: HANOI,
    originCity: wardsOf(HANOI)[0],
    originAddress: "36 Hang Bong",
    originContact: "An",
    originPhone: "0900000001",
    destProvince: HCMC,
    destCity: wardsOf(HCMC)[0],
    destAddress: "12 Nguyen Hue",
    destContact: "Binh",
    destPhone: "0900000002",
    cargoType: "GENERAL",
    packaging: "CARTON",
    weightTons: 1.2,
    pickupAt: "2026-12-01T08:00:00.000Z",
    etaAt: "2026-12-01T18:00:00.000Z",
    cargoItems: [{ lengthCm: 100, widthCm: 80, heightCm: 60, quantity: 2 }],
    ...over,
  };
}

describe("越南行政区划", () => {
  it("包含现行 34 个省/市和全部区/坊/社", () => {
    assert.equal(REGION_COUNTS.provinces, 34);
    assert.equal(REGION_COUNTS.wards, 3321);
    assert.equal(wardsOf(HANOI).length, 126);
    assert.ok(wardsOf(HANOI).includes("Phường Ba Đình"));
    assert.ok(wardsOf(HCMC).length > 100);
  });

  it("省/市下拉同时能用中文和越文搜索", () => {
    const hanoi = provinceOptions().find((item) => item.value === HANOI);
    assert.ok(hanoi);
    assert.match(hanoi.label, /河内市/);
    assert.match(hanoi.label, /Hà Nội/);
    const hcmc = provinceOptions().find((item) => item.value === HCMC);
    assert.match(hcmc!.label, /胡志明市/);
  });

  it("区/坊/社必须属于所选省/市", () => {
    assert.doesNotThrow(() => assertOrderRegion(HANOI, "Phường Ba Đình", "起运"));
    assert.throws(() => assertOrderRegion(HANOI, wardsOf(CAMAU)[0], "起运"), /不匹配/);
    assert.throws(() => assertOrderRegion("", "Phường Ba Đình", "起运"), /请选择/);
    assert.doesNotThrow(() => assertOrderRegion("旧的自由文本省", "某区", "起运"));
    assert.equal(knownProvince(HANOI), true);
    assert.equal(knownProvince("旧的自由文本省"), false);
  });
});

describe("建单校验", () => {
  it("合法的河内到胡志明市订单可以通过", () => {
    const parsed = parseOrderBody(sampleBody({ targetPriceVnd: 1500000 }));
    assert.equal(parsed.originProvince, HANOI);
    assert.equal(parsed.originCity, wardsOf(HANOI)[0]);
    assert.equal(parsed.destProvince, HCMC);
    assert.equal(parsed.weightTons, 1.2);
    assert.equal(parsed.targetPriceVnd, BigInt(1500000));
    assert.equal(parsed.items[0].quantity, 2);
    assert.equal(parsed.cargoVolumeM3, 0.96);
  });

  it("没有尺寸时使用手工总体积", () => {
    const parsed = parseOrderBody(sampleBody({ cargoItems: [], cargoVolumeM3: 3.5 }));
    assert.equal(parsed.cargoVolumeM3, 3.5);
    assert.equal(volumeFromItems([{ lengthCm: 100, widthCm: 50, heightCm: 40, quantity: 1 }]), 0.2);
  });

  it("不填目标价时按询价处理", () => {
    const parsed = parseOrderBody(sampleBody());
    assert.equal(parsed.targetPriceVnd, null);
  });

  it("只有联系人和电话必填", () => {
    const parsed = parseOrderBody(
      sampleBody({
        originProvince: "",
        originCity: "",
        destProvince: "",
        destCity: "",
        originAddress: "",
        destAddress: "",
        cargoItems: [],
        weightTons: "",
        pickupAt: "",
        etaAt: "",
      })
    );
    assert.equal(parsed.originAddress, "");
    assert.equal(parsed.items.length, 0);
    assert.equal(parsed.weightTons, 0);
    assert.equal(parsed.etaAt, null);
    assert.ok(parsed.pickupAt instanceof Date);
  });

  it("只选堆场或码头时补上地址和坐标", () => {
    const parsed = parseOrderBody(
      sampleBody({
        originProvince: "",
        originCity: "",
        originAddress: "",
        originPlaceId: "port-cat-lai",
      })
    );
    assert.equal(parsed.originProvince, "Thành phố Hồ Chí Minh");
    assert.equal(parsed.originCity, "Phường Cát Lái");
    assert.equal(parsed.originAddress, "Cát Lái");
    assert.equal(parsed.originLat, placeById("port-cat-lai")?.lat);
    assert.equal(capacityMatchBlock("MATCHED"), "这条运力已经匹配成功，不能再次发起。请到订单里查看结果");
    assert.equal(capacityMatchBlock("OPEN"), null);
  });

  it("缺少电话时拒绝，省和坊不匹配时拒绝", () => {
    assert.throws(() => parseOrderBody(sampleBody({ originPhone: "" })), /联系人、电话/);
    assert.throws(() => parseOrderBody(sampleBody({ originCity: wardsOf(CAMAU)[0] })), /不匹配/);
  });

  it("旧订单里不在名录中的省名仍可修改提交", () => {
    const parsed = parseOrderBody(sampleBody({ originProvince: "Hanoi old text", originCity: "Hoan Kiem" }));
    assert.equal(parsed.originProvince, "Hanoi old text");
    assert.equal(parsed.originCity, "Hoan Kiem");
  });
});

describe("历史订单复制与常用地址", () => {
  it("复制只填入建单字段，不带入佣金和成交净额", () => {
    const values = orderToFormValues({
      originProvince: HANOI,
      originCity: "Phường Ba Đình",
      pickupAddress: "36 Hang Bong",
      pickupContact: "An",
      pickupPhone: "0900000001",
      destProvince: HCMC,
      destCity: wardsOf(HCMC)[0],
      destAddress: "12 Nguyen Hue",
      deliveryContact: "Binh",
      deliveryPhone: "0900000002",
      cargoItems: [{ lengthCm: 10, widthCm: 20, heightCm: 30, quantity: 4 }],
      weightTons: 2,
      targetPriceVnd: "900000",
      pickupAt: "2026-01-01T00:00:00.000Z",
      etaAt: "2026-01-02T00:00:00.000Z",
      pickupNote: "门口交接",
    });
    assert.equal(values.originAddress, "36 Hang Bong");
    assert.equal(values.destContact, "Binh");
    assert.equal(values.cargoItems[0].quantity, 4);
    assert.equal(values.targetPriceVnd, 900000);
    assert.equal(values.note, "门口交接");
    assert.equal("platformFeeVnd" in values, false);
    assert.equal("driverIncomeVnd" in values, false);
    assert.equal("commissionBps" in values, false);
    assert.equal(pickupIsPast("2020-01-01T00:00:00.000Z", new Date("2026-10-13T00:00:00.000Z")), true);
    assert.equal(pickupIsPast("2027-01-01T00:00:00.000Z", new Date("2026-10-13T00:00:00.000Z")), false);
  });

  it("常用地址可以填回起运或目的地", () => {
    const addr = {
      province: HANOI,
      ward: "Phường Ba Đình",
      address: "36 Hang Bong",
      contact: "An",
      phone: "0900000001",
    };
    const origin = savedToForm("origin", addr);
    const dest = savedToForm("dest", addr);
    assert.equal(origin.originProvince, HANOI);
    assert.equal(origin.originCity, "Phường Ba Đình");
    assert.equal(dest.destPhone, "0900000001");
    assert.equal("originProvince" in dest, false);
  });

  it("常用地址必须是名录中的省和所属区/坊/社", () => {
    const saved = parseSavedAddress({
      province: HANOI,
      ward: "Phường Ba Đình",
      address: "36 Hang Bong",
      contact: "An",
      phone: "0900000001",
    });
    assert.match(saved.label, /Hà Nội/);
    assert.throws(
      () =>
        parseSavedAddress({
          province: HANOI,
          ward: wardsOf(CAMAU)[0],
          address: "x",
          contact: "An",
          phone: "1",
        }),
      /不匹配/
    );
    assert.throws(() => parseSavedAddress({ province: HANOI, ward: "Phường Ba Đình" }), /请先填好/);
  });
});

describe("顺路度打分", () => {
  const origin = { lat: 10.7636, lng: 106.7858 };
  const near = { lat: 10.77, lng: 106.79 };
  const dest = { lat: 10.9, lng: 106.82 };
  const far = { lat: 16.0, lng: 108.0 };

  it("近距离空车且方向顺路时分数高", () => {
    const hit = scoreRouteFit({
      orderOrigin: origin,
      orderDest: dest,
      pickupAt: new Date("2026-12-01T08:00:00.000Z"),
      vehicleType: "TON_3_5",
      weightTons: 2,
      capLocation: near,
      capDest: dest,
      availableFrom: new Date("2026-12-01T00:00:00.000Z"),
      availableTo: new Date("2026-12-02T00:00:00.000Z"),
      capVehicleType: "TON_3_5",
      loadTons: 3.5,
      cargoTypes: "GENERAL",
    });
    assert.ok(hit);
    assert.ok(hit!.score >= SUGGEST_MIN_SCORE);
    assert.equal(hit!.level, "high");
    assert.match(hit!.reason, /顺路度/);
  });

  it("空车过远时分数低或不达标", () => {
    const hit = scoreRouteFit({
      orderOrigin: origin,
      orderDest: dest,
      capLocation: far,
      loadTons: 10,
      weightTons: 1,
    });
    assert.ok(hit);
    assert.ok(hit!.score < 70);
  });

  it("旧 5km 过滤仍可用于兼容校验", () => {
    const hit = matchPair({ origin, dest: origin }, { location: near });
    assert.ok(hit);
    assert.ok(haversineKm(origin, origin) < 0.001);
  });
});

describe("司机轨迹", () => {
  const now = Date.parse("2026-10-14T08:00:00.000Z");

  it("状态仅允许上报窗口；真正开启看 trackShareOn（前往提货）", () => {
    assert.equal(shareOnForStatus("PENDING_EXECUTION"), true);
    assert.equal(shareOnForStatus("IN_TRANSIT"), true);
    assert.equal(shareOnForStatus("MATCHED"), true);
    assert.equal(shareOnForStatus("DELIVERED"), false);
    assert.equal(shareOnForStatus("COMPLETED"), false);
    assert.equal(shareOnForStatus("OPEN"), false);
    assert.equal(stageEnablesTracking("going_pickup"), true);
    assert.equal(stageEnablesTracking("picked"), true);
    assert.equal(stageEnablesTracking("wait_pickup"), false);
    assert.equal(stageEnablesTracking("going_pickup"), true);
  });

  it("开启后持续为上报中，不用 3 分钟失联；未开启为 off；送达 ended", () => {
    assert.equal(trackFreshness("IN_TRANSIT", true, new Date(now - 60 * 1000), now), "live");
    assert.equal(trackFreshness("IN_TRANSIT", true, new Date(now - 4 * 60 * 1000), now), "live");
    assert.equal(trackFreshness("PENDING_EXECUTION", true, null, now), "live");
    assert.equal(trackFreshness("PENDING_EXECUTION", false, null, now), "off");
    assert.equal(trackFreshness("OPEN", false, null, now), "off");
    assert.equal(trackFreshness("DELIVERED", true, new Date(now), now), "ended");
  });

  it("丢掉无效坐标和超过一天的补传点", () => {
    assert.deepEqual(validCoord(10.762622, 106.660172), { lat: 10.762622, lng: 106.660172 });
    assert.equal(validCoord(0, 0), null);
    assert.equal(validCoord(120, 10), null);
    assert.equal(cleanRecordedAt("2026-10-13T07:00:00.000Z", now), null);
    assert.ok(cleanRecordedAt("2026-10-14T07:30:00.000Z", now));
  });
});

describe("履约照片", () => {
  it("装车/卸车至少一张，拒绝非法格式", () => {
    const ok = normalizeProofPhotos(["data:image/jpeg;base64,abc"], "装车照片");
    assert.equal(ok.length, 1);
    assert.throws(() => normalizeProofPhotos([], "装车照片"));
    assert.throws(() => normalizeProofPhotos(["not-an-image"], "卸车完成照片"));
  });

  it("详情字段可解析 JSON 数组", () => {
    assert.deepEqual(parseProofPhotos('["a","b"]'), ["a", "b"]);
    assert.deepEqual(parseProofPhotos(null), []);
  });
});

describe("价格与时效", () => {
  it("客户视图去掉佣金，20% 按万分比取整", () => {
    const view = stripCustomer({
      orderNo: "ANTS-1",
      targetPriceVnd: BigInt(1000000),
      platformFeeVnd: BigInt(200000),
      driverIncomeVnd: BigInt(800000),
      commissionBps: 2000,
    });
    assert.equal(view.targetPriceVnd, "1000000");
    assert.equal("platformFeeVnd" in view, false);
    assert.equal("driverIncomeVnd" in view, false);
    assert.equal("commissionBps" in view, false);
    const money = calcByBps(BigInt(1000000), 2000);
    assert.equal(money.platformFeeVnd, BigInt(200000));
    assert.equal(money.driverIncomeVnd, BigInt(800000));
  });

  it("报价截止是接货前 4 小时，等待匹配从当前起算 24 小时", () => {
    const now = new Date("2026-10-13T00:00:00.000Z");
    const pickup = new Date("2026-10-20T08:00:00.000Z");
    const deadlines = buildDeadlines(now, pickup, { waitMatchHours: 24, bidLeadHours: 4 });
    assert.equal(deadlines.waitDeadline.toISOString(), "2026-10-14T00:00:00.000Z");
    assert.equal(deadlines.bidDeadline.toISOString(), "2026-10-20T04:00:00.000Z");
  });
});
