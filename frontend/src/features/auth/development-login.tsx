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
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_24px_70px_-35px_rgba(36,52,77,0.25)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-[var(--primary)] p-10 text-white md:flex">
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><Hotel aria-hidden="true" size={25} /></div>
            <p className="mt-6 text-sm font-semibold tracking-[0.12em] text-[#e4ece8]">HOTEL DIGITAL</p>
            <h1 className="mt-5 max-w-xs text-3xl font-semibold leading-tight tracking-tight">Sẵn sàng cho ca làm việc hôm nay.</h1>
          </div>
          <p className="mt-12 max-w-xs text-sm leading-6 text-[#e4ece8]">Phòng, đặt phòng và khách lưu trú trong cùng một không gian dễ theo dõi.</p>
        </div>

        <div className="px-6 py-9 sm:px-12 sm:py-12">
          <div className="mb-8 md:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--nav-active)] text-[var(--primary)]"><Hotel aria-hidden="true" size={23} /></div>
            <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[var(--primary)]">HOTEL DIGITAL</p>
          </div>
          <p className="text-sm font-semibold text-[var(--primary)]">Chào bạn</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">Đăng nhập</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Nhập tài khoản để tiếp tục quản lý khách sạn.</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Tên đăng nhập
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--nav-active)]">
                <UserRound aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={18} />
                <input autoComplete="username" autoFocus className="min-h-12 w-full border-0 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" onChange={(event) => { setUsername(event.target.value); setError(undefined); }} placeholder="Tên đăng nhập" value={username} />
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Mật khẩu
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--nav-active)]">
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
