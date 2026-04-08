"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface SignOutButtonProps {
  email?: string | null;
}

export default function SignOutButton({ email }: SignOutButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const accountName = email?.split("@")[0] ?? "Account";
  const avatarText = (accountName[0] ?? "A").toUpperCase();

  useEffect(() => {
    if (!showConfirm && !showMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showConfirm) {
          setShowConfirm(false);
          return;
        }

        setShowMenu(false);
      }
    };

    const handleClickOutside = (event: PointerEvent) => {
      if (!showMenu) return;
      if (!menuRef.current) return;

      const target = event.target;
      if (!(target instanceof Node)) {
        setShowMenu(false);
        return;
      }

      if (menuRef.current.contains(target)) return;
      setShowMenu(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [showConfirm, showMenu]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <div className="profile-menu" ref={menuRef}>
        <button
          type="button"
          className="profile-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={showMenu}
          onClick={() => setShowMenu(value => !value)}
        >
          <span className="profile-menu-avatar" aria-hidden="true">{avatarText}</span>
          {/* <span className="profile-menu-label">Profile</span> */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {showMenu && (
          <div className="profile-menu-dropdown" role="menu" aria-label="Profile menu">
            <div className="profile-menu-user">
              <div className="profile-menu-name">{accountName}</div>
              <div className="profile-menu-email">{email || "No email"}</div>
            </div>
            <button
              type="button"
              className="profile-menu-signout"
              onClick={() => {
                setShowMenu(false);
                setShowConfirm(true);
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowConfirm(false)}
          role="presentation"
        >
          <div
            className="modal-content signout-modal-content"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-modal-title"
            aria-describedby="signout-modal-desc"
          >
            <header className="modal-header">
              <h2 id="signout-modal-title">Sign out?</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowConfirm(false)}
                aria-label="Close sign out confirmation"
              >
                ×
              </button>
            </header>

            <div className="signout-modal-body" id="signout-modal-desc">
              <p>Are you sure you want to sign out of your account?</p>
            </div>

            <footer className="modal-footer signout-modal-footer">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
