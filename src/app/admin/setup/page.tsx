import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminSetupClient from "./setup-client";
import { db } from "@/db";
import { platformUsers } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إعداد مدير المنصة | منصة حنيش التعليمية",
  description: "تهيئة حساب المدير الأول للمنصة من خلال رمز آمن خاص بصاحب الاستضافة.",
  robots: { index: false, follow: false },
};

export default async function AdminSetupPage() {
  const session = await auth();
  if (session?.user?.role === "admin") redirect("/admin");

  const [admin] = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(eq(platformUsers.role, "admin"))
    .limit(1);

  return (
    <AdminSetupClient
      alreadyConfigured={Boolean(admin)}
      setupEnabled={Boolean(process.env.ADMIN_SETUP_TOKEN && Buffer.byteLength(process.env.ADMIN_SETUP_TOKEN, "utf8") >= 32)}
    />
  );
}
