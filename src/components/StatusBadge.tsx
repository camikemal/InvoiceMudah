import type { DisplayStatus } from '@/types/invoice';

const LABELS: Record<DisplayStatus, string> = {
  DRAFT: 'Draft',
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  OVERDUE: 'Overdue',
};

export default function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
