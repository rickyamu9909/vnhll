/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const translations = [
  { key: "app.name", zh: "ynhll 越南散货车", vi: "ynhll Vận tải Việt Nam", groupName: "common" },
  { key: "action.login", zh: "登录", vi: "Đăng nhập", groupName: "common" },
  { key: "action.logout", zh: "退出登录", vi: "Đăng xuất", groupName: "common" },
  { key: "action.register", zh: "注册", vi: "Đăng ký", groupName: "common" },
  { key: "action.submit", zh: "提交", vi: "Gửi", groupName: "common" },
  { key: "action.save", zh: "保存", vi: "Lưu", groupName: "common" },
  { key: "action.cancel", zh: "取消", vi: "Hủy", groupName: "common" },
  { key: "action.create", zh: "新建", vi: "Tạo mới", groupName: "common" },
  { key: "action.edit", zh: "编辑", vi: "Sửa", groupName: "common" },
  { key: "action.approve", zh: "通过", vi: "Duyệt", groupName: "common" },
  { key: "action.reject", zh: "拒绝", vi: "Từ chối", groupName: "common" },
  { key: "action.copy_notify", zh: "复制通知消息", vi: "Sao chép thông báo", groupName: "common" },
  { key: "action.confirm_complete", zh: "确认完成", vi: "Xác nhận hoàn tất", groupName: "common" },
  { key: "nav.orders", zh: "我的订单", vi: "Đơn hàng của tôi", groupName: "nav" },
  { key: "nav.new_order", zh: "新建订单", vi: "Tạo đơn hàng", groupName: "nav" },
  { key: "nav.admin_orders", zh: "订单管理", vi: "Quản lý đơn", groupName: "nav" },
  { key: "nav.admin_customers", zh: "客户管理", vi: "Quản lý khách", groupName: "nav" },
  { key: "nav.admin_drivers", zh: "司机管理", vi: "Quản lý tài xế", groupName: "nav" },
  { key: "nav.admin_i18n", zh: "语言包", vi: "Gói ngôn ngữ", groupName: "nav" },
  { key: "nav.dashboard", zh: "工作台", vi: "Bảng điều khiển", groupName: "nav" },
  { key: "auth.username", zh: "用户名", vi: "Tên đăng nhập", groupName: "auth" },
  { key: "auth.password", zh: "密码", vi: "Mật khẩu", groupName: "auth" },
  { key: "auth.company_name", zh: "企业名称", vi: "Tên doanh nghiệp", groupName: "auth" },
  { key: "auth.pending_tip", zh: "账号待管理员审核，通过后方可登录下单。", vi: "Tài khoản đang chờ duyệt, vui lòng đợi quản trị viên.", groupName: "auth" },
  { key: "order.order_no", zh: "订单号", vi: "Mã đơn", groupName: "order" },
  { key: "order.status", zh: "状态", vi: "Trạng thái", groupName: "order" },
  { key: "order.pickup_address", zh: "发货地址", vi: "Địa chỉ nhận hàng", groupName: "order" },
  { key: "order.delivery_address", zh: "收货地址", vi: "Địa chỉ giao hàng", groupName: "order" },
  { key: "order.cargo_name", zh: "货物名称", vi: "Tên hàng", groupName: "order" },
  { key: "order.vehicle_type", zh: "车型", vi: "Loại xe", groupName: "order" },
  { key: "order.customer_bid", zh: "企业出价", vi: "Giá chào của khách", groupName: "order" },
  { key: "order.pickup_at", zh: "预约接货时间", vi: "Thời gian nhận hàng", groupName: "order" },
  { key: "order.pickup_note", zh: "接货备注", vi: "Ghi chú nhận hàng", groupName: "order" },
  { key: "order.weight", zh: "重量(kg)", vi: "Khối lượng (kg)", groupName: "order" },
  { key: "order.volume", zh: "体积(m³)", vi: "Thể tích (m³)", groupName: "order" },
  { key: "status.PENDING_REVIEW", zh: "待审核", vi: "Chờ duyệt", groupName: "status" },
  { key: "status.BIDDING", zh: "竞价中", vi: "Đang chào giá", groupName: "status" },
  { key: "status.MATCHED", zh: "已接单", vi: "Đã nhận đơn", groupName: "status" },
  { key: "status.IN_TRANSIT", zh: "运输中", vi: "Đang vận chuyển", groupName: "status" },
  { key: "status.DELIVERED", zh: "已送达", vi: "Đã giao", groupName: "status" },
  { key: "status.COMPLETED", zh: "已完成", vi: "Hoàn tất", groupName: "status" },
  { key: "status.CANCELLED", zh: "已取消", vi: "Đã hủy", groupName: "status" },
  { key: "status.REJECTED", zh: "已拒绝", vi: "Từ chối", groupName: "status" },
  { key: "vehicle.TON_1_5", zh: "1.5吨", vi: "1.5 tấn", groupName: "vehicle" },
  { key: "vehicle.TON_3_5", zh: "3.5吨", vi: "3.5 tấn", groupName: "vehicle" },
  { key: "vehicle.TON_7", zh: "7吨", vi: "7 tấn", groupName: "vehicle" },
  { key: "vehicle.TON_10", zh: "10吨", vi: "10 tấn", groupName: "vehicle" },
  { key: "vehicle.OTHER", zh: "其他", vi: "Khác", groupName: "vehicle" },
  { key: "msg.copy_success", zh: "通知消息已复制", vi: "Đã sao chép thông báo", groupName: "msg" },
  { key: "msg.save_success", zh: "保存成功", vi: "Lưu thành công", groupName: "msg" },
  { key: "msg.no_permission", zh: "无权限访问", vi: "Không có quyền truy cập", groupName: "msg" },
];

async function main() {
  for (const item of translations) {
    await prisma.translation.upsert({
      where: { key: item.key },
      create: item,
      update: { zh: item.zh, vi: item.vi, groupName: item.groupName },
    });
  }

  const adminPass = await bcrypt.hash("Admin@2026", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      passwordHash: adminPass,
      role: "ADMIN",
      status: "ACTIVE",
      displayName: "系统管理员",
      phone: process.env.ADMIN_HOTLINE || "+84 90 000 0000",
      locale: "zh",
    },
    update: {
      passwordHash: adminPass,
      status: "ACTIVE",
      role: "ADMIN",
    },
  });

  const customerPass = await bcrypt.hash("Test123456", 10);
  const customer = await prisma.user.upsert({
    where: { username: "河内快运物流" },
    create: {
      username: "河内快运物流",
      passwordHash: customerPass,
      role: "CUSTOMER",
      status: "ACTIVE",
      displayName: "河内快运物流",
      phone: "+84 91 111 1111",
      locale: "zh",
      company: {
        create: {
          companyName: "河内快运物流",
          taxCode: "0101234567",
          contactName: "Nguyen Van A",
          contactPhone: "+84 91 111 1111",
          address: "Hà Nội, Việt Nam",
        },
      },
    },
    update: {
      passwordHash: customerPass,
      status: "ACTIVE",
    },
  });

  await prisma.driver.upsert({
    where: { id: "seed-driver-001" },
    create: {
      id: "seed-driver-001",
      name: "Tran Van B",
      phone: "+84 90 123 4567",
      vehicleType: "TON_3_5",
      plateNumber: "30A-12345",
      status: "ACTIVE",
      notes: "种子司机",
    },
    update: {
      status: "ACTIVE",
    },
  });

  console.log("Seed OK:", { admin: "admin", customer: customer.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
