import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformUsers } from "@/db/schema";
import { forbiddenJson, isSameOriginRequest, requireAdminSession } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return forbiddenJson();
  if (!isSameOriginRequest(request)) return forbiddenJson("تعذّر التحقق من مصدر الطلب.");

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({ message: "معرّف الحساب غير صحيح." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "بيانات الإجراء غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).isActive !== "boolean") {
    return Response.json({ message: "اختار حالة حساب صحيحة." }, { status: 400 });
  }

  const isActive = (body as { isActive: boolean }).isActive;
  const [updated] = await db
    .update(platformUsers)
    .set({ isActive })
    .where(and(eq(platformUsers.id, id), eq(platformUsers.role, "student")))
    .returning({ id: platformUsers.id, isActive: platformUsers.isActive });

  if (!updated) {
    return Response.json({ message: "لم يتم العثور على حساب طالب صالح لهذا الإجراء." }, { status: 404 });
  }

  return Response.json(
    { ok: true, user: { id: String(updated.id), isActive: updated.isActive } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
