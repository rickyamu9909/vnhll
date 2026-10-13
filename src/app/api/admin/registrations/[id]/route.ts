import { NextRequest } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

type Ctx = { params: { id: string } };

function photosOf(raw?: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const row = await prisma.user.findUnique({
    where: { id: params.id },
    include: { company: true, carrierProfile: true },
  });
  if (!row) return jsonFail("用户不存在", 404);
  const profile = row.carrierProfile;
  return jsonOk({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    phone: row.phone,
    role: row.role,
    carrierKind: row.carrierKind,
    status: row.status,
    rejectReason: row.rejectReason,
    companyName: row.company?.companyName || profile?.companyName,
    address: row.company?.address || profile?.address,
    contactName: row.company?.contactName || profile?.contactName,
    licenseNo: profile?.licenseNo,
    idNumber: profile?.idNumber,
    driverLicense: profile?.driverLicense,
    vehicleLicense: profile?.vehicleLicense,
    insuranceNote: profile?.insuranceNote,
    photos: photosOf(profile?.photoUrls),
  });
}
