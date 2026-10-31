/** 将库内中文通知标题/正文、轨迹状态文案映射为当前语言 */

type TFn = (key: string, fallback?: string) => string;

const NOTICE_TITLE_KEYS: Array<{ match: RegExp | string; key: string; zh: string }> = [
  { match: "撮合建议已过期", key: "notice.title.suggest_expired", zh: "撮合建议已过期" },
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

/**
 * 翻译通知正文。顺序很重要：先替换完整长句，再替换短词，
 * 避免「订单/装货点」被提前替换后破坏完整句匹配。
 */
export function localizeNoticeBody(body: string, t: TFn) {
  let text = body
    .replace(/\n?#suggest:[^\s]+/g, "")
    .replace(/\n?#neg:[^\s]+/g, "")
    .replace(/\n?#href:[^\s]+/g, "")
    .trim();

  const reps: Array<[RegExp, string]> = [
    // —— 完整长句（优先）——
    [/未填目的偏好，按装货点距离评估/g, t("notice.body.no_dest_eval", "Chưa có điểm đến ưu tiên, đánh giá theo khoảng cách điểm lấy")],
    [/未填目的偏好，按điểm lấy距离评估/g, t("notice.body.no_dest_eval", "Chưa có điểm đến ưu tiên, đánh giá theo khoảng cách điểm lấy")],
    [/返程方向与订单目的较顺/g, t("notice.body.return_fit", "Hướng về gần điểm giao, thuận đường")],
    [/返程方向与Đơn\s*目的较顺/g, t("notice.body.return_fit", "Hướng về gần điểm giao, thuận đường")],
    [/目的方向大致顺路/g, t("notice.body.dest_fit", "Hướng điểm đến tương đối thuận")],
    [/可接货时间覆盖预约装货/g, t("notice.body.time_cover", "Thời gian nhận phủ giờ lấy hàng")],
    [/时间窗接近，可协调/g, t("notice.body.time_near", "Khung giờ gần, có thể điều chỉnh")],
    [/时间窗偏差较大/g, t("notice.body.time_gap", "Khung giờ lệch khá nhiều")],
    [/请在\s*\d+\s*分钟内到「我的匹配\/订单」确认[。.]?/g, t("notice.body.confirm_matches", "Vui lòng xác nhận trong 30 phút tại «Ghép của tôi / Đơn»")],
    [/请在\s*\d+\s*分钟内到「我的匹配\/Đơn\s*」确认[。.]?/g, t("notice.body.confirm_matches", "Vui lòng xác nhận trong 30 phút tại «Ghép của tôi / Đơn»")],
    [/请在\s*\d+\s*分钟内确认匹配[。.]?/g, t("notice.body.confirm_30", "Vui lòng xác nhận ghép trong 30 phút")],
    [/请在\s*\d+\s*分钟内确认[。.]?/g, t("notice.body.confirm_soon", "Vui lòng xác nhận trong 30 phút")],
    [/请点击确认完成撮合[。.]?/g, t("notice.body.click_confirm", "Vui lòng bấm xác nhận để hoàn tất ghép")],
    [/请到订单详情确认[。.]?/g, t("notice.body.go_order", "Vào chi tiết đơn để xác nhận")],
    [/的顺路匹配已超过有效期/g, t("notice.body.suggest_expired", "ghép thuận đường đã hết hạn")],
    [/你的账号已激活，可以登录[。.]?/g, t("notice.body.account_active", "Tài khoản đã kích hoạt, có thể đăng nhập.")],
    [/空车距装货点约\s*([\d.]+)\s*公里，尚可赶到/g, `${t("notice.body.cap_near", "Xe trống cách điểm lấy khoảng")} $1 ${t("notice.body.km", "km")}, ${t("notice.body.can_make", "vẫn kịp đến")}`],
    [/空车距装货点约\s*([\d.]+)\s*公里，偏远/g, `${t("notice.body.cap_near", "Xe trống cách điểm lấy khoảng")} $1 ${t("notice.body.km", "km")}, ${t("notice.body.far", "khá xa")}`],
    [/空车距装货点约\s*([\d.]+)\s*公里/g, `${t("notice.body.cap_near", "Xe trống cách điểm lấy khoảng")} $1 ${t("notice.body.km", "km")}`],
    [/目的偏好与送货点约\s*([\d.]+)\s*公里/g, `${t("notice.body.dest_near", "Điểm đến ưu tiên cách điểm giao khoảng")} $1 ${t("notice.body.km", "km")}`],
    [/装货距离约\s*([\d.]+)\s*公里/g, `${t("notice.body.pickup_dist", "Cách điểm lấy khoảng")} $1 ${t("notice.body.km", "km")}`],
    [/发现顺路运力/g, t("notice.body.fit_cap", "Phát hiện xe trống thuận đường")],
    [/发现顺路货源/g, t("notice.body.fit_cargo", "Phát hiện hàng thuận đường")],
    [/对方已确认顺路撮合/g, t("notice.body.peer_ok", "Đối phương đã xác nhận ghép thuận đường")],
    [/撮合已达成/g, t("notice.body.matched", "Đã ghép thành công")],
    [/收到司机报价/g, t("notice.body.bid", "Nhận chào giá từ tài xế")],
    [/注册已通过/g, t("notice.body.reg_ok", "Đăng ký đã được duyệt")],
    [/注册未通过/g, t("notice.body.reg_no", "Đăng ký bị từ chối")],
    [/车型匹配/g, t("notice.body.vehicle_ok", "Loại xe khớp")],
    [/车型不同，需确认/g, t("notice.body.vehicle_diff", "Loại xe khác, cần xác nhận")],
    [/载重足够/g, t("notice.body.load_ok", "Tải trọng đủ")],
    [/载重可能不足/g, t("notice.body.load_low", "Tải trọng có thể thiếu")],
    [/货物类型可能不匹配/g, t("notice.body.cargo_mismatch", "Loại hàng có thể không khớp")],
    [/该运力不可进机场/g, t("notice.body.no_airport", "Xe không vào sân bay")],
    [/该运力不可进港口/g, t("notice.body.no_port", "Xe không vào cảng")],
    [/已进入待执行/g, t("notice.body.to_exec", "đã sang chờ thực hiện")],
    [/有新报价/g, t("notice.body.new_bid", "có chào giá mới")],
    [/暂无目的偏好/g, t("notice.body.no_dest", "Chưa có điểm đến ưu tiên")],
    [/客户订单\s*/g, t("notice.body.customer_order", "Đơn khách ")],
    [/顺路度高/g, t("cap.fit_high", "Thuận đường cao")],
    [/顺路度中/g, t("cap.fit_mid", "Thuận đường trung")],
    [/顺路度低/g, t("cap.fit_low", "Thuận đường thấp")],
    // —— 短词（最后）——
    [/订单\s*/g, t("notice.body.order", "Đơn ")],
    [/空车距/g, t("notice.body.cap_dist", "Xe trống cách")],
    [/装货点/g, t("notice.body.pickup_point", "điểm lấy")],
    [/公里/g, t("notice.body.km", "km")],
    [/距离评估/g, t("notice.body.dist_eval", "đánh giá theo khoảng cách")],
    [/目的较顺/g, t("notice.body.dest_smooth", "điểm đến thuận đường")],
    [/返程方向与/g, t("notice.body.return_dir", "Hướng về ")],
    // 中文标点 → 越南语习惯标点
    [/；/g, "; "],
    [/，/g, ", "],
    [/：/g, ": "],
    [/（/g, " ("],
    [/）/g, ")"],
    [/「/g, "«"],
    [/」/g, "»"],
    [/。/g, ". "],
  ];
  for (const [re, to] of reps) text = text.replace(re, to);
  // 清掉残留汉字（极端兜底：避免界面再漏中文）
  text = text.replace(/[\u4e00-\u9fff]+/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:)])/g, "$1").trim();
  return text;
}

export function localizeStatusText(text: string | null | undefined, t: TFn) {
  if (!text) return "-";
  const key = STATUS_TEXT_MAP[text.trim()];
  if (key) return t(key, text);
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
