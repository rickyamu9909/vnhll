import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeadlines, parseOrderBody, stripCustomer } from "../src/lib/market";
import { calcByBps } from "../src/lib/money";
import { orderToFormValues, pickupIsPast, savedToForm, volumeFromItems } from "../src/lib/order-form";
import { haversineKm, matchPair } from "../src/lib/geo";
import { assertOrderRegion, knownProvince, provinceOptions, REGION_COUNTS, wardsOf } from "../src/lib/regions";
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

describe("5公里撮合", () => {
  const origin = { lat: 21.0285, lng: 105.8542 };
  const near = { lat: 21.0285 + 4 / 111, lng: 105.8542 };
  const far = { lat: 21.0285 + 8 / 111, lng: 105.8542 };

  it("有目的地偏好时，用客户送货地址对司机目的地", () => {
    const hit = matchPair({ origin, dest: origin }, { location: far, dest: near });
    assert.ok(hit);
    assert.equal(hit.basis, "DEST");
    assert.ok(hit.km <= 5);
    assert.equal(matchPair({ origin, dest: origin }, { location: near, dest: far }), null);
  });

  it("没有目的地偏好时，用司机当前位置对客户接货地址", () => {
    const hit = matchPair({ origin, dest: far }, { location: near });
    assert.ok(hit);
    assert.equal(hit.basis, "PICKUP");
    assert.equal(matchPair({ origin, dest: near }, { location: far }), null);
    assert.ok(haversineKm(origin, origin) < 0.001);
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
