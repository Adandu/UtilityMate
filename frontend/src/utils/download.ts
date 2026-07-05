/**
 * Shared helpers for downloading blob responses and previewing PDF blobs.
 * Consolidates logic that used to be duplicated across Dashboard, Rent,
 * RawData, Operations, Invoices, and AssociationStatements pages.
 */

/** Trigger a browser download for blob response data, then revoke the object URL. */
export function triggerBlobDownload(data: BlobPart, filename: string, mimeType?: string): void {
  const blob = new Blob([data], mimeType ? { type: mimeType } : undefined);
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revocation slightly so the download has time to start in every browser.
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

/** Extract a filename from a Content-Disposition header, falling back to a default. */
export function filenameFromContentDisposition(contentDisposition: string | undefined | null, fallback: string): string {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

/** Open blob response data (e.g. a PDF) in a new tab. */
export function openBlobInNewTab(data: BlobPart, mimeType: string): void {
  const blobUrl = window.URL.createObjectURL(new Blob([data], { type: mimeType }));
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
}
