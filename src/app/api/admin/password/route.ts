import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformUsers } from "@/db/schema";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/auth-security";
import { forbiddenJson, requireAdminSession } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const session = await requireAdminSession();
  if (!session) return forbiddenJson();
  if (!isSameOriginRequest(request)) return forbiddenJson("تعذّر التحقق من مصدر الطلب.");

  try {
    const limit = await enforceRateLimit({
      scope: "admin-password",
      headers: request.headers,
      limit: 8,
      windowMilliseconds: 60 * 60 * 1000,
    });
    if (!limit.allowed) {
      return Response.json(
        { message: "طلبات تغيير كلمة المرور كثيرة. حاول مرة أخرى بعد قليل." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    console.error("Unable to check admin password change rate limit", error);
    return Response.json({ message: "تعذّر تحديث كلمة المرور الآن." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "بيانات تحديث كلمة المرور غير صالحة." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const currentPassword = typeof payload.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";
  const newPasswordBytes = Buffer.byteLength(newPassword, "utf8");

  if (!currentPassword || newPassword.length < 12 || newPasswordBytes > 72) {
    return Response.json({ message: "كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل ولا تتجاوز 72 بايت." }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return Response.json({ message: "اختار كلمة مرور جديدة مختلفة عن الحالية." }, { status: 400 });
  }

  const id = Number(session.user.id);
  if (!Number.isSafeInteger(id) || id < 1) return forbiddenJson();

  const [admin] = await db
    .select({ passwordHash: platformUsers.passwordHash, isActive: platformUsers.isActive })
    .from(platformUsers)
    .where(and(eq(platformUsers.id, id), eq(platformUsers.role, "admin")))
    .limit(1);

  if (!admin?.isActive || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    return Response.json({ message: "كلمة المرور الحالية غير صحيحة." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(platformUsers)
    .set({ passwordHash })
    .where(eq(platformUsers.id, id));

  return Response.json({ ok: true, message: "تم تحديث كلمة مرور الأدمن بنجاح." }, { headers: { "Cache-Control": "no-store" } });
}
