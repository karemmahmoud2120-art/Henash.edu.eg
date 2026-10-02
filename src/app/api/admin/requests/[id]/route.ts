import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentRequests } from "@/db/schema";
import { forbiddenJson, isSameOriginRequest, requireAdminSession } from "@/lib/admin-guard";

export const runtime = "nodejs";

const allowedStatuses = new Set(["new", "contacted", "enrolled", "closed"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return forbiddenJson();
  if (!isSameOriginRequest(request)) return forbiddenJson("تعذّر التحقق من مصدر الطلب.");

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({ message: "معرّف الطلب غير صحيح." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "بيانات الإجراء غير صالحة." }, { status: 400 });
  }
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : null;
  if (typeof status !== "string" || !allowedStatuses.has(status)) {
    return Response.json({ message: "اختار حالة صالحة لطلب التسجيل." }, { status: 400 });
  }

  const [updated] = await db
    .update(studentRequests)
    .set({ status })
    .where(eq(studentRequests.id, id))
    .returning({ id: studentRequests.id, status: studentRequests.status });

  if (!updated) return Response.json({ message: "الطلب غير موجود." }, { status: 404 });

  return Response.json(
    { ok: true, request: { id: updated.id, status: updated.status } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
