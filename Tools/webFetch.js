/**
 * Fetches a URL and returns raw text content with HTML, JS, and CSS stripped.
 * Uses native fetch() — no external packages.
 */

const MAX_LENGTH = 4000; // Cap output to avoid flooding the AI context

/**
 * Crude HTML-to-text converter using regex.
 * Not perfect, but good enough for most pages.
 */
const stripHtml = (html) => {
    // Step 1: Extract body only (skip head, meta, SEO junk)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let content = bodyMatch ? bodyMatch[1] : html;

    // Step 2: Remove site chrome (nav, header, footer, sidebar, menus)
    content = content.replace(/<(nav|header|footer|aside|menu)[^>]*>[\s\S]*?<\/\1>/gi, '');

    return content
        // Remove script/style blocks entirely
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Replace common block elements with newlines
        .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        // Strip all remaining tags
        .replace(/<[^>]+>/g, '')
        // Decode common HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Decode numeric entities like &#91; -> [ and &#8217; -> '
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        // Collapse whitespace
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
};

const handler = async ({ url }) => {
    if (!url) return 'Error: No URL provided.';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            return `Error: HTTP ${response.status} ${response.statusText}`;
        }

        const html = await response.text();
        let text = stripHtml(html);

        if (text.length > MAX_LENGTH) {
            text = text.substring(0, MAX_LENGTH) + '\n\n[...truncated]';
        }

        return text || 'Page returned no readable text content.';
    } catch (error) {
        return `Error fetching URL: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "webFetch",
        description: "Fetches a web page by URL and returns its text content with all HTML, JavaScript, and CSS removed. Use this to read articles, documentation, or any web page content.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The full URL to fetch (must include http:// or https://)"
                }
            },
            required: ["url"]
        }
    }
};

module.exports = { handler, declaration };
