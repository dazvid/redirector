"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError("Incorrect username or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="login-card">
      <span className="brandmark brandmark-lg">go</span>
      <h1 className="login-title">Sign in to go/links</h1>
      <p className="lede">
        Editing the registry requires an account. Anyone can browse without one.
      </p>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-user">Username</label>
          <input
            id="login-user"
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="admin"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-pw">Password</label>
          <div className="pw-wrap">
            <input
              id="login-pw"
              className="plain"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="segb pw-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-block login-submit"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="login-footer">
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
