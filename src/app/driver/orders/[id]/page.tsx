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

const PHOTO_STAGE_META: Record<PhotoStage, { title: string; tip: string }> = {
  picked: { title: "上传装车照片", tip: "请至少上传 1 张装车照片后确认已提货。客户与您均可在订单详情查看。" },
  delivered: { title: "上传卸车完成照片", tip: "请至少上传 1 张卸车完成照片后确认已送达。客户与您均可在订单详情查看。" },
};

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
    if (!res.ok) message.error(res.message || "加载失败");
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
    if (!res.ok) message.error(res.message || "操作失败");
    else {
      const tip =
        action === "bid"
          ? "报价成功，已进入我的订单·已报价"
          : action === "accept"
            ? "接单成功，已进入我的订单·待接货"
            : action === "stage_cancel"
              ? "已取消节点并记入日志"
              : action === "stage"
                ? "节点已锁定（双击可取消）"
                : "已提交";
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
      message.warning(photoModal.stage === "picked" ? "请上传装车照片" : "请上传卸车完成照片");
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
      message.info("节点已锁定。请双击以取消该节点。");
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

  const photoMeta = photoModal ? PHOTO_STAGE_META[photoModal.stage] : null;

  return (
    <DriverShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href={order.myBidPriceVnd ? "/driver/orders" : "/driver"} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {order.orderNo}
        </Typography.Title>
      </Space>
      {order.myBidPriceVnd ? (
        <Alert type="success" showIcon style={{ marginBottom: 12 }} message="本单已进入「我的订单 · 已报价」，不会再出现在货源大厅。" />
      ) : null}
      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="状态">
            {order.myBidPriceVnd && order.status === "OPEN" ? "已报价" : statusLabel(order.status, t)}
            {order.driverStage ? ` · ${stageLabel(order.driverStage)}` : ""}
          </Descriptions.Item>
          <Descriptions.Item label="路径">
            {pathLabel(order.matchPath)}
            {order.matchPath === "C" ? "（客户选择司机已发布的空车运力成交）" : ""}
          </Descriptions.Item>
          <Descriptions.Item label="平台价">{order.targetPriceVnd ? `${formatVnd(order.targetPriceVnd)} VND` : "不显示 / 询价"}</Descriptions.Item>
          <Descriptions.Item label="成交价">{order.dealPriceVnd ? formatVnd(order.dealPriceVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="佣金">{order.platformFeeVnd ? formatVnd(order.platformFeeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="到手价">{order.driverIncomeVnd ? formatVnd(order.driverIncomeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="起运">
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label="目的">
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label="货物">{order.cargoName}</Descriptions.Item>
        </Descriptions>
        <OrderProofPhotos pickupPhotos={order.pickupPhotos} deliveryPhotos={order.deliveryPhotos} />
        {order.myBidPriceVnd ? (
          <Alert style={{ marginTop: 16 }} type="info" showIcon message={`已报价 ${formatVnd(order.myBidPriceVnd)} VND。再次进入会看到这条报价，可以直接修改，不必重复提交同一价格。`} />
        ) : null}
        <DriverNavMap title="提货点" destAddress={order.pickupAddress} destLat={order.originLat} destLng={order.originLng} />
        <DriverNavMap title="目的地" destAddress={order.deliveryAddress} destLat={order.destLat} destLng={order.destLng} />
        <Space style={{ marginTop: 16 }} wrap>
          {order.status === "OPEN" && order.matchPath === "A" && order.targetPriceVnd ? (
            <Button type="primary" onClick={() => act("accept")}>
              接单
            </Button>
          ) : null}
          {(order.status === "OPEN" || order.status === "BIDDING") && order.matchPath === "B" ? (
            <Form key={order.myBidPriceVnd || "new"} layout="inline" initialValues={{ priceVnd: order.myBidPriceVnd ? Number(order.myBidPriceVnd) : undefined }} onFinish={(v) => act("bid", { priceVnd: v.priceVnd })}>
              <Form.Item name="priceVnd" rules={[{ required: true }]}>
                <InputNumber min={1} placeholder="报价 VND" />
              </Form.Item>
              <Button htmlType="submit" type="primary">
                {order.myBidPriceVnd ? "修改报价" : "提交报价"}
              </Button>
            </Form>
          ) : null}
          {["PENDING_EXECUTION", "IN_TRANSIT", "DELIVERED", "MATCHED"].includes(order.status) ? (
            <div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                单击锁定节点。「前往提货」后开始持续上报位置；「已提货 / 已送达」需上传照片。已锁定按钮置灰，双击可取消并记日志。
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
                      {stage.label}
                      {locked ? "（已锁定）" : ""}
                    </Button>
                  );
                })}
                <Button
                  danger
                  type={order.driverStage === DRIVER_ISSUE.key ? "default" : "primary"}
                  style={order.driverStage === DRIVER_ISSUE.key ? { background: "#fecaca", borderColor: "#f87171" } : undefined}
                  onClick={() => onStageClick(DRIVER_ISSUE.key)}
                >
                  {DRIVER_ISSUE.label}
                  {order.driverStage === DRIVER_ISSUE.key ? "（已锁定）" : ""}
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
                placeholder="分配给子账号"
                options={subs.map((s) => ({ value: s.id, label: s.displayName || s.username }))}
              />
            </Form.Item>
            <Button htmlType="submit">分配</Button>
          </Form>
        ) : null}
      </Card>

      <Modal
        title={photoMeta?.title}
        open={!!photoModal}
        onCancel={() => !submittingPhotos && setPhotoModal(null)}
        onOk={confirmPhotoStage}
        okText="确认并锁定节点"
        cancelText="取消"
        confirmLoading={submittingPhotos}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">{photoMeta?.tip}</Typography.Paragraph>
        {photoModal ? (
          <MultiPhotoPicker
            value={photoModal.photos}
            maxCount={6}
            onChange={(photos) => setPhotoModal((prev) => (prev ? { ...prev, photos } : prev))}
          />
        ) : null}
      </Modal>
    </DriverShell>
  );
}
