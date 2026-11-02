"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Descriptions, Layout, Modal, Space, Typography, message } from "antd";
import { CrewTrackReporter } from "@/components/CrewTrackReporter";
import { DriverNavMap } from "@/components/DriverNavMap";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { MultiPhotoPicker } from "@/components/MultiPhotoPicker";
import { OrderProofPhotos } from "@/components/OrderProofPhotos";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel, vehicleLabel } from "@/lib/client";
import { DRIVER_ISSUE, DRIVER_STAGES, stageLabel } from "@/lib/stages";
import { parseProofPhotos } from "@/lib/proof-photos";

type Detail = {
  id: string;
  orderNo: string;
  status: string;
  pickupAddress: string;
  pickupContact: string;
  pickupPhone: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  originLat?: number | null;
  originLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  cargoName: string;
  cargoWeightKg?: number;
  cargoVolumeM3?: number;
  weightTons?: number | null;
  vehicleType?: string | null;
  driverStage?: string | null;
  pickupPhotos?: string | null;
  deliveryPhotos?: string | null;
  pickupAt?: string | null;
  pickupNote?: string | null;
};

type PhotoStage = "picked" | "delivered";

export default function CrewTrackPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [order, setOrder] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const lastStageClick = useRef<{ key: string; at: number } | null>(null);
  const [photoModal, setPhotoModal] = useState<{ stage: PhotoStage; photos: string[] } | null>(null);
  const [submittingPhotos, setSubmittingPhotos] = useState(false);
  const [stageBusy, setStageBusy] = useState(false);

  const load = async () => {
    const res = await apiFetch<Detail>(`/api/crew/${token}`);
    if (!res.ok) {
      setMissing(true);
      setOrder(null);
      return;
    }
    setMissing(false);
    setOrder(res.data || null);
  };

  useEffect(() => {
    void load();
  }, [token]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (stageBusy) return false;
    setStageBusy(true);
    const prev = order;
    if (action === "stage" && typeof extra.stage === "string") {
      setOrder((o) => (o ? { ...o, driverStage: String(extra.stage) } : o));
    }
    if (action === "stage_cancel") {
      setOrder((o) => (o ? { ...o, driverStage: null } : o));
    }
    const res = await apiFetch<Detail>(`/api/crew/${token}`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
    setStageBusy(false);
    if (!res.ok) {
      if (prev) setOrder(prev);
      message.error(res.message || t("common.op_fail", "操作失败"));
      return false;
    }
    if (res.data) setOrder((o) => ({ ...(o || {}), ...res.data! }));
    message.success(action === "stage_cancel" ? t("stage.cancel_ok", "已取消节点并记入日志") : t("stage.lock_ok", "节点已锁定（双击可取消）"));
    return true;
  };

  const openPhotoStage = (stage: PhotoStage) => {
    const existing = stage === "picked" ? parseProofPhotos(order?.pickupPhotos) : parseProofPhotos(order?.deliveryPhotos);
    setPhotoModal({ stage, photos: existing });
  };

  const confirmPhotoStage = async () => {
    if (!photoModal) return;
    if (photoModal.photos.length < 1) {
      message.warning(photoModal.stage === "picked" ? t("stage.photo_need_pickup", "请上传装车照片") : t("stage.photo_need_delivery", "请上传卸车完成照片"));
      return;
    }
    setSubmittingPhotos(true);
    const ok = await act("stage", { stage: photoModal.stage, photos: photoModal.photos });
    setSubmittingPhotos(false);
    if (ok) setPhotoModal(null);
  };

  const onStageClick = (stageKey: string) => {
    const now = Date.now();
    const locked = order?.driverStage === stageKey;
    if (locked) {
      const prev = lastStageClick.current;
      if (prev && prev.key === stageKey && now - prev.at < 500) {
        lastStageClick.current = null;
        void act("stage_cancel", { stage: stageKey });
        return;
      }
      lastStageClick.current = { key: stageKey, at: now };
      message.info(t("stage.locked_tip", "节点已锁定。请双击以取消该节点。"));
      return;
    }
    lastStageClick.current = { key: stageKey, at: now };
    if (stageKey === "picked" || stageKey === "delivered") {
      openPhotoStage(stageKey);
      return;
    }
    void act("stage", { stage: stageKey });
  };

  if (missing) {
    return (
      <Layout className="page-shell" style={{ background: "transparent", minHeight: "100vh", padding: 16 }}>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t("crew.brand", "ANTS 外勤跟踪")}
          </Typography.Title>
          <LocaleSwitch />
        </Space>
        <Alert type="error" showIcon message={t("crew.invalid", "链接无效或已失效")} />
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout className="page-shell" style={{ background: "transparent", minHeight: "100vh", padding: 16 }}>
        <Card loading />
      </Layout>
    );
  }

  const canStage = ["PENDING_EXECUTION", "IN_TRANSIT", "DELIVERED", "MATCHED"].includes(order.status);
  const photoTitle =
    photoModal?.stage === "picked" ? t("stage.photo_pickup_title", "上传装车照片") : t("stage.photo_delivery_title", "上传卸车完成照片");
  const photoTip =
    photoModal?.stage === "picked"
      ? t("stage.photo_pickup_tip", "请至少上传 1 张装车照片后确认已提货。客户与您均可在订单详情查看。")
      : t("stage.photo_delivery_tip", "请至少上传 1 张卸车完成照片后确认已送达。客户与您均可在订单详情查看。");

  return (
    <Layout className="page-shell" style={{ background: "transparent", minHeight: "100vh", padding: 16 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("crew.brand", "ANTS 外勤跟踪")}
          </Typography.Title>
          <Typography.Text type="secondary">{order.orderNo}</Typography.Text>
        </div>
        <LocaleSwitch />
      </Space>

      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t("crew.no_price_tip", "本页不含费用信息，仅用于履约节点、拍照与位置上报。")} />
      <CrewTrackReporter token={token} />

      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("order.status", "状态")}>
            {statusLabel(order.status, t)}
            {order.driverStage ? ` · ${stageLabel(order.driverStage, t)}` : ""}
          </Descriptions.Item>
          <Descriptions.Item label={t("form.section_origin", "起运")}>
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("form.section_dest", "目的")}>
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.cargo_name", "货物")}>{order.cargoName}</Descriptions.Item>
          <Descriptions.Item label={t("order.weight", "重量(吨)")}>
            {order.weightTons ?? (order.cargoWeightKg != null ? (order.cargoWeightKg / 1000).toFixed(2) : "-")}
          </Descriptions.Item>
          <Descriptions.Item label={t("form.vehicle", "车型")}>{order.vehicleType ? vehicleLabel(order.vehicleType, t) : "-"}</Descriptions.Item>
          {order.pickupNote ? <Descriptions.Item label={t("form.note", "备注")}>{order.pickupNote}</Descriptions.Item> : null}
        </Descriptions>

        <OrderProofPhotos pickupPhotos={order.pickupPhotos} deliveryPhotos={order.deliveryPhotos} />
        <DriverNavMap title={t("driver.nav_pickup", "提货点")} destAddress={order.pickupAddress} destLat={order.originLat} destLng={order.originLng} />
        <DriverNavMap title={t("driver.nav_dest", "目的地")} destAddress={order.deliveryAddress} destLat={order.destLat} destLng={order.destLng} />

        {canStage ? (
          <div style={{ marginTop: 16 }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {t("stage.help", "单击锁定节点。「前往提货」后开始持续上报位置；「已提货 / 已送达」需上传照片。已锁定按钮置灰，双击可取消并记日志。")}
            </Typography.Paragraph>
            <Space wrap>
                {DRIVER_STAGES.map((stage) => {
                  const locked = order.driverStage === stage.key;
                  return (
                    <Button
                      key={stage.key}
                      type={locked ? "default" : "primary"}
                      ghost={!locked}
                      loading={stageBusy && !locked}
                      disabled={stageBusy || (order.status === "DELIVERED" && stage.key !== "delivered" && !locked)}
                      style={locked ? { background: "#cbd5e1", borderColor: "#94a3b8", color: "#475569" } : undefined}
                      onClick={() => onStageClick(stage.key)}
                    >
                      {stageLabel(stage.key, t)}
                      {locked ? t("common.locked", "（已锁定）") : ""}
                    </Button>
                  );
                })}
              <Button
                danger
                type={order.driverStage === DRIVER_ISSUE.key ? "default" : "primary"}
                loading={stageBusy}
                disabled={stageBusy}
                style={order.driverStage === DRIVER_ISSUE.key ? { background: "#fecaca", borderColor: "#f87171" } : undefined}
                onClick={() => onStageClick(DRIVER_ISSUE.key)}
              >
                {stageLabel(DRIVER_ISSUE.key, t)}
                {order.driverStage === DRIVER_ISSUE.key ? t("common.locked", "（已锁定）") : ""}
              </Button>
            </Space>
          </div>
        ) : (
          <Alert style={{ marginTop: 16 }} type="warning" showIcon message={t("crew.not_ready", "订单尚未进入履约阶段，暂不可操作节点。")} />
        )}
      </Card>

      <Modal
        title={photoTitle}
        open={!!photoModal}
        onCancel={() => !submittingPhotos && setPhotoModal(null)}
        onOk={confirmPhotoStage}
        okText={t("stage.photo_ok", "确认并锁定节点")}
        cancelText={t("action.cancel", "取消")}
        confirmLoading={submittingPhotos}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">{photoTip}</Typography.Paragraph>
        {photoModal ? (
          <MultiPhotoPicker value={photoModal.photos} maxCount={6} onChange={(photos) => setPhotoModal((prev) => (prev ? { ...prev, photos } : prev))} />
        ) : null}
      </Modal>
    </Layout>
  );
}
