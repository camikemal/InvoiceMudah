"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import AuthShell from "@/components/AuthShell";

/** Supabase's email OTP length is configurable (6 by default, up to 10). */
const CODE_PATTERN = /^\d{6,10}$/;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState<false | "send" | "verify">(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendCode = async () => {
    setError("");
    setNotice("");
    setLoading("send");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendCode()) setStep("code");
  };

  const handleResend = async () => {
    if (await sendCode()) setNotice("A new code is on its way.");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const token = code.replace(/\s/g, "");
    if (!CODE_PATTERN.test(token)) {
      setError("Enter the code from the email (numbers only).");
      return;
    }

    setLoading("verify");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "recovery",
    });
    setLoading(false);

    if (error) {
      setError("That code is invalid or has expired. Check the latest email or request a new code.");
      return;
    }
    router.push("/reset-password");
    router.refresh();
  };

  return (
    <AuthShell
      panelLabel="Forgot password"
      panelHeadline="We'll help you get back in"
      title="Reset password"
      subtitle={
        step === "email"
          ? "Enter the email you signed up with and we'll send you a verification code."
          : "Enter the verification code we emailed you to continue."
      }
    >
      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="auth-form">
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

          <button type="submit" className="auth-btn" disabled={!!loading}>
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="auth-form">
          <p className="form-success">
            If an account exists for <strong>{email}</strong>, a code is on its way. Check your inbox (and spam folder).
          </p>

          <div className="auth-field">
            <label className="auth-label" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              className="auth-input"
              placeholder="e.g. 123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="form-success">{notice}</p>}

          <button type="submit" className="auth-btn" disabled={!!loading}>
            {loading === "verify" ? "Checking…" : "Verify code"}
          </button>

          <p className="auth-switch">
            Didn&apos;t get it?{" "}
            <button type="button" className="auth-switch-link" onClick={handleResend} disabled={!!loading}>
              {loading === "send" ? "Sending…" : "Resend code"}
            </button>
            {" · "}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
                setNotice("");
              }}
              disabled={!!loading}
            >
              Use a different email
            </button>
          </p>
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
