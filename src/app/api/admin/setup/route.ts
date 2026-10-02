import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformUsers } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth-security";

export const runtime = "nodejs";

const usernamePattern = /^[a-zA-Z][a-zA-Z0-9._-]{2,23}$/;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function safeTokenMatch(submittedToken: string, configuredToken: string) {
  const submittedDigest = createHash("sha256").update(submittedToken).digest();
  const configuredDigest = createHash("sha256").update(configuredToken).digest();
  return timingSafeEqual(submittedDigest, configuredDigest);
}

function jsonError(message: string, status: number, retryAfter?: number) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return Response.json({ message }, { status, headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("تعذّر التحقق من مصدر الطلب.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonError("صيغة الطلب غير صالحة.", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 8192) {
    return jsonError("حجم الطلب أكبر من المسموح.", 413);
  }

  const configuredToken = process.env.ADMIN_SETUP_TOKEN;
  if (!configuredToken || Buffer.byteLength(configuredToken, "utf8") < 32) {
    return jsonError("إعداد الأدمن غير مفعّل. أضف ADMIN_SETUP_TOKEN سريًا لإعدادات الاستضافة أولًا.", 503);
  }

  try {
    const limit = await enforceRateLimit({
      scope: "admin-setup",
      headers: request.headers,
      limit: 5,
      windowMilliseconds: 60 * 60 * 1000,
    });
    if (!limit.allowed) {
      return jsonError("محاولات إعداد المدير كثيرة. حاول مرة أخرى لاحقًا.", 429, limit.retryAfterSeconds);
    }
  } catch (error) {
    console.error("Unable to check administrator setup rate limit", error);
    return jsonError("تعذّر إتمام إعداد الأدمن الآن. حاول مرة أخرى بعد قليل.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("بيانات إعداد الأدمن غير صالحة.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("بيانات إعداد الأدمن غير صالحة.", 400);

  const payload = body as Record<string, unknown>;
  const token = typeof payload.setupToken === "string" ? payload.setupToken : "";
  if (!token || Buffer.byteLength(token, "utf8") > 512 || !safeTokenMatch(token, configuredToken)) {
    return jsonError("رمز إعداد الأدمن غير صحيح.", 403);
  }

  const rawUsername = typeof payload.username === "string" ? payload.username.trim() : "";
  const username = rawUsername.toLowerCase();
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const passwordBytes = Buffer.byteLength(password, "utf8");

  if (!usernamePattern.test(rawUsername)) {
    return jsonError("اسم المستخدم يجب أن يبدأ بحرف إنجليزي وأن يتكوّن من 3 إلى 24 حرفًا أو رقمًا أو . _ -.", 400);
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return jsonError("اكتب اسمًا صحيحًا للأدمن.", 400);
  }
  if (password.length < 12 || passwordBytes > 72) {
    return jsonError("كلمة مرور الأدمن يجب أن تكون 12 حرفًا على الأقل ولا تتجاوز 72 بايت.", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const createdAdmin = await db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(842620251)`);
      const [existingAdmin] = await transaction
        .select({ id: platformUsers.id })
        .from(platformUsers)
        .where(eq(platformUsers.role, "admin"))
        .limit(1);
      if (existingAdmin) return null;

      const [existingUsername] = await transaction
        .select({ id: platformUsers.id })
        .from(platformUsers)
        .where(eq(platformUsers.username, username))
        .limit(1);
      if (existingUsername) return "username-taken";

      const [created] = await transaction
        .insert(platformUsers)
        .values({ username, displayName, passwordHash, grade: "إدارة المنصة", role: "admin" })
        .returning({ id: platformUsers.id, username: platformUsers.username });
      return created;
    });

    if (createdAdmin === null) {
      return jsonError("تم إعداد حساب مدير بالفعل؛ صفحة التهيئة مقفلة حفاظًا على أمان المنصة.", 409);
    }
    if (createdAdmin === "username-taken") {
      return jsonError("اسم المستخدم مستخدم بالفعل. اختار اسمًا آخر.", 409);
    }

    return Response.json(
      { ok: true, user: { id: String(createdAdmin.id), username: createdAdmin.username } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return jsonError("اسم المستخدم مستخدم بالفعل. اختار اسمًا آخر.", 409);
    }
    console.error("Unable to create the initial administrator", error);
    return jsonError("تعذّر إنشاء حساب الأدمن الآن. حاول مرة أخرى.", 500);
  }
}
