// web scraper: extracts main content, preserves links as [text](url), filters UI noise.

const MAX_LENGTH = 100000;

// Lines whose text (link markdown stripped, trimmed) match any of these regexes are dropped.
// Add new ones here as you find noisy patterns on specific sites.
const NOISE_PATTERNS = [
    // General web UI
    /^accept (all )?cookies?$/i,
    /^(subscribe|sign up)( to .*)?$/i,
    /^sign (in|up|out)$/i,
    /^log (in|out)$/i,
    /^share on (facebook|twitter|x|linkedin|reddit|whatsapp|email|telegram|line|kakaotalk)$/i,
    /^back to top$/i,
    /^read more$/i,
    /^(load|show) more$/i,
    /^copy (link|to clipboard)$/i,

    // English Wikipedia
    /^jump to (content|navigation|search)$/i,
    /^from wikipedia, the free encyclopedia$/i,
    /^edit source$/i,
    /^view (history|source)$/i,
    /^toggle the table of contents$/i,
    /^this article needs additional citations/i,
    /^learn how and when to remove this (message|template)/i,
    /^\(redirected from /i,
    /^retrieved from ["']?https?:/i,
    /^hidden categor(y|ies):/i,
    /^coordinates:\s*\d+°/i,

    // Korean Wikipedia
    /^둘러보기로 이동$/,
    /^검색으로 이동$/,
    /^위키백과, 우리 모두의 백과사전$/,
    /^원본 주소 /,
    /^이 문서는 .*마지막으로 편집/,

    // namu.wiki
    /^최근 (변경|토론)$/,
    /^특수 기능$/,
    /^편집 요청( 닫기)?$/,
    /^편집 권한이 부족/,
    /^편집 보호된 문서/,
    /^ACL 탭$/,
    /^최근 수정 시각:/,
    /^이 문서는 아직 작성 중/,
    /^더 보기$/,
    /^(접기|펼치기)$/,
    /^공유하기$/,

    // GitHub
    /^skip to content$/i,
    /^toggle navigation$/i,
    /^(pull requests|codespaces|marketplace)$/i,
    /^you signed in with another tab/i,
    /^reload to refresh your session/i,
    /^we read every piece of feedback/i,
    /^go to file$/i,
    /^latest commit$/i,
    /^\d+ commits?$/i,
    /^\d+ contributors?$/i,
    /^view all files$/i,
    /^no description, website, or topics provided\.?$/i,
    /^report abuse$/i,
    /^download zip$/i,

    // Stack Overflow
    /^asked \d+ (year|month|week|day|hour|minute|second)s? ago$/i,
    /^answered \d+ (year|month|week|day|hour|minute|second)s? ago$/i,
    /^edited \d+ (year|month|week|day|hour|minute|second)s? ago$/i,
    /^improve this (question|answer)$/i,
    /^browse other questions tagged/i,
    /^not the answer you're looking for\?/i,
    /^add a comment$/i,
    /^show \d+ more comments?$/i,

    // Medium
    /^\d+\s*min read$/i,
    /^member-only story$/i,
    /^get the medium app$/i,

    // Reddit
    /^continue in app$/i,
    /^\d+\s*(points?|comments?)$/i,
    /^\d+\s*(upvotes?|downvotes?)$/i,
    /^\d+\s*(year|month|week|day|hour|minute)s?\s*ago$/i,
    /^forgot (your )?(username|password)/i,
    /^view \d+ (more )?(comments?|replies|repl(y|ies))/i,
    /^show parent comments?$/i,
    /^collapse thread$/i,
];

const dropNoise = (text) =>
    text
        .split('\n')
        .filter((line) => {
            const stripped = line.replace(/\[([^\]]+)\]\((?:[^()]+|\([^()]*\))*\)/g, '$1').trim();
            if (!stripped) return true;
            return !NOISE_PATTERNS.some((p) => p.test(stripped));
        })
        .join('\n');

const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'dclid', 'yclid',
    '_hsenc', '_hsmi', '__hstc', '__hssc', '__hsfp', 'hsCtaTracking',
    'mc_cid', 'mc_eid', 'igshid', '__twitter_impression'
]);

const cleanUrl = (href, baseUrl) => {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed) return null;
    if (/^(javascript:|mailto:|tel:|data:)/i.test(trimmed)) return null;
    if (trimmed.startsWith('#')) return null;

    let url;
    try {
        url = new URL(trimmed, baseUrl);
    } catch {
        return null;
    }

    for (const param of [...url.searchParams.keys()]) {
        if (TRACKING_PARAMS.has(param)) url.searchParams.delete(param);
    }

    const decode = (s) => {
        try { return decodeURI(s); } catch { return s; }
    };

    if (baseUrl) {
        try {
            const base = new URL(baseUrl);
            if (url.origin === base.origin) {
                return decode(url.pathname + url.search + url.hash);
            }
        } catch {}
    }

    return decode(url.toString());
};

const convertLinks = (html, baseUrl) =>
    html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, inner) => {
        const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i);
        const innerText = inner
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!innerText) return '';
        if (!hrefMatch) return innerText;
        const cleaned = cleanUrl(decodeEntities(hrefMatch[1]), baseUrl);
        if (!cleaned) return innerText;
        return `[${innerText}](${cleaned})`;
    });

const extractTitle = (html) => {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return '';
    return decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
};

const extractMainContent = (html) => {
    const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) return mainMatch[1];

    const articleMatches = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
    if (articleMatches.length > 0) return articleMatches.map((m) => m[1]).join('\n\n');

    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) return bodyMatch[1];

    return html;
};

const removeNoiseBlocks = (s) =>
    s
        .replace(/<(nav|header|footer|aside|menu)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

const tagsToText = (s) =>
    s
        .replace(/<\/(p|div|h[1-6]|li|tr)[^>]*>/gi, '\n')
        .replace(/<(br|hr)\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

const safeFromCodePoint = (cp) => {
    try { return String.fromCodePoint(cp); } catch { return ''; }
};

const decodeEntities = (s) =>
    s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…')
        .replace(/&lsquo;/g, '‘')
        .replace(/&rsquo;/g, '’')
        .replace(/&ldquo;/g, '“')
        .replace(/&rdquo;/g, '”')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&trade;/g, '™')
        .replace(/&deg;/g, '°')
        .replace(/&middot;/g, '·')
        .replace(/&bull;/g, '•')
        .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCodePoint(parseInt(h, 16)));

const normalizeWhitespace = (s) =>
    s
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

const stripHtml = (html, baseUrl) => {
    let content = extractMainContent(html);
    content = removeNoiseBlocks(content);
    content = convertLinks(content, baseUrl);
    content = tagsToText(content);
    content = decodeEntities(content);
    return normalizeWhitespace(content);
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

        const contentType = response.headers.get('content-type') || '';
        if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
            return `Error: content-type is ${contentType || 'unknown'}, not HTML.`;
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 5_000_000) {
            return `Error: page too large (${contentLength} bytes).`;
        }

        const html = await response.text();
        const title = extractTitle(html);
        let text = dropNoise(stripHtml(html, response.url || url));

        if (text.length > MAX_LENGTH) {
            const remaining = text.length - MAX_LENGTH;
            text = text.substring(0, MAX_LENGTH) + `\n\n[...truncated, ${remaining} more characters]`;
        }

        if (!text) return 'Page returned no readable text content.';
        return title ? `# ${title}\n\n${text}` : text;
    } catch (error) {
        return `Error fetching URL: ${error.message}`;
    }
};

const declaration = {
    type: "function",
    function: {
        name: "web_fetch",
        description: `Fetches a web page by URL and returns its text content with HTML stripped and hyperlinks preserved as [text](url).

This is a raw HTTP fetcher — it does NOT execute JavaScript. Pages that render entirely client-side (modern SPAs) will return empty or near-empty content. When possible, prefer server-rendered / no-JS versions of a site:

- Reddit → use https://old.reddit.com/... (not www.reddit.com)
- Google Search is blocked for scrapers; use DuckDuckGo instead → https://html.duckduckgo.com/html/?q=YOUR+QUERY
- Twitter/X → usually unfetchable without JS; skip or try an alternative source
- For documentation, Wikipedia, GitHub repos, blogs, news articles: use the normal URL, they render server-side.

Use this to read articles, documentation, search results, or any web page content.`,
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
