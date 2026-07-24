import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "ynhll_token";

export type UserRole = "ADMIN" | "CUSTOMER";
export type UserStatus = "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED";

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  displayName?: string | null;
  locale?: string;
  phone?: string | null;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    displayName: user.displayName,
    locale: user.locale,
    phone: user.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: String(payload.id),
      username: String(payload.username),
      role: payload.role as UserRole,
      status: payload.status as UserStatus,
      displayName: (payload.displayName as string) || null,
      locale: (payload.locale as string) || "zh",
      phone: (payload.phone as string) || null,
    };
  } catch {
    return null;
  }
}

export function requireAdmin(user: SessionUser | null) {
  return !!(user && user.role === "ADMIN" && user.status === "ACTIVE");
}

export function requireCustomer(user: SessionUser | null) {
  return !!(user && user.role === "CUSTOMER" && user.status === "ACTIVE");
}
