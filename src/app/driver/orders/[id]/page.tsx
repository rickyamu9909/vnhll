"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Card, Descriptions, Form, InputNumber, Modal, Select, Space, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { MultiPhotoPicker } from "@/components/MultiPhotoPicker";
import { OrderProofPhotos } from "@/components/OrderProofPhotos";
import { apiFetch, pathLabel, statusLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { formatVnd } from "@/lib/money";
import { DriverNavMap } from "@/components/DriverNavMap";
import { DRIVER_ISSUE, DRIVER_STAGES, stageLabel } from "@/lib/stages";
import { parseProofPhotos } from "@/lib/proof-photos";

type Detail = {
  id: string;
  orderNo: string;
  status: string;
  matchPath?: string;
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
  targetPriceVnd?: string | null;
  dealPriceVnd?: string | null;
  platformFeeVnd?: string | null;
  driverIncomeVnd?: string | null;
  cargoName: string;
  weightTons?: number;
  myBidPriceVnd?: string | null;
  driverStage?: string | null;
  pickupPhotos?: string | null;
  deliveryPhotos?: string | null;
};

type PhotoStage = "picked" | "delivered";

export default function DriverOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [order, setOrder] = useState<Detail | null>(null);
  const [subs, setSubs] = useState<Array<{ id: string; displayName?: string; username: string }>>([]);
  const lastStageClick = useRef<{ key: string; at: number } | null>(null);
  const [photoModal, setPhotoModal] = useState<{ stage: PhotoStage; photos: string[] } | null>(null);
  const [submittingPhotos, setSubmittingPhotos] = useState(false);

  const load = async () => {
    const res = await apiFetch<Detail>(`/api/driver/orders/${id}`);
    if (!res.ok) message.error(res.message || t("common.loading_fail", "加载失败"));
    else setOrder(res.data || null);
  };

  useEffect(() => {
    load();
    (async () => {
      const res = await apiFetch<{ subs: Array<{ id: string; displayName?: string; username: string }> }>("/api/driver/team");
      if (res.ok) setSubs(res.data?.subs || []);
    })();
  }, [id]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await apiFetch(`/api/driver/orders/${id}`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
    if (!res.ok) message.error(res.message || t("common.op_fail", "操作失败"));
    else {
      const tip =
        action === "bid"
          ? t("driver.bid_ok", "报价成功，已进入我的订单·已报价")
          : action === "accept"
            ? t("driver.accept_ok", "接单成功，已进入我的订单·待接货")
            : action === "stage_cancel"
              ? t("stage.cancel_ok", "已取消节点并记入日志")
              : action === "stage"
                ? t("stage.lock_ok", "节点已锁定（双击可取消）")
                : t("action.submit", "提交");
      message.success(tip);
      if (action === "bid" || action === "accept") router.push("/driver/orders");
      else load();
    }
    return res.ok;
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

  if (!order) {
    return (
      <DriverShell>
        <Card loading />
      </DriverShell>
    );
  }

  const photoTitle =
    photoModal?.stage === "picked" ? t("stage.photo_pickup_title", "上传装车照片") : t("stage.photo_delivery_title", "上传卸车完成照片");
  const photoTip =
    photoModal?.stage === "picked" ? t("stage.photo_pickup_tip", "请至少上传 1 张装车照片后确认已提货。客户与您均可在订单详情查看。") : t("stage.photo_delivery_tip", "请至少上传 1 张卸车完成照片后确认已送达。客户与您均可在订单详情查看。");

  return (
    <DriverShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href={order.myBidPriceVnd ? "/driver/orders" : "/driver"} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {order.orderNo}
        </Typography.Title>
      </Space>
      {order.myBidPriceVnd ? <Alert type="success" showIcon style={{ marginBottom: 12 }} message={t("driver.bid_banner", "本单已进入「我的订单 · 已报价」，不会再出现在货源大厅。")} /> : null}
      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("order.status", "状态")}>
            {order.myBidPriceVnd && order.status === "OPEN" ? t("order.quoted", "已报价") : statusLabel(order.status, t)}
            {order.driverStage ? ` · ${stageLabel(order.driverStage, t)}` : ""}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.path", "路径")}>
            {pathLabel(order.matchPath, t)}
            {order.matchPath === "C" ? t("driver.path_c_note", "（客户选择司机已发布的空车运力成交）") : ""}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.platform_price", "平台价")}>
            {order.targetPriceVnd ? `${formatVnd(order.targetPriceVnd)} VND` : t("order.hidden_inquiry", "不显示 / 询价")}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.deal", "成交价")}>{order.dealPriceVnd ? formatVnd(order.dealPriceVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("order.fee", "佣金")}>{order.platformFeeVnd ? formatVnd(order.platformFeeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("order.income", "到手价")}>{order.driverIncomeVnd ? formatVnd(order.driverIncomeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("form.section_origin", "起运")}>
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("form.section_dest", "目的")}>
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.cargo_name", "货物")}>{order.cargoName}</Descriptions.Item>
        </Descriptions>
        <OrderProofPhotos pickupPhotos={order.pickupPhotos} deliveryPhotos={order.deliveryPhotos} />
        {order.myBidPriceVnd ? (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message={t("driver.bid_again", "已报价 {price} VND。再次进入会看到这条报价，可以直接修改，不必重复提交同一价格。").replace(
              "{price}",
              formatVnd(order.myBidPriceVnd)
            )}
          />
        ) : null}
        <DriverNavMap title={t("driver.nav_pickup", "提货点")} destAddress={order.pickupAddress} destLat={order.originLat} destLng={order.originLng} />
        <DriverNavMap title={t("driver.nav_dest", "目的地")} destAddress={order.deliveryAddress} destLat={order.destLat} destLng={order.destLng} />
        <Space style={{ marginTop: 16 }} wrap>
          {order.status === "OPEN" && order.matchPath === "A" && order.targetPriceVnd ? (
            <Button type="primary" onClick={() => act("accept")}>
              {t("action.accept", "接单")}
            </Button>
          ) : null}
          {(order.status === "OPEN" || order.status === "BIDDING") && order.matchPath === "B" ? (
            <Form
              key={order.myBidPriceVnd || "new"}
              layout="inline"
              initialValues={{ priceVnd: order.myBidPriceVnd ? Number(order.myBidPriceVnd) : undefined }}
              onFinish={(v) => act("bid", { priceVnd: v.priceVnd })}
            >
              <Form.Item name="priceVnd" rules={[{ required: true }]}>
                <InputNumber min={1} placeholder="VND" />
              </Form.Item>
              <Button htmlType="submit" type="primary">
                {order.myBidPriceVnd ? t("action.bid_edit", "修改报价") : t("action.bid", "提交报价")}
              </Button>
            </Form>
          ) : null}
          {["PENDING_EXECUTION", "IN_TRANSIT", "DELIVERED", "MATCHED"].includes(order.status) ? (
            <div>
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
                      disabled={order.status === "DELIVERED" && stage.key !== "delivered" && !locked}
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
                  style={order.driverStage === DRIVER_ISSUE.key ? { background: "#fecaca", borderColor: "#f87171" } : undefined}
                  onClick={() => onStageClick(DRIVER_ISSUE.key)}
                >
                  {stageLabel(DRIVER_ISSUE.key, t)}
                  {order.driverStage === DRIVER_ISSUE.key ? t("common.locked", "（已锁定）") : ""}
                </Button>
              </Space>
            </div>
          ) : null}
        </Space>
        {subs.length > 0 && (order.status === "PENDING_EXECUTION" || order.status === "IN_TRANSIT") ? (
          <Form style={{ marginTop: 16 }} layout="inline" onFinish={(v) => act("assign", { subUserId: v.subUserId })}>
            <Form.Item name="subUserId" rules={[{ required: true }]}>
              <Select
                style={{ width: 220 }}
                placeholder={t("driver.assign_ph", "分配给子账号")}
                options={subs.map((s) => ({ value: s.id, label: s.displayName || s.username }))}
              />
            </Form.Item>
            <Button htmlType="submit">{t("action.assign", "分配")}</Button>
          </Form>
        ) : null}
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
    </DriverShell>
  );
}
