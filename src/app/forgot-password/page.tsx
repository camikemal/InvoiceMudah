"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <AuthShell
      panelLabel="Forgot password"
      panelHeadline="We'll help you get back in"
      title="Reset password"
      subtitle="Enter the email you signed up with and we'll send you a link to set a new password."
    >
      {sent ? (
        <div className="auth-form">
          <p className="form-success">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam folder).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">
              Your email
            </label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="e.g. akmal@example.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="auth-switch">
        Remembered it?{" "}
        <Link href="/login" className="auth-switch-link">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
