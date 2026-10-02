import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformUsers } from "@/db/schema";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/auth-security";

export const runtime = "nodejs";

const usernamePattern = /^[a-zA-Z][a-zA-Z0-9._-]{2,23}$/;
const allowedGrades = new Set([
  "الصف الأول الابتدائي",
  "الصف الثاني الابتدائي",
  "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي",
  "الصف الخامس الابتدائي",
  "الصف السادس الابتدائي",
  "الصف الأول الإعدادي",
  "الصف الثاني الإعدادي",
  "الصف الثالث الإعدادي",
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
]);


function errorResponse(message: string, status: number, retryAfter?: number) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return Response.json({ message }, { status, headers });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("تعذّر التحقق من مصدر الطلب. حدّث الصفحة وحاول مرة أخرى.", 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8192) return errorResponse("حجم الطلب أكبر من المسموح.", 413);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("صيغة الطلب غير صالحة.", 415);
  }

  try {
    const limit = await enforceRateLimit({
      scope: "signup",
      headers: request.headers,
      limit: 5,
      windowMilliseconds: 60 * 60 * 1000,
    });
    if (!limit.allowed) {
      return errorResponse("محاولات إنشاء الحساب كثيرة. حاول مرة أخرى بعد قليل.", 429, limit.retryAfterSeconds);
    }
  } catch (error) {
    console.error("Unable to check account registration rate limit", error);
    return errorResponse("تعذّر إتمام التسجيل الآن. حاول مرة أخرى بعد قليل.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("بيانات التسجيل غير صالحة.", 400);
  }

  if (!body || typeof body !== "object") return errorResponse("بيانات التسجيل غير صالحة.", 400);

  const payload = body as Record<string, unknown>;
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const rawUsername = typeof payload.username === "string" ? payload.username.trim() : "";
  const username = rawUsername.toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";
  const grade = typeof payload.grade === "string" ? payload.grade.trim() : "";
  const passwordBytes = Buffer.byteLength(password, "utf8");

  if (displayName.length < 2 || displayName.length > 80) {
    return errorResponse("اكتب الاسم الذي سيظهر في حسابك (من حرفين إلى 80 حرفًا).", 400);
  }
  if (!usernamePattern.test(rawUsername)) {
    return errorResponse("اسم المستخدم يجب أن يبدأ بحرف إنجليزي ويتكوّن من 3 إلى 24 حرفًا أو رقمًا أو . _ -.", 400);
  }
  if (password.length < 8 || passwordBytes > 72) {
    return errorResponse("كلمة المرور يجب ألا تقل عن 8 أحرف، وألا تتجاوز 72 بايت.", 400);
  }
  if (!allowedGrades.has(grade)) return errorResponse("اختار صفًا دراسيًا من القائمة.", 400);

  try {
    const [existingUser] = await db
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(eq(platformUsers.username, username))
      .limit(1);

    if (existingUser) return errorResponse("اسم المستخدم مستخدم بالفعل. اختار اسمًا آخر.", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const [createdUser] = await db
      .insert(platformUsers)
      .values({ username, displayName, passwordHash, grade })
      .returning({ id: platformUsers.id });

    return Response.json(
      { ok: true, user: { id: String(createdUser.id), username, displayName, grade } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return errorResponse("اسم المستخدم مستخدم بالفعل. اختار اسمًا آخر.", 409);
    }
    console.error("Unable to create student account", error);
    return errorResponse("تعذّر إنشاء الحساب الآن. حاول مرة أخرى بعد قليل.", 500);
  }
}
