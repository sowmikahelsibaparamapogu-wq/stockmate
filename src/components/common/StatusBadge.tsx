import React from 'react';

export type StatusType = 'Draft' | 'Waiting' | 'Ready' | 'Done' | 'Canceled' | 'Sent' | 'Partially Received' | 'Received' | string;

interface StatusBadgeProps {
  status: StatusType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let colorStyle = 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';

  switch (status?.toLowerCase()) {
    case 'draft':
      colorStyle = 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
      break;
    case 'waiting':
    case 'partially received':
      colorStyle = 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      break;
    case 'ready':
    case 'sent':
      colorStyle = 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
      break;
    case 'done':
    case 'received':
      colorStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      break;
    case 'canceled':
    case 'rejected':
    case 'out_of_stock':
      colorStyle = 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900';
      break;
    default:
      colorStyle = 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorStyle}`}
    >
      {status}
    </span>
  );
};
