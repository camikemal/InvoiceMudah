'use client';

/**
 * /profile — personal details and password
 * Name and phone live in public.profiles (also mirrored to auth user metadata
 * so the header can show the name without an extra query).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/Toast';
import { friendlyDbError } from '@/lib/invoices';
import { firstError, passwordChangeSchema, profileSchema } from '@/lib/validation';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      setEmail(user.email ?? '');
      setMemberSince(
        new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      );

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      setFullName(profile?.full_name ?? user.user_metadata?.full_name ?? '');
      setPhone(profile?.phone ?? user.user_metadata?.phone ?? '');
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = firstError(profileSchema, { full_name: fullName, phone });
    if (err) { setProfileError(err); return; }
    setProfileError('');
    setSavingProfile(true);

    const details = { full_name: fullName.trim(), phone: phone.trim() || null };
    const { data, error } = await supabase
      .from('profiles')
      .update(details)
      .eq('id', userId)
      .select('id');

    if (!error && (!data || data.length === 0)) {
      setSavingProfile(false);
      setProfileError('Profile record not found. Please contact support.');
      return;
    }
    if (!error) {
      await supabase.auth.updateUser({ data: details });
    }

    setSavingProfile(false);
    if (error) {
      setProfileError(friendlyDbError(error));
    } else {
      toast.success('Profile updated');
      router.refresh();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = firstError(passwordChangeSchema, {
      current: currentPassword,
      next: newPassword,
      confirm: confirmPassword,
    });
    if (err) { setPasswordError(err); return; }
    setPasswordError('');
    setSavingPassword(true);

    // Supabase does not check the old password on update, so verify it first.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyErr) {
      setSavingPassword(false);
      setPasswordError('Current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password changed');
  };

  if (loading) return <div className="page-loading"><div className="spinner" />Loading…</div>;

  const initials = (fullName.trim() || email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <Link href="/dashboard" className="app-logo flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={24} height={24} className="rounded-sm object-contain" />
            <span>Invoice Mudah</span>
          </Link>
        </div>
        <div className="app-header-actions">
          <span className="app-header-title">Profile</span>
          <Link href="/dashboard" className="app-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Dashboard
          </Link>
        </div>
      </header>

      <main className="app-main app-main--narrow">
        <div className="profile-hero">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <div>
            <h1 className="biz-detail-name">{fullName.trim() || 'Your profile'}</h1>
            <p className="biz-detail-meta">{email}</p>
            <p className="biz-detail-meta">Member since {memberSince}</p>
          </div>
        </div>

        <section className="profile-card">
          <h2 className="profile-card-title">Personal details</h2>
          <form onSubmit={handleSaveProfile} className="biz-form">
            <div className="biz-form-grid">
              <div className="form-field form-field--full">
                <label htmlFor="profile-name">Full name</label>
                <input
                  id="profile-name"
                  autoComplete="name"
                  placeholder="e.g. Akmal Hakim"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="profile-phone">Phone</label>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 012 345 6789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="profile-email">Email</label>
                <input id="profile-email" value={email} disabled readOnly />
              </div>
            </div>
            {profileError && <p className="form-error" role="alert">{profileError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </form>
        </section>

        <section className="profile-card">
          <h2 className="profile-card-title">Change password</h2>
          <form onSubmit={handleChangePassword} className="biz-form">
            <div className="biz-form-grid">
              <div className="form-field form-field--full">
                <label htmlFor="pw-current">Current password</label>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="pw-new">New password</label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="pw-confirm">Confirm new password</label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <p className="running-hint">At least 8 characters.</p>
            <p className="running-hint">Forgot your current password? <Link href="/forgot-password" className="auth-switch-link">Reset it with an email code</Link>.</p>
            {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
