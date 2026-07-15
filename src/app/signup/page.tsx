"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

interface ApiError {
  code: string;
  message: string;
  details?: string[];
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: ApiError };
    return (
      body.error?.details?.join(" ") ?? body.error?.message ?? "Sign up failed"
    );
  } catch {
    return "Sign up failed";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setSubmitting(false);
      setError(await readError(response));
      return;
    }

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      router.push("/login");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="login-card">
      <span className="brandmark brandmark-lg">go</span>
      <h1 className="login-title">Create an account</h1>
      <p className="lede">
        Any account can create and manage its own shortcuts.
      </p>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-user">Username</label>
          <input
            id="signup-user"
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="jane"
            minLength={3}
            maxLength={32}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-pw">Password</label>
          <div className="pw-wrap">
            <input
              id="signup-pw"
              className="plain"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
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
        <div className="field">
          <label htmlFor="signup-pw-confirm">Confirm password</label>
          <input
            id="signup-pw-confirm"
            className="input"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-block login-submit"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="login-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
