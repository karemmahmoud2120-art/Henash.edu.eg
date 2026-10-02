"use client";

import "./setup.css";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function ShieldIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 20 6v5.5c0 4.7-3.2 7.8-8 9.5-4.8-1.7-8-4.8-8-9.5V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m8.5 12 2.3 2.3 4.8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function AdminSetupClient({
  alreadyConfigured,
  setupEnabled,
}: {
  alreadyConfigured: boolean;
  setupEnabled: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username: normalizedUsername, setupToken, password }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "تعذّر إعداد المدير.");

      const loginResult = await signIn("credentials", {
        username: normalizedUsername,
        password,
        redirect: false,
      });
      if (!loginResult?.ok || loginResult.error) {
        router.replace("/login?admin=ready");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "حدث خطأ غير متوقع.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-setup-page" dir="rtl">
      <header className="setup-header">
        <Link className="brand" href="/"><span className="brand-mark"><span>ح</span><i /></span><span className="brand-copy"><strong>حنيش</strong><small>إعداد آمن للإدارة</small></span></Link>
        <Link href="/">العودة للمنصة <span>←</span></Link>
      </header>
      <section className="setup-card">
        <span className="setup-icon"><ShieldIcon /></span>
        <span className="setup-eyebrow"><i /> {alreadyConfigured ? "حساب المدير محمي" : "تهيئة المرة الأولى فقط"}</span>
        <h1>{alreadyConfigured ? <>تم إعداد <em>مدير المنصة</em></> : <>إعداد حساب <em>مدير المنصة</em></>}</h1>
        {alreadyConfigured ? (
          <>
            <p>يوجد حساب أدمن بالفعل؛ لذلك تم إيقاف نموذج التهيئة منعًا لاستبدال بيانات المدير. سجّل دخولك بحساب الأدمن للوصول إلى لوحة الإدارة.</p>
            <div className="setup-closed-notice"><ShieldIcon /> لا يوجد تسجيل عام لحسابات الأدمن. إنشاء الحساب الأول يحتاج رمزًا سريًا من صاحب الاستضافة.</div>
            <Link className="setup-submit setup-link-button" href="/login">الانتقال إلى تسجيل الدخول <span>←</span></Link>
          </>
        ) : !setupEnabled ? (
          <>
            <p>لا يوجد مدير مُعدّ على قاعدة البيانات بعد. أضف المتغير السري <code>ADMIN_SETUP_TOKEN</code> في إعدادات الاستضافة أولًا، ثم ارجع لهذه الصفحة.</p>
            <div className="setup-closed-notice"><ShieldIcon /><span>إنشاء مدير بدون رمز صاحب الاستضافة غير مسموح. هذا يمنع أي زائر من السيطرة على الموقع.</span></div>
            <Link className="setup-secondary-link" href="/login">العودة إلى الدخول</Link>
          </>
        ) : (
          <>
            <p>هذه الصفحة لإنشاء أول حساب أدمن فقط، برمز إعداد سري يضيفه صاحب المنصة في إعدادات الاستضافة. تُقفل آليًا بعد نجاح الإعداد.</p>
            <form className="setup-form" onSubmit={submit}>
              <label>اسم المدير الظاهر<input required minLength={2} maxLength={80} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="مثال: مدير المنصة" /></label>
              <label>اسم مستخدم المدير<input required minLength={3} maxLength={24} autoCapitalize="none" autoComplete="username" pattern="[A-Za-z][A-Za-z0-9._-]{2,23}" title="ابدأ بحرف إنجليزي، من 3 إلى 24 حرفًا" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} placeholder="مثال: hanish.admin" /><small>حساب المدير منفصل عن التسجيل العام للطلاب.</small></label>
              <label>رمز إعداد المدير<input required autoComplete="off" maxLength={512} value={setupToken} onChange={(event) => setSetupToken(event.target.value)} placeholder="الصقه من إعدادات الاستضافة السرية" /></label>
              <label>كلمة مرور المدير<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="١٢ حرفًا على الأقل" /></label>
              <label>تأكيد كلمة المرور<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور" /></label>
              {error && <p className="setup-error" role="alert">{error}</p>}
              <button className="setup-submit" type="submit" disabled={busy}>{busy ? "جارٍ تأمين حسابك..." : "إنشاء حساب الأدمن"}<span>←</span></button>
            </form>
            <p className="setup-footer-note"><ShieldIcon /> خزّن كلمة المرور في مدير آمن؛ لا تُرسل رمز التهيئة أو كلمة المرور لأحد.</p>
          </>
        )}
      </section>
      <footer className="setup-site-footer">المنصة التعليمية لأبناء عائلة حنيش · إعداد مسؤول خاص وآمن</footer>
    </main>
  );
}
