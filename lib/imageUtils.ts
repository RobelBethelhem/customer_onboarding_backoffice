// Image utility functions for handling base64 images

// Default placeholder for missing photos - SVG "No Photo" image
// Matches placeholder in lib/models/Customer.ts
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBQaG90bzwvdGV4dD48L3N2Zz4=';

// "Not Captured" placeholder for liveness photos that were never taken
export const NOT_CAPTURED_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2ZlZjNjNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNDUlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5MjQwMGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob3QgQ2FwdHVyZWQ8L3RleHQ+PC9zdmc+';

/**
 * Ensures a string is a valid data URI for images.
 * - Returns placeholder if empty/null/undefined
 * - Returns as-is if already a valid data URI
 * - Adds data:image/jpeg;base64, prefix if raw base64 data
 *
 * @param base64String - The image data (could be raw base64 or data URI)
 * @param usePlaceholder - Which placeholder to use ('default' or 'not_captured')
 * @returns A valid data URI string
 */
export function ensureDataUri(
  base64String: string | undefined | null,
  usePlaceholder: 'default' | 'not_captured' = 'default'
): string {
  // Handle empty/null/undefined
  if (!base64String || base64String.trim() === '') {
    return usePlaceholder === 'not_captured' ? NOT_CAPTURED_PLACEHOLDER : PLACEHOLDER_IMAGE;
  }

  // Already a valid data URI - return as-is
  if (base64String.startsWith('data:image')) {
    return base64String;
  }

  // Check if it looks like valid base64 data (alphanumeric + /+=)
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  const cleanBase64 = base64String.replace(/\s/g, '');

  if (!base64Regex.test(cleanBase64)) {
    console.warn('Invalid base64 data detected, using placeholder');
    return usePlaceholder === 'not_captured' ? NOT_CAPTURED_PLACEHOLDER : PLACEHOLDER_IMAGE;
  }

  // Add data URI prefix for JPEG (most common for photos)
  return `data:image/jpeg;base64,${cleanBase64}`;
}

/**
 * Check if a photo appears to be a valid image (not empty/placeholder)
 * Supports multi-document strings joined with ||| delimiter
 * @param photoData - The photo data string
 * @returns boolean indicating if photo has real data
 */
export function hasValidPhoto(photoData: string | undefined | null): boolean {
  if (!photoData || photoData.trim() === '') {
    return false;
  }

  // Check if it's a known placeholder
  if (photoData === PLACEHOLDER_IMAGE || photoData === NOT_CAPTURED_PLACEHOLDER) {
    return false;
  }

  // Check if it's the model's default placeholder (from Customer.ts)
  if (photoData.includes('Tm8gUGhvdG8=')) { // "No Photo" base64
    return false;
  }

  // Multi-document: if contains ||| delimiter, check first part
  if (photoData.includes('|||')) {
    const firstPart = photoData.split('|||')[0];
    return firstPart.length > 100;
  }

  // Check if it's a valid data URI or base64
  if (photoData.startsWith('data:image')) {
    // Has data URI prefix - check if there's actual content after prefix
    const base64Part = photoData.split(',')[1];
    return !!base64Part && base64Part.length > 100; // Arbitrary minimum for real image
  }

  // Raw base64 - check if it looks valid and has enough content
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  const cleanBase64 = photoData.replace(/\s/g, '');
  return base64Regex.test(cleanBase64) && cleanBase64.length > 100;
}
