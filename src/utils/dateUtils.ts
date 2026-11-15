/**
 * Universal date & timestamp formatting utilities for FrontDesk Pro
 */

export const formatFullTimestamp = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return `${d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} at ${d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  } catch {
    return String(isoString);
  }
};

export const formatShortTimestamp = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return `${d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} ${d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  } catch {
    return String(isoString);
  }
};
