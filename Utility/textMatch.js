// Builds a regex that matches `text` while ignoring all whitespace and Unicode normalization
// differences: Korean spacing (띄어쓰기) drift, NBSP, CRLF, indentation, NFD vs NFC Hangul.
// The haystack must be .normalize('NFC')'d by the caller. `flags` must include 'u'.
const looseRegex = (text, flags = 'u') => {
    const chars = [...text.normalize('NFC').replace(/\s+/g, '')];
    if (chars.length === 0) return null;
    const escaped = chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(escaped.join('\\s*'), flags);
};

module.exports = { looseRegex };
