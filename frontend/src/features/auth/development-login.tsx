"use client";

import { Eye, EyeOff, Hotel, LockKeyhole, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

export function DevelopmentLogin({ onSignedIn }: Readonly<{ onSignedIn: () => void }>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim() !== "admin" || password !== "admin") {
      setError("Tên đăng nhập hoặc mật khẩu chưa đúng. Bạn thử lại nhé.");
      return;
    }
    setError(undefined);
    onSignedIn();
  }

  return (
    <main className="login-page flex min-h-dvh items-center justify-center px-4 py-8 sm:px-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/40 bg-white shadow-[0_30px_100px_-30px_rgba(9,27,36,0.5)] md:min-h-[560px] md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-[var(--sidebar-panel)] p-10 text-white md:flex lg:p-12">
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><Hotel aria-hidden="true" size={25} /></div>
            <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-[var(--sidebar-panel-muted)]">HOTEL DIGITAL</p>
            <h1 className="mt-12 max-w-sm text-[clamp(2rem,3vw,2.75rem)] font-semibold leading-[1.15] tracking-tight">Một nơi để cả ca làm việc luôn rõ ràng.</h1>
          </div>
          <p className="mt-12 max-w-xs border-t border-white/20 pt-5 text-sm leading-6 text-[var(--sidebar-panel-muted)]">Theo dõi phòng, đặt phòng và khách lưu trú — vừa đủ thông tin, đúng lúc bạn cần.</p>
        </div>

        <div className="flex flex-col justify-center bg-white px-6 py-9 sm:px-12 sm:py-12 lg:px-16">
          <div className="mb-8 md:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--nav-active)] text-[var(--primary)]"><Hotel aria-hidden="true" size={23} /></div>
            <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[var(--primary)]">HOTEL DIGITAL</p>
          </div>
          <p className="text-sm font-semibold text-[var(--primary)]">Chào bạn,</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">Mừng bạn trở lại</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Đăng nhập để bắt đầu ca làm việc.</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Tên đăng nhập
              <span className="login-field mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 transition-colors focus-within:border-[var(--primary)]">
                <UserRound aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={18} />
                <input autoComplete="username" autoFocus className="min-h-12 w-full border-0 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" onChange={(event) => { setUsername(event.target.value); setError(undefined); }} placeholder="Tên đăng nhập" value={username} />
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Mật khẩu
              <span className="login-field mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 transition-colors focus-within:border-[var(--primary)]">
                <LockKeyhole aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={18} />
                <input autoComplete="current-password" className="min-h-12 w-full border-0 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" onChange={(event) => { setPassword(event.target.value); setError(undefined); }} placeholder="Mật khẩu" type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="shrink-0 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button>
              </span>
            </label>

            {error ? <p className="rounded-xl border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm font-medium text-[#8c493e]" role="alert">{error}</p> : null}
            <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]" type="submit">Đăng nhập</button>
          </form>
        </div>
      </section>
    </main>
  );
}
