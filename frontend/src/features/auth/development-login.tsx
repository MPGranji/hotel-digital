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
      setError("Tên đăng nhập hoặc mật khẩu không đúng.");
      return;
    }
    setError(undefined);
    onSignedIn();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      <div className="absolute -left-28 -top-28 size-80 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="absolute -bottom-36 -right-24 size-96 rounded-full bg-emerald-200/35 blur-3xl" />

      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_80px_-32px_rgba(15,23,42,0.4)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden overflow-hidden bg-[var(--primary)] p-10 text-white md:block">
          <div className="absolute -right-20 -top-20 size-56 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute -bottom-24 -left-16 size-64 rounded-full border border-white/10 bg-white/5" />
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <Hotel aria-hidden="true" size={25} />
            </div>
            <p className="mt-6 text-sm font-bold tracking-[0.24em] text-blue-100">HOTEL DIGITAL</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight">Quản lý khách sạn</h1>
          </div>
        </div>

        <div className="px-6 py-9 sm:px-12 sm:py-12">
          <div className="mb-8 md:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-[var(--primary)]"><Hotel aria-hidden="true" size={23} /></div>
            <p className="mt-4 text-xs font-bold tracking-[0.2em] text-[var(--primary)]">HOTEL DIGITAL</p>
          </div>
          <p className="text-sm font-medium text-blue-700">Chào mừng trở lại</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Đăng nhập hệ thống</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Nhập tài khoản quản trị để tiếp tục công việc.</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700">
              Tên đăng nhập
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <UserRound aria-hidden="true" className="shrink-0 text-slate-400" size={18} />
                <input autoComplete="username" autoFocus className="min-h-12 w-full border-0 bg-transparent text-slate-900 outline-none placeholder:text-slate-400" onChange={(event) => { setUsername(event.target.value); setError(undefined); }} placeholder="Nhập tên đăng nhập" value={username} />
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Mật khẩu
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <LockKeyhole aria-hidden="true" className="shrink-0 text-slate-400" size={18} />
                <input autoComplete="current-password" className="min-h-12 w-full border-0 bg-transparent text-slate-900 outline-none placeholder:text-slate-400" onChange={(event) => { setPassword(event.target.value); setError(undefined); }} placeholder="Nhập mật khẩu" type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button>
              </span>
            </label>

            {error ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}

            <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 font-medium text-white shadow-sm transition hover:bg-[var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" type="submit">Đăng nhập</button>
          </form>
        </div>
      </section>
    </main>
  );
}
