"use client";

import "./admin.css";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMemo, useState, type FormEvent } from "react";

type StudentRow = {
  id: number;
  displayName: string;
  username: string;
  grade: string;
  isActive: boolean;
  createdAt: string;
};

type RequestRow = {
  id: number;
  studentName: string;
  guardianName: string;
  phone: string;
  stage: string;
  note: string | null;
  status: string;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  enrolled: "تم التسجيل",
  closed: "مغلق",
};

function AdminBrand() {
  return (
    <Link className="brand admin-brand" href="/" aria-label="العودة إلى المنصة">
      <span className="brand-mark"><span>ح</span><i /></span>
      <span className="brand-copy"><strong>حنيش</strong><small>إدارة المنصة</small></span>
    </Link>
  );
}

function SmallArrow() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function AdminClient({
  adminName,
  adminUsername,
  initialStudents,
  initialRequests,
  totalStudents,
  activeStudents,
  newRequests,
}: {
  adminName: string;
  adminUsername: string;
  initialStudents: StudentRow[];
  initialRequests: RequestRow[];
  totalStudents: number;
  activeStudents: number;
  newRequests: number;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedTab, setSelectedTab] = useState<"students" | "requests">("students");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return students;
    return students.filter((student) =>
      `${student.displayName} ${student.username} ${student.grade}`.toLocaleLowerCase("ar").includes(normalized),
    );
  }, [students, query]);

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return requests;
    return requests.filter((request) =>
      `${request.studentName} ${request.guardianName} ${request.phone} ${request.stage} ${request.note ?? ""}`.toLocaleLowerCase("ar").includes(normalized),
    );
  }, [requests, query]);

  async function updateStudentStatus(student: StudentRow) {
    setErrorMessage("");
    setInfoMessage("");
    setPendingId(student.id);
    try {
      const response = await fetch(`/api/admin/users/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !student.isActive }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "تعذّر تحديث الحساب.");
      const nextActive = !student.isActive;
      setStudents((items) => items.map((item) => item.id === student.id ? { ...item, isActive: nextActive } : item));
      setInfoMessage(nextActive ? `تم تفعيل حساب ${student.displayName}.` : `تم إيقاف حساب ${student.displayName}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setPendingId(null);
    }
  }

  async function updateRequestStatus(item: RequestRow, status: string) {
    setErrorMessage("");
    setInfoMessage("");
    setPendingId(item.id);
    try {
      const response = await fetch(`/api/admin/requests/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "تعذّر تحديث الطلب.");
      setRequests((items) => items.map((request) => request.id === item.id ? { ...request, status } : request));
      setInfoMessage(`تم تحديث طلب ${item.studentName} إلى «${statusLabels[status] ?? status}».`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setPendingId(null);
    }
  }

  async function changeAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("كلمتا المرور الجديدتان غير متطابقتين.");
      return;
    }
    setPasswordPending(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "تعذّر تغيير كلمة المرور.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(result.message || "تم تغيير كلمة المرور بنجاح.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <main className="admin-page" dir="rtl">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <AdminBrand />
          <nav className="admin-top-links" aria-label="روابط الإدارة"><Link href="/">الموقع العام</Link><Link href="/curricula">دليل المناهج</Link></nav>
          <div className="admin-identity"><span className="admin-online-dot" /><span>مدير المنصة · {adminName}</span><small dir="ltr">@{adminUsername}</small></div>
          <button className="admin-logout" onClick={() => signOut({ redirectTo: "/login" })}>خروج</button>
        </div>
      </header>

      <div className="admin-shell">
        <div className="admin-page-heading">
          <div><span className="admin-kicker"><i /> إدارة آمنة · الجلسة محمية</span><h1>لوحة <em>إدارة المنصة</em></h1><p>تابع حسابات الطلاب وطلبات التسجيل من مكان واحد.</p></div>
          <Link className="admin-preview-link" href="/curricula">عرض دليل المناهج <SmallArrow /></Link>
        </div>

        <section className="admin-stats-grid" aria-label="إحصائيات المنصة">
          <article className="admin-stat-card"><span className="admin-stat-symbol">ح</span><div><span>إجمالي حسابات الطلاب</span><strong>{totalStudents.toLocaleString("ar-EG")}</strong></div><small>طالبًا مسجلًا</small></article>
          <article className="admin-stat-card"><span className="admin-stat-symbol admin-symbol-sage">✓</span><div><span>حسابات مفعّلة</span><strong>{activeStudents.toLocaleString("ar-EG")}</strong></div><small>لديها صلاحية دخول</small></article>
          <article className="admin-stat-card"><span className="admin-stat-symbol admin-symbol-peach">↗</span><div><span>طلبات تسجيل جديدة</span><strong>{newRequests.toLocaleString("ar-EG")}</strong></div><small>تحتاج متابعة</small></article>
        </section>

        <section className="admin-workspace">
          <div className="admin-workspace-heading"><div><span className="admin-kicker"><i /> مركز المتابعة</span><h2>إدارة <em>الطلاب والتسجيل</em></h2></div>
            <label className="admin-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="ابحث بالاسم أو الصف..." aria-label="ابحث عن حساب أو طلب" /></label>
          </div>

          <div className="admin-tabs" role="tablist" aria-label="اختيار سجل الإدارة">
            <button className={selectedTab === "students" ? "selected" : ""} onClick={() => { setSelectedTab("students"); setQuery(""); setErrorMessage(""); setInfoMessage(""); }} role="tab" aria-selected={selectedTab === "students"}>حسابات الطلاب <span>{totalStudents.toLocaleString("ar-EG")}</span></button>
            <button className={selectedTab === "requests" ? "selected" : ""} onClick={() => { setSelectedTab("requests"); setQuery(""); setErrorMessage(""); setInfoMessage(""); }} role="tab" aria-selected={selectedTab === "requests"}>طلبات الالتحاق <span>{requests.length.toLocaleString("ar-EG")}</span></button>
          </div>

          {(errorMessage || infoMessage) && <p className={`admin-feedback ${errorMessage ? "is-error" : "is-success"}`} role={errorMessage ? "alert" : "status"}>{errorMessage || infoMessage}</p>}

          <div className="admin-table-scroll">
            {selectedTab === "students" ? (
              <table className="admin-table">
                <thead><tr><th>الطالب</th><th>اسم المستخدم</th><th>الصف الدراسي</th><th>تاريخ الحساب</th><th>حالة الحساب</th><th>الإجراء</th></tr></thead>
                <tbody>
                  {filteredStudents.length ? filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td><span className="admin-student-name">{student.displayName}</span><small className="admin-row-id">رقم الحساب {student.id.toLocaleString("ar-EG")}</small></td>
                      <td><span className="admin-username" dir="ltr">@{student.username}</span></td>
                      <td>{student.grade}</td>
                      <td>{formattedDate(student.createdAt)}</td>
                      <td><span className={`admin-status ${student.isActive ? "status-active" : "status-paused"}`}><i /> {student.isActive ? "مفعّل" : "موقوف"}</span></td>
                      <td><button className={`admin-row-action ${student.isActive ? "action-pause" : "action-enable"}`} disabled={pendingId === student.id} onClick={() => updateStudentStatus(student)}>{pendingId === student.id ? "جارٍ التحديث..." : student.isActive ? "إيقاف الحساب" : "إعادة التفعيل"}</button></td>
                    </tr>
                  )) : <tr><td className="admin-empty-cell" colSpan={6}>{students.length ? "لا توجد نتائج تطابق بحثك." : "لا توجد حسابات طلاب حتى الآن. ستظهر هنا الحسابات عند التسجيل."}</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="admin-table request-table">
                <thead><tr><th>الطالب وولي الأمر</th><th>رقم التواصل</th><th>المرحلة</th><th>تاريخ الطلب</th><th>الحالة</th><th>رسالة</th></tr></thead>
                <tbody>
                  {filteredRequests.length ? filteredRequests.map((item) => (
                    <tr key={item.id}>
                      <td><span className="admin-student-name">{item.studentName}</span><small className="admin-row-id">ولي الأمر: {item.guardianName}</small></td>
                      <td><a className="admin-phone-link" href={`tel:${item.phone}`} dir="ltr">{item.phone}</a></td>
                      <td>{item.stage}</td>
                      <td>{formattedDate(item.createdAt)}</td>
                      <td><select className={`admin-status-select status-${item.status}`} value={statusLabels[item.status] ? item.status : "new"} disabled={pendingId === item.id} onChange={(event) => updateRequestStatus(item, event.target.value)} aria-label={`تغيير حالة طلب ${item.studentName}`}><option value="new">جديد</option><option value="contacted">تم التواصل</option><option value="enrolled">تم التسجيل</option><option value="closed">مغلق</option></select></td>
                      <td><span className="admin-request-note" title={item.note ?? "لا توجد رسالة"}>{item.note?.trim() || "—"}</span></td>
                    </tr>
                  )) : <tr><td className="admin-empty-cell" colSpan={6}>{requests.length ? "لا توجد طلبات تطابق بحثك." : "لا توجد طلبات تسجيل حتى الآن."}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <div className="admin-table-footer"><span>{selectedTab === "students" ? "يتم عرض أحدث 200 حساب." : "يتم عرض أحدث 100 طلب تسجيل."}</span><span>يتم حماية بيانات الطلاب وطلبات أولياء الأمور.</span></div>
        </section>

        <div className="admin-tools-grid">
          <article><span className="admin-tool-icon">⌘</span><div><strong>المناهج الرسمية</strong><p>انتقل لفهرس الكتب والصفوف وروابط وزارة التعليم.</p><Link href="/curricula">افتح دليل المناهج <SmallArrow /></Link></div></article>
          <article><span className="admin-tool-icon tool-icon-peach">⚙</span><div><strong>تأمين حساب الأدمن</strong><p>غيّر كلمة المرور متى أردت، واحفظها في مدير كلمات مرور خاص.</p><button className="admin-password-toggle" type="button" onClick={() => { setShowPasswordForm((show) => !show); setPasswordError(""); setPasswordSuccess(""); }}>{showPasswordForm ? "إغلاق النموذج" : "تغيير كلمة المرور"}</button></div></article>
        </div>
        {showPasswordForm && (
          <form className="admin-password-form" onSubmit={changeAdminPassword}>
            <div><span className="admin-kicker"><i /> إعدادات الحماية</span><h3>تغيير كلمة المرور</h3><p>أدخل الحالية ثم اختر كلمة مرور جديدة لا تقل عن 12 حرفًا.</p></div>
            <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" maxLength={72} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label>تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            {(passwordError || passwordSuccess) && <p className={`admin-password-message ${passwordError ? "has-error" : "has-success"}`} role={passwordError ? "alert" : "status"}>{passwordError || passwordSuccess}</p>}
            <button className="admin-password-submit" type="submit" disabled={passwordPending}>{passwordPending ? "جارٍ تحديث كلمة المرور..." : "حفظ كلمة المرور الجديدة"}</button>
          </form>
        )}
        <footer className="admin-page-footer"><AdminBrand /><span>لوحة الإدارة الخاصة بالمنصة التعليمية لأبناء عائلة حنيش.</span><Link href="/">العودة للموقع <SmallArrow /></Link></footer>
      </div>
    </main>
  );
}
