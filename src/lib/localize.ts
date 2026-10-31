/** 将库内中文通知标题/正文、轨迹状态文案映射为当前语言 */

type TFn = (key: string, fallback?: string) => string;

const NOTICE_TITLE_KEYS: Array<{ match: RegExp | string; key: string; zh: string }> = [
  { match: "发现顺路运力", key: "notice.title.fit_cap", zh: "发现顺路运力" },
  { match: "发现顺路货源", key: "notice.title.fit_cargo", zh: "发现顺路货源" },
  { match: "对方已确认顺路撮合", key: "notice.title.peer_ok", zh: "对方已确认顺路撮合" },
  { match: "撮合已达成", key: "notice.title.matched", zh: "撮合已达成" },
  { match: "收到司机报价", key: "notice.title.bid", zh: "收到司机报价" },
  { match: "注册已通过", key: "notice.title.reg_ok", zh: "注册已通过" },
  { match: "注册未通过", key: "notice.title.reg_no", zh: "注册未通过" },
  { match: "协商", key: "notice.title.neg", zh: "运力协商" },
];

const STATUS_TEXT_MAP: Record<string, string> = {
  运输中: "track.moving",
  前往接货: "track.going",
  前往提货: "stage.going_pickup",
  已接货: "track.picked",
  已提货: "stage.picked",
  卸货中: "track.unloading",
  已到达: "track.arrived",
  已送达: "stage.delivered",
  异常: "track.issue",
  车辆异常: "stage.issue",
  "Đang vận chuyển": "track.moving",
  "Đang đến lấy": "stage.going_pickup",
  "Đã lấy hàng": "stage.picked",
  "Đã giao": "stage.delivered",
  "Sự cố xe": "stage.issue",
};

export function localizeNoticeTitle(title: string, t: TFn) {
  for (const row of NOTICE_TITLE_KEYS) {
    const hit = typeof row.match === "string" ? title.includes(row.match) : row.match.test(title);
    if (hit) return t(row.key, row.zh);
  }
  return title;
}

/** 尽量翻译通知正文中的固定中文句式，保留订单号/数字 */
export function localizeNoticeBody(body: string, t: TFn) {
  let text = body
    .replace(/\n?#suggest:[^\s]+/g, "")
    .replace(/\n?#neg:[^\s]+/g, "")
    .replace(/\n?#href:[^\s]+/g, "")
    .trim();
  const reps: Array<[RegExp, string]> = [
    [/发现顺路运力/g, t("notice.body.fit_cap", "Phát hiện xe trống thuận đường")],
    [/发现顺路货源/g, t("notice.body.fit_cargo", "Phát hiện hàng thuận đường")],
    [/对方已确认顺路撮合/g, t("notice.body.peer_ok", "Đối phương đã xác nhận ghép thuận đường")],
    [/请在\s*30\s*分钟内确认匹配/g, t("notice.body.confirm_30", "Vui lòng xác nhận ghép trong 30 phút")],
    [/请到订单详情确认/g, t("notice.body.go_order", "Vào chi tiết đơn để xác nhận")],
    [/空车距/g, t("notice.body.cap_dist", "Xe trống cách")],
    [/公里/g, t("notice.body.km", "km")],
    [/暂无目的偏好/g, t("notice.body.no_dest", "Chưa có điểm đến ưu tiên")],
    [/撮合已达成/g, t("notice.body.matched", "Đã ghép thành công")],
    [/收到司机报价/g, t("notice.body.bid", "Nhận được chào giá từ tài xế")],
    [/注册已通过/g, t("notice.body.reg_ok", "Đăng ký đã được duyệt")],
    [/注册未通过/g, t("notice.body.reg_no", "Đăng ký bị từ chối")],
  ];
  for (const [re, to] of reps) text = text.replace(re, to);
  return text;
}

export function localizeStatusText(text: string | null | undefined, t: TFn) {
  if (!text) return "-";
  const key = STATUS_TEXT_MAP[text.trim()];
  if (key) return t(key, text);
  // 已是越南语或其他语言则原样
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  return text;
}

export function localizeNegStatus(status: string, t: TFn) {
  const map: Record<string, [string, string]> = {
    PENDING: ["neg.pending", "待处理"],
    ACCEPTED: ["neg.accepted", "已接受"],
    REJECTED: ["neg.rejected", "已拒绝"],
    EXPIRED: ["neg.expired", "已过期"],
    CUSTOMER_OK: ["neg.customer_ok", "客户已确认"],
    DRIVER_OK: ["neg.driver_ok", "司机已确认"],
    MATCHED: ["neg.matched", "已匹配"],
    OPEN: ["cap.open", "可匹配"],
    CLOSED: ["cap.closed", "已取消"],
    ACTIVE: ["user.active", "已激活"],
    PENDING_USER: ["user.pending", "待审核"],
  };
  // PENDING used for both - handle user status separately via user.pending
  if (status === "PENDING") return t("neg.pending", "待处理");
  const hit = map[status];
  return hit ? t(hit[0], hit[1]) : status;
}

export function localizeCapStatus(status: string, t: TFn) {
  if (status === "OPEN") return t("cap.open", "可匹配");
  if (status === "MATCHED") return t("cap.matched", "已匹配");
  if (status === "CLOSED") return t("cap.closed", "已取消");
  return status;
}

export function localizeUserStatus(status: string, t: TFn) {
  if (status === "ACTIVE") return t("user.active", "已激活");
  if (status === "PENDING") return t("user.pending", "待审核");
  if (status === "REJECTED") return t("user.rejected", "已拒绝");
  if (status === "DISABLED") return t("user.disabled", "已停用");
  return status;
}
