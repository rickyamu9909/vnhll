"use client";

import { useState } from "react";
import { DriverNavMap } from "@/components/DriverNavMap";
import { useI18n } from "@/components/I18nProvider";

type Spot = {
  destLat?: number | null;
  destLng?: number | null;
  destAddress: string;
};

/** 提货 / 送货导航互斥：同时只展开一张轻地图 */
export function DriverNavMaps({ pickup, dest }: { pickup: Spot; dest: Spot }) {
  const { t } = useI18n();
  const [active, setActive] = useState<"pickup" | "dest" | null>(null);

  return (
    <>
      <DriverNavMap
        title={t("driver.nav_pickup", "提货点")}
        destAddress={pickup.destAddress}
        destLat={pickup.destLat}
        destLng={pickup.destLng}
        expanded={active === "pickup"}
        onExpandedChange={(open) => setActive(open ? "pickup" : null)}
      />
      <DriverNavMap
        title={t("driver.nav_dest", "目的地")}
        destAddress={dest.destAddress}
        destLat={dest.destLat}
        destLng={dest.destLng}
        expanded={active === "dest"}
        onExpandedChange={(open) => setActive(open ? "dest" : null)}
      />
    </>
  );
}
