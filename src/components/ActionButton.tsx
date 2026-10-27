"use client";

import Link from "next/link";
import { Button } from "antd";
import type { ButtonProps } from "antd";
import type { ReactNode } from "react";

type Tone = "primary" | "default" | "danger" | "cyan" | "green" | "orange";

const TONE: Record<Tone, ButtonProps> = {
  primary: { type: "primary" },
  default: { type: "default" },
  danger: { danger: true, type: "primary" },
  cyan: { style: { background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" } },
  green: { style: { background: "#16a34a", borderColor: "#16a34a", color: "#fff" } },
  orange: { style: { background: "#ea580c", borderColor: "#ea580c", color: "#fff" } },
};

export function ActionButton({
  href,
  tone = "default",
  children,
  ...rest
}: ButtonProps & { href?: string; tone?: Tone; children: ReactNode }) {
  const btn = (
    <Button size="small" {...TONE[tone]} {...rest}>
      {children}
    </Button>
  );
  if (!href) return btn;
  return <Link href={href}>{btn}</Link>;
}
