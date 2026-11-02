/** 下拉可选车型（含新增吨位）；展示文案走 vehicle.* i18n */
export const VEHICLE_SELECT_VALUES = [
  "TON_1",
  "TON_2",
  "TON_5",
  "TON_1_5",
  "TON_3_5",
  "TON_7",
  "TON_8",
  "TON_10",
  "TON_15",
  "OTHER",
] as const;

export type VehicleSelectValue = (typeof VEHICLE_SELECT_VALUES)[number];

export const VEHICLE_TEAM_VALUES = VEHICLE_SELECT_VALUES.filter((v) => v !== "OTHER");
