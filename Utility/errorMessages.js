// Normalized provider error categories + user-facing formatter.
// Providers map their raw errors (HTTP status, API error codes, finish reasons) to one of these categories.
// This keeps message wording consistent regardless of which provider is active.

const CATEGORIES = {
    AUTH: 'auth',
    QUOTA: 'quota',
    RATE_LIMIT: 'rate_limit',
    SAFETY: 'safety',
    TRUNCATED: 'truncated',
    UPSTREAM: 'upstream',
    NETWORK: 'network',
    MODEL_NOT_FOUND: 'model_not_found',
    UNKNOWN: 'unknown',
};

const messageFor = {
    auth: (p) => `${p} rejected the API key. Check your config.`,
    quota: (p) => `${p} quota/credits exhausted.`,
    rate_limit: (p) => `Hit ${p}'s rate limit — try again in a moment.`,
    safety: (p) => `${p} safety filter blocked the response.`,
    truncated: () => `[response cut off — hit token limit]`,
    upstream: (p) => `${p} is having issues right now. Try again shortly.`,
    network: (p) => `Couldn't reach ${p} — network issue.`,
    model_not_found: (p, detail) => `${p}: ${detail || 'requested model not available'}.`,
    unknown: (p, detail) => `${p} error${detail ? `: ${detail}` : ''}.`,
};

const formatProviderError = ({ category, detail, providerName } = {}) => {
    const p = providerName || 'Provider';
    const fn = messageFor[category] || messageFor.unknown;
    return fn(p, detail);
};

module.exports = { CATEGORIES, formatProviderError };
