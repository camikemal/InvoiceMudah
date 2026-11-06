import Image from 'next/image';

interface AuthShellProps {
  panelLabel: string;
  panelHeadline: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Two-panel layout shared by the password recovery pages */
export default function AuthShell({ panelLabel, panelHeadline, title, subtitle, children }: AuthShellProps) {
  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="auth-panel-logo">
          <Image src="/logo.jpeg" alt="Invoice Mudah" width={48} height={48} className="rounded-md object-contain" style={{ width: 'auto', height: 'auto' }} />
        </div>
        <div className="auth-panel-content">
          <p className="auth-panel-label">{panelLabel}</p>
          <h2 className="auth-panel-headline">{panelHeadline}</h2>
        </div>
        <div className="auth-panel-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-logo auth-logo-row">
            <Image src="/logo.jpeg" alt="Invoice Mudah" width={48} height={48} className="rounded-md object-contain" style={{ width: 'auto', height: 'auto' }} />
            <span className="auth-logo-text">Invoice Mudah</span>
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
