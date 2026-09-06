/**
 * Google Meet link utilities
 * Handles validation, normalization and formatting for meet.google.com links
 */

/**
 * Check if string is a valid Google Meet link
 * Accepts: https://meet.google.com/abc-defg-hij, https://meet.google.com/xxx-xxxx-xxx, meet.google.com/...
 * @param {string} link
 * @returns {boolean}
 */
function isValidMeetLink(link) {
    if (!link || typeof link !== 'string') return false;
    const trimmed = link.trim();
    if (!trimmed) return false;
    // Basic meet.google.com pattern
    // Allows https://meet.google.com/xxx-xxxx-xxx or https://meet.google.com/abc-defg-hij (3-4 segments)
    const pattern = /^(https?:\/\/)?(meet\.google\.com\/[a-z0-9\-]+(\/[a-z\-]*)?)(\?.*)?$/i;
    // Also allow generic https links for flexibility (fallback)
    if (pattern.test(trimmed)) return true;
    // For non-meet links (zoom, teams), still consider valid if it's a https URL
    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        return url.protocol === 'https:' && url.hostname.includes('.');
    } catch {
        return false;
    }
}

/**
 * Normalize meet link to ensure https:// prefix
 * @param {string} link
 * @returns {string} normalized link or original trimmed if invalid
 */
function normalizeMeetLink(link) {
    if (!link || typeof link !== 'string') return '';
    let trimmed = link.trim();
    if (!trimmed) return '';
    // If already valid URL with protocol, return as is
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Otherwise prepend https://
    if (trimmed.startsWith('meet.google.com')) {
        return `https://${trimmed}`;
    }
    // For other domains without protocol
    if (trimmed.includes('.')) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

/**
 * Extract meet code from link (e.g., abc-defg-hij)
 * @param {string} link
 * @returns {string|null}
 */
function extractMeetCode(link) {
    if (!link) return null;
    const normalized = normalizeMeetLink(link);
    const match = normalized.match(/meet\.google\.com\/([a-z0-9\-]+)/i);
    return match ? match[1] : null;
}

/**
 * Format meet link for WhatsApp message (adds fallback text if missing/invalid)
 * @param {string} link
 * @param {object} opts - { fallbackText }
 * @returns {string}
 */
function formatMeetLink(link, opts = {}) {
    const fallback = opts.fallbackText || 'Meet link will be shared shortly. Please wait for update in group.';
    if (!link) return fallback;
    const normalized = normalizeMeetLink(link);
    if (!isValidMeetLink(normalized)) {
        return `${normalized} (Please verify link before joining)`;
    }
    return normalized;
}

// ---------------- Google Form link utilities ----------------

/**
 * Check if string is a valid Google Form link
 * Accepts: https://docs.google.com/forms/... , https://forms.gle/..., https://forms.google.com/...
 * @param {string} link
 * @returns {boolean}
 */
function isValidFormLink(link) {
    if (!link || typeof link !== 'string') return false;
    const trimmed = link.trim();
    if (!trimmed) return false;
    const pattern = /^(https?:\/\/)?(docs\.google\.com\/forms|forms\.gle|forms\.google\.com)\/.+/i;
    if (pattern.test(trimmed)) return true;
    // Fallback: any valid https URL
    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        return url.protocol === 'https:' && url.hostname.includes('.');
    } catch {
        return false;
    }
}

/**
 * Normalize form link to ensure https://
 * @param {string} link
 * @returns {string}
 */
function normalizeFormLink(link) {
    if (!link || typeof link !== 'string') return '';
    let trimmed = link.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes('docs.google.com') || trimmed.includes('forms.gle') || trimmed.includes('forms.google.com')) {
        return `https://${trimmed}`;
    }
    if (trimmed.includes('.')) return `https://${trimmed}`;
    return trimmed;
}

/**
 * Format form link for WhatsApp message
 * @param {string} link
 * @param {object} opts - { fallbackText }
 * @returns {string}
 */
function formatFormLink(link, opts = {}) {
    const fallback = opts.fallbackText || '';
    if (!link) return fallback;
    const normalized = normalizeFormLink(link);
    if (!isValidFormLink(normalized)) {
        return `${normalized} (Please verify link)`;
    }
    return normalized;
}

module.exports = {
    isValidMeetLink,
    normalizeMeetLink,
    extractMeetCode,
    formatMeetLink,
    isValidFormLink,
    normalizeFormLink,
    formatFormLink
};
