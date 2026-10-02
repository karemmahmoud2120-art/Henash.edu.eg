import type { Metadata } from "next";
import { and, count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminClient from "./admin-client";
import { db } from "@/db";
import { platformUsers, studentRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إدارة المنصة | منصة حنيش التعليمية",
  description: "لوحة إدارة طلاب وطلبات المنصة التعليمية لأبناء عائلة حنيش.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [studentCounts, activeStudentCounts, newRequestCounts, students, requestRows] = await Promise.all([
    db.select({ total: count() })
      .from(platformUsers)
      .where(eq(platformUsers.role, "student")),
    db.select({ total: count() })
      .from(platformUsers)
      .where(and(eq(platformUsers.role, "student"), eq(platformUsers.isActive, true))),
    db.select({ total: count() })
      .from(studentRequests)
      .where(eq(studentRequests.status, "new")),
    db.select({
      id: platformUsers.id,
      displayName: platformUsers.displayName,
      username: platformUsers.username,
      grade: platformUsers.grade,
      isActive: platformUsers.isActive,
      createdAt: platformUsers.createdAt,
    })
      .from(platformUsers)
      .where(eq(platformUsers.role, "student"))
      .orderBy(desc(platformUsers.createdAt))
      .limit(200),
    db.select({
      id: studentRequests.id,
      studentName: studentRequests.studentName,
      guardianName: studentRequests.guardianName,
      phone: studentRequests.phone,
      stage: studentRequests.stage,
      note: studentRequests.note,
      status: studentRequests.status,
      createdAt: studentRequests.createdAt,
    })
      .from(studentRequests)
      .orderBy(desc(studentRequests.createdAt))
      .limit(100),
  ]);

  return (
    <AdminClient
      adminName={session.user.name || session.user.username}
      adminUsername={session.user.username}
      initialStudents={students.map((student) => ({ ...student, createdAt: student.createdAt.toISOString() }))}
      initialRequests={requestRows.map((request) => ({ ...request, createdAt: request.createdAt.toISOString() }))}
      totalStudents={studentCounts[0]?.total ?? 0}
      activeStudents={activeStudentCounts[0]?.total ?? 0}
      newRequests={newRequestCounts[0]?.total ?? 0}
    />
  );
}
