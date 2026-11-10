/**
 * Web research pipeline cho luồng tạo đề từ web (thay thế logic trong server.ts).
 *
 * Các sửa lỗi chính so với phiên bản trước:
 *  1. KHÔNG phụ thuộc Wikipedia: Wikipedia là nguồn bổ sung (REFERENCE), chỉ được
 *     gọi khi không đủ nguồn chính thức, và bị chặn khi trả HTTP 429.
 *  2. Ưu tiên tài liệu chính thức của Python (docs.python.org controlflow /
 *     datastructures) khi chủ đề là Python, tìm kiếm theo từng focus area.
 *  3. Bộ lọc URL không liên quan (máy bay, FAFSA, quảng cáo...) + whitelist
 *     tên miền tài liệu lập trình đáng tin cậy.
 *  4. HTTP 429 được xử lý bằng backoff + Retry-After, giới hạn số lần retry.
 *  5. Giới hạn số URL tải mỗi lần, loại bỏ URL trùng.
 *  6. Xác minh từng focus area độc lập, ghi nhận bằng chứng (nguồn + đoạn trích),
 *     không tái tìm kiếm những phạm vi đã xác minh.
 */
import { generateAiContent } from './aiProvider';
import { withGeminiTimeout, AI_STEP_TIMEOUT_MS } from './aiErrors';

// ===== Hằng số cấu hình =====
export const WEB_FETCH_TIMEOUT_MS = 12_000;
const MAX_FETCH_URLS_PER_ROUND = 8; // giới hạn số URL tải mỗi vòng
const MAX_TOTAL_SOURCES = 10;
const MAX_RETRIES_429 = 1; // số lần retry tối đa khi gặp HTTP 429
const DEFAULT_429_BACKOFF_MS = 5_000;
const MAX_429_BACKOFF_MS = 15_000;
const MIN_PAGE_TEXT_LENGTH = 250;

export interface WebSource {
  title: string;
  url: string;
  domain: string;
  source_type: string;
  summary: string;
  content: string;
}

export interface KnowledgeUnit {
  name: string;
  summary: string;
  category: string;
  focus_area: string;
  source_title: string;
  source_url: string;
  source_excerpt: string;
}

// ===== Phân loại nguồn =====
export function classifySourceType(domain: string): string {
  const lower = (domain || '').toLowerCase();
  if (lower === 'docs.python.org' || lower === 'python.org' || lower.endsWith('.python.org')) return 'OFFICIAL';
  if (lower.includes('developer.mozilla.org')) return 'OFFICIAL';
  if (lower === 'react.dev' || lower.endsWith('.react.dev')) return 'OFFICIAL';
  if (lower.includes('djangoproject.com')) return 'OFFICIAL';
  if (lower.includes('postgresql.org')) return 'OFFICIAL';
  if (lower.includes('nodejs.org') || lower.includes('golang.org') || lower.includes('rust-lang.org')) return 'OFFICIAL';
  if (lower === 'wikipedia.org' || lower.endsWith('.wikipedia.org')) return 'REFERENCE';
  if (lower.endsWith('.edu') || lower.includes('ac.') || lower.includes('university')) return 'UNIVERSITY';
  if (lower.endsWith('.gov')) return 'GOVERNMENT';
  if (lower.includes('tutorialspoint.com') || lower.includes('geeksforgeeks.org') || lower.includes('w3schools.com')) return 'EDUCATIONAL';
  return 'OTHER';
}

/** Domain đáng tin cậy để làm nguồn nghiên cứu (loại OTHER bị loại). */
export function eligibleSourceDomain(domain: string): boolean {
  return classifySourceType(domain) !== 'OTHER';
}

// ===== Bộ lọc URL không liên quan =====
// Lỗi thực tế từ log: DDG trả fafsa.gov (từ "data"?), trang FAA, quảng cáo...
const OFF_TOPIC_URL_PATTERNS: RegExp[] = [
  /fafsa/i,
  /\bfaa\b/i,
  /studentaid/i,
  /\bfaf\b/i,
  /\baircraft\b|\baviation\b|\bflying\b|\bdrone\b/i,
  /\bvisa\b|\bpassport\b|\bimmigration\b/i,
  /\bcasino\b|\bbetting\b|\bpoker\b/i,
  /\bjobs?\b|careerbuilder|indeed\.com|glassdoor/i,
  /\bshopping\b|\bamazon\.com\b|\bebay\b|\bshop\b/i,
  /\bpinterest\b|\bfacebook\b|\btiktok\b|\binstagram\b/i,
  /\bporn\b|\bxxx\b/i,
  /stackoverflow\.com\/questions/i,
  /reddit\.com/i,
  /quora\.com/i,
  /medium\.com/i,
  /youtube\.com|youtu\.be/i,
  /udemy\.com|coursera\.org/i,
  /\.pdf$|\.zip$|\.exe$|\.apk$/i,
];

/** Từ khóa chủ đề phải xuất hiện ở tiêu đề/URL/domain để nguồn được coi là liên quan. */
export function isOffTopicUrl(url: string, topicTerms: string[] = []): boolean {
  const lower = (url || '').toLowerCase();
  if (!/^https?:\/\//.test(lower)) return true;
  if (OFF_TOPIC_URL_PATTERNS.some((pattern) => pattern.test(lower))) return true;
  // Nếu có từ khóa chủ đề (ví dụ "python", "javascript"), URL phải liên quan.
  if (topicTerms.length > 0) {
    const mentionsTopic = topicTerms.some((term) => lower.includes(term.toLowerCase()));
    if (!mentionsTopic) return true;
  }
  return false;
}

/** Trích từ khóa chủ đề từ topic + focus areas (tiếng Anh, tối thiểu 3 ký tự). */
export function extractTopicTerms(texts: string[]): string[] {
  const vietnameseTerms = ['python', 'javascript', 'java', 'c++', 'c#', 'sql', 'html', 'css', 'react', 'django', 'node', 'git', 'linux', 'excel'];
  const combined = texts.join(' ').toLowerCase();
  const found = vietnameseTerms.filter((term) => combined.includes(term));
  return Array.from(new Set(found));
}

// ===== Tải trang có retry/backoff cho HTTP 429 =====
const domainCooldown = new Map<string, number>();

/** Tôn trọng cooldown của domain (sau 429). Trả về số ms cần chờ, 0 nếu ổn. */
export function getDomainCooldownRemaining(domain: string, now = Date.now()): number {
  const until = domainCooldown.get(domain) || 0;
  return Math.max(0, until - now);
}

export function setDomainCooldown(domain: string, durationMs: number, now = Date.now()): void {
  domainCooldown.set(domain, now + durationMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sleep có thể bị mock trong test. */
let sleepFn: (ms: number) => Promise<void> = sleep;
export function setSleepFunction(fn: (ms: number) => Promise<void>): void {
  sleepFn = fn;
}

export interface FetchPageResult {
  ok: boolean;
  status?: number;
  title?: string;
  url?: string;
  text?: string;
  error?: string;
}

/**
 * Tải một trang, xử lý HTTP 429 bằng backoff + Retry-After, giới hạn retry.
 * Hàm fetch có thể được thay thế trong test (dependency injection).
 */
export async function fetchPageWithRetry(
  url: string,
  opts: { fetchImpl?: typeof fetch; maxRetries?: number } = {}
): Promise<FetchPageResult> {
  const fetchImpl = opts.fetchImpl || fetch;
  const maxRetries = opts.maxRetries ?? MAX_RETRIES_429;
  const domain = safeHostname(url);
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cooldownRemaining = domain ? getDomainCooldownRemaining(domain) : 0;
    if (cooldownRemaining > 0) {
      await sleepFn(cooldownRemaining);
    }
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QuizAI/1.0; +https://example.com)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message.slice(0, 120)}` : String(error);
      return { ok: false, error: message, url };
    }
    if (response.ok) {
      const text = await response.text();
      return { ok: true, status: response.status, url, text };
    }
    if (response.status === 429 && attempt < maxRetries) {
      attempt += 1;
      const retryAfterHeader = response.headers?.get?.('retry-after') || '';
      let backoff = DEFAULT_429_BACKOFF_MS;
      const retryAfterSeconds = Number(retryAfterHeader);
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        backoff = Math.min(retryAfterSeconds * 1000, MAX_429_BACKOFF_MS);
      }
      if (domain) {
        setDomainCooldown(domain, backoff);
      }
      console.info('[AI Research] HTTP 429 — backoff trước khi thử lại.', { url, backoffMs: backoff, attempt });
      await sleepFn(backoff);
      continue;
    }
    return { ok: false, status: response.status, url, error: `HTTP ${response.status}` };
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ===== Chuẩn hóa HTML → text =====
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

export function stripHtmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

/** Tải + trích xuất nội dung trang; trả về null nếu không đạt chuẩn (rỗng/quá ngắn). */
export async function fetchSourcePageContent(
  url: string,
  opts: { fetchImpl?: typeof fetch; topicTerms?: string[] } = {}
): Promise<WebSource | null> {
  if (isOffTopicUrl(url, opts.topicTerms || [])) {
    console.info('[AI Research] Bỏ URL không liên quan.', { url });
    return null;
  }
  const result = await fetchPageWithRetry(url, { fetchImpl: opts.fetchImpl });
  if (!result.ok || !result.text) {
    console.info('[AI Research] Tải trang thất bại.', { url, status: result.status, error: result.error?.slice(0, 80) });
    return null;
  }
  const html = result.text;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtmlToText(titleMatch[1]).slice(0, 200) : 'Source';
  const text = stripHtmlToText(html);
  if (text.length < MIN_PAGE_TEXT_LENGTH) {
    console.info('[AI Research] Nội dung trang quá ngắn.', { url, textLength: text.length });
    return null;
  }
  return {
    title,
    url,
    domain: safeHostname(url),
    source_type: classifySourceType(safeHostname(url)),
    summary: text.slice(0, 500).trim(),
    content: text.slice(0, 8000),
  };
}

// ===== Nguồn chính thức được chọn sẵn (curated) =====
export const CURATED_SOURCE_HINTS: Array<{ match: RegExp; urls: string[] }> = [
  {
    match: /\bpython\b/gi,
    urls: [
      'https://docs.python.org/3/tutorial/introduction.html',
      'https://docs.python.org/3/tutorial/controlflow.html', // vòng lặp for/while
      'https://docs.python.org/3/tutorial/datastructures.html', // List, tuple, dict, set
      'https://docs.python.org/3/tutorial/classes.html',
      'https://docs.python.org/3/tutorial/errors.html',
      'https://docs.python.org/3/tutorial/inputoutput.html',
    ],
  },
  {
    match: /\bjavascript\b|\bjs\b/gi,
    urls: [
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions',
      'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/Variables',
    ],
  },
  {
    match: /\bsql\b|cơ sở dữ liệu/gi,
    urls: [
      'https://www.postgresql.org/docs/current/tutorial-sql.html',
      'https://www.postgresql.org/docs/current/tutorial-sql-select.html',
    ],
  },
  {
    match: /\bhtml\b|\bcss\b|thiết kế web/gi,
    urls: [
      'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/HTML_basics',
      'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/CSS_basics',
    ],
  },
];

/**
 * Gợi ý nguồn chính thức cho MỘT focus area cụ thể (không lấy toàn bộ chủ đề).
 * Ví dụ: focus "vòng lặp" → controlflow.html; focus "danh sách" → datastructures.html.
 */
export function collectCuratedSourceUrlsForArea(area: string, texts: string[]): string[] {
  const combined = [...texts, area].join('\n').toLowerCase();
  const lower = area.toLowerCase();
  const urls: string[] = [];
  for (const hint of CURATED_SOURCE_HINTS) {
    if (!hint.match.test(combined)) continue;
    hint.match.lastIndex = 0;
    // Nếu area nhắc rõ một chủ đề con của Python, chỉ lấy trang tương ứng.
    if (/\bpython\b/.test(combined)) {
      if (/v[oòô]?ng l[iặ]p|\bloop\b|\bfor\b|\bwhile\b|đi[eệ]u ki[eệ]n|\bif\b|\belse\b|control flow/i.test(lower)) {
        urls.push('https://docs.python.org/3/tutorial/controlflow.html');
      }
      if (/danh s[aá]ch|\blist\b|tuple|dictionary|\bdict\b|\bset\b|c[aá]u tr[uú]c d[uữ] li[eệ]u|data structure/i.test(lower)) {
        urls.push('https://docs.python.org/3/tutorial/datastructures.html');
      }
      if (/bi[eế]n|variable|h[aà]m|function|chu[oô]i|string|to[aá]n t[uử]|operator|nh[aậ]p|input|output/i.test(lower)) {
        urls.push('https://docs.python.org/3/tutorial/introduction.html');
      }
      if (/l[iệ]p tr[iì]nh h[uư][oớ]ng đ[oố]i t[uư][oợ]ng|\bclass\b|\boop\b|object/i.test(lower)) {
        urls.push('https://docs.python.org/3/tutorial/classes.html');
      }
      if (/ngo[aạ]i l[eệ]|exception|\berror\b/i.test(lower)) {
        urls.push('https://docs.python.org/3/tutorial/errors.html');
      }
    }
    urls.push(...hint.urls);
  }
  return Array.from(new Set(urls));
}

export function collectCuratedSourceUrls(texts: string[]): string[] {
  const combined = texts.join('\n').toLowerCase();
  const urls: string[] = [];
  for (const hint of CURATED_SOURCE_HINTS) {
    if (hint.match.test(combined)) urls.push(...hint.urls);
  }
  return Array.from(new Set(urls));
}

/** Tải nội dung danh sách URL (loại trùng, giới hạn số lượng). */
export async function fetchCuratedSources(
  urls: string[],
  opts: { fetchImpl?: typeof fetch; topicTerms?: string[]; maxUrls?: number } = {}
): Promise<WebSource[]> {
  const unique = Array.from(new Set(urls));
  const limited = unique.slice(0, opts.maxUrls ?? MAX_FETCH_URLS_PER_ROUND);
  const pages = await Promise.all(
    limited.map((url) => fetchSourcePageContent(url, { fetchImpl: opts.fetchImpl, topicTerms: opts.topicTerms }))
  );
  const items: WebSource[] = [];
  for (const page of pages) {
    if (!page) continue;
    items.push(page);
    if (items.length >= MAX_TOTAL_SOURCES) break;
  }
  return items;
}

// ===== Tìm kiếm web (DDG) =====
export function toSearchableQuery(text: string): string {
  const SEARCH_TERM_TRANSLATIONS: Array<[RegExp, string]> = [
    [/kiểu dữ liệu/gi, 'data types'],
    [/toán tử số học và logic|toán tử/gi, 'operators'],
    [/cấu trúc điều kiện[^,();]*/gi, 'control flow if else'],
    [/vòng lặp[^,();]*/gi, 'loops for while'],
    [/hàm cơ bản[^,();]*/gi, 'functions def return'],
    [/cấu trúc dữ liệu[^,();]*/gi, 'data structures list tuple dictionary'],
    [/lập trình hướng đối tượng/gi, 'object oriented programming'],
    [/biến và hằng số|biến/gi, 'variables'],
    [/chuỗi ký tự|chuỗi/gi, 'strings'],
    [/xử lý ngoại lệ|ngoại lệ/gi, 'exception handling'],
    [/danh sách|list/gi, 'list data structure'],
    [/cơ bản|nhập môn|giới thiệu/gi, 'basics tutorial'],
  ];
  let query = text.replace(/\([^)]*\)/g, ' ');
  for (const [pattern, replacement] of SEARCH_TERM_TRANSLATIONS) {
    query = query.replace(pattern, replacement);
  }
  return query.replace(/\s+/g, ' ').trim();
}

/** Tìm URL kết quả qua DuckDuckGo HTML (lite). */
export async function fetchDuckDuckGoHtmlResults(
  query: string,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const response = await (opts.fetchImpl || fetch)(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuizAI/1.0; +https://example.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.info('[AI Research] DDG HTML search non-OK.', { status: response.status });
      return [];
    }
    const html = await response.text();
    const matches = Array.from(html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g));
    const urls: string[] = [];
    for (const match of matches) {
      try {
        let href = match[1];
        if (href.startsWith('//')) href = `https:${href}`;
        const parsed = new URL(href, 'https://duckduckgo.com');
        const target = parsed.searchParams.get('uddg');
        if (target) urls.push(decodeURIComponent(target));
      } catch {
        continue;
      }
    }
    return Array.from(new Set(urls)).slice(0, 6);
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message.slice(0, 80)}` : String(error);
    console.info('[AI Research] DDG HTML search failed.', { reason });
    return [];
  }
}

/**
 * Tìm nguồn cho MỘT truy vấn: DDG HTML → lọc domain đáng tin cậy → tải nội dung.
 * Wikipedia KHÔNG được gọi từ đây (chỉ dùng như nguồn bổ sung riêng, xem dưới).
 */
export async function fetchSearchSourcesForQuery(
  query: string,
  opts: { fetchImpl?: typeof fetch; topicTerms?: string[]; maxSources?: number } = {}
): Promise<WebSource[]> {
  const maxSources = opts.maxSources ?? 2;
  const resultUrls = await fetchDuckDuckGoHtmlResults(query, { fetchImpl: opts.fetchImpl });
  const items: WebSource[] = [];
  for (const resultUrl of resultUrls) {
    if (items.length >= maxSources) break;
    const page = await fetchSourcePageContent(resultUrl, { fetchImpl: opts.fetchImpl, topicTerms: opts.topicTerms });
    if (!page) continue;
    if (!eligibleSourceDomain(page.domain)) {
      console.info('[AI Research] Loại nguồn domain không đáng tin cậy.', { url: page.url, domain: page.domain });
      continue;
    }
    items.push(page);
  }
  return items;
}

/**
 * Nguồn bổ sung từ Wikipedia — CHỈ dùng khi thiếu nguồn, và bị vô hiệu hóa tạm
 * thời sau khi gặp HTTP 429 (backoff). Trả về [] khi bị chặn/lỗi.
 */
export async function fetchWikipediaSources(
  topic: string,
  opts: { fetchImpl?: typeof fetch; maxSources?: number } = {}
): Promise<WebSource[]> {
  const maxSources = opts.maxSources ?? 2;
  const items: WebSource[] = [];
  const query = toSearchableQuery(topic) || topic;
  for (const language of ['vi', 'en']) {
    if (getDomainCooldownRemaining(`${language}.wikipedia.org`) > 0) {
      console.info('[AI Research] Bỏ qua Wikipedia (đang cooldown sau 429).', { language });
      continue;
    }
    try {
      const searchUrl = `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(query)}`;
      const response = await (opts.fetchImpl || fetch)(searchUrl, {
        headers: { 'User-Agent': 'QuizAI/1.0 (educational question research)' },
        signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers?.get?.('retry-after') || '');
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, MAX_429_BACKOFF_MS) : DEFAULT_429_BACKOFF_MS;
        setDomainCooldown(`${language}.wikipedia.org`, backoff);
        console.info('[AI Research] Wikipedia trả HTTP 429 — đặt cooldown và bỏ qua.', { language, backoffMs: backoff });
        continue;
      }
      if (!response.ok) {
        console.info('[AI Research] Wikipedia search non-OK.', { language, status: response.status });
        continue;
      }
      const data = await response.json();
      const hits = Array.isArray(data?.query?.search) ? data.query.search : [];
      for (const hit of hits) {
        if (items.length >= maxSources) break;
        const title = String(hit?.title || '').trim();
        if (!title) continue;
        const extractResult = await fetchWikipediaExtract(language, title, opts);
        if (!extractResult) continue;
        items.push({
          title: extractResult.title,
          url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(extractResult.title.replace(/\s+/g, '_'))}`,
          domain: `${language}.wikipedia.org`,
          source_type: 'REFERENCE',
          summary: extractResult.extract.slice(0, 500),
          content: extractResult.extract.slice(0, 8000),
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message.slice(0, 80)}` : String(error);
      console.info('[AI Research] Wikipedia search failed.', { language, reason });
      continue;
    }
  }
  return items;
}

/** Lấy extract đầy đủ cho MỘT trang Wikipedia (xử lý 429 với cooldown). */
async function fetchWikipediaExtract(
  language: string,
  title: string,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<{ title: string; extract: string } | null> {
  const apiUrl = `https://${language}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=8000&exlimit=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  try {
    const response = await (opts.fetchImpl || fetch)(apiUrl, {
      headers: { 'User-Agent': 'QuizAI/1.0 (educational question research)' },
      signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers?.get?.('retry-after') || '');
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, MAX_429_BACKOFF_MS) : DEFAULT_429_BACKOFF_MS;
      setDomainCooldown(`${language}.wikipedia.org`, backoff);
      console.info('[AI Research] Wikipedia extract trả HTTP 429 — đặt cooldown.', { language, backoffMs: backoff });
      return null;
    }
    if (!response.ok) return null;
    const data = await response.json();
    const pages = Object.values(data?.query?.pages || {}) as Array<any>;
    for (const page of pages) {
      const extract = String(page.extract || '').trim();
      if (extract.length >= 250) return { title: String(page.title || title), extract };
    }
    return null;
  } catch {
    return null;
  }
}

/** Loại trùng URL + giới hạn tổng số nguồn. */
export function dedupeSources(existing: WebSource[], incoming: WebSource[]): WebSource[] {
  const seen = new Set(existing.map((source) => source.url));
  const result = [...existing];
  for (const source of incoming) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    result.push(source);
    if (result.length >= MAX_TOTAL_SOURCES) break;
  }
  return result;
}

// ===== Tổng hợp kiến thức bằng Gemini =====
export interface SynthesisResult {
  units: KnowledgeUnit[];
  missingAreas: string[];
}

export async function synthesizeResearchKnowledge(
  topic: string,
  requirements: string,
  focusAreas: string[],
  sources: WebSource[]
): Promise<SynthesisResult> {
  // Ngân sách ngữ cảnh nguồn: giữ prompt trong giới hạn TPM của provider free
  // tier (≈ 22.000 ký tự tổng cho prompt). Ưu tiên nguồn OFFICIAL trước.
  const SOURCE_CONTEXT_BUDGET_CHARS = 20_000;
  const perSourceChar = Math.max(
    1200,
    Math.floor(SOURCE_CONTEXT_BUDGET_CHARS / Math.max(1, sources.length))
  );
  const orderedSources = [...sources].sort((left, right) => {
    const rank = (type: string) => (type === 'OFFICIAL' ? 0 : type === 'EDUCATIONAL' ? 1 : type === 'REFERENCE' ? 2 : 3);
    return rank(left.source_type) - rank(right.source_type);
  });
  const sourceParts: string[] = [];
  let usedChars = 0;
  orderedSources.forEach((source, index) => {
    const remaining = SOURCE_CONTEXT_BUDGET_CHARS - usedChars;
    if (remaining <= 500) return;
    const sliceLength = Math.min(perSourceChar, remaining);
    sourceParts.push(`[Nguồn ${index + 1}] ${source.title}\nURL: ${source.url}\n${source.content.slice(0, sliceLength)}`);
    usedChars += sliceLength + source.title.length + source.url.length + 30;
  });
  const sourceContext = sourceParts.join('\n\n');
  const response = await withGeminiTimeout(
    (abortSignal) =>
      generateAiContent({
        prompt: `Tổng hợp đơn vị kiến thức cốt lõi cho bộ đề về "${topic}".
  Phạm vi bắt buộc, không được bỏ sót: ${focusAreas.join('; ') || topic}.
  Tạo ít nhất một đơn vị cho MỖI focus area; một nguồn CÓ THỂ chứng minh nhiều focus area nếu nội dung nguồn thật sự có đủ bằng chứng cho từng phạm vi.
  Nếu nguồn không đủ căn cứ cho focus area nào, ghi nó trong unsupported_focus_areas kèm nguyên nhân (area: reason).
  Phù hợp đối tượng trong yêu cầu; không mở rộng ra ngoài phạm vi.
  Chỉ dùng sự kiện có trong các nguồn dưới đây. Mỗi đơn vị phải gắn đúng một focus_area từ danh sách trên, đồng thời kèm source_title, source_url và source_excerpt là một đoạn NGUYÊN VĂN liên tục trong nội dung chính của đúng nguồn đó.
  Trả về JSON object: {"knowledge_units":[{"name":"...","summary":"...","category":"core|definition|application","focus_area":"...","source_title":"...","source_url":"...","source_excerpt":"..."}],"unsupported_focus_areas":["area: reason"]}

YÊU CẦU NGƯỜI DÙNG:\n${requirements}\n\nNGUỒN ĐÃ TÌM THẤY:\n${sourceContext}`,
        config: { responseMimeType: 'application/json', temperature: 0.1 },
        abortSignal,
        step: 'research.synthesize',
      }),
    AI_STEP_TIMEOUT_MS,
    'Tổng hợp kiến thức nghiên cứu (AI)'
  );
  if (!response.text) throw new Error('AI không trả về bản tổng hợp kiến thức.');
  const generated = JSON.parse(response.text);
  if (!generated || !Array.isArray(generated.knowledge_units)) throw new Error('Kết quả tổng hợp kiến thức không đúng định dạng.');
  const normalizeExcerpt = (value: string) => value.replace(/\s+/g, ' ').trim();
  const units = generated.knowledge_units
    .map((unit: any) => {
      const source = sources.find((item) => item.url === unit.source_url);
      const excerpt = String(unit.source_excerpt || '').trim();
      const matchedArea = focusAreas.find((area) => area.toLowerCase() === String(unit.focus_area || '').trim().toLowerCase());
      if (!source || !matchedArea || excerpt.length < 20) return null;
      if (!normalizeExcerpt(source.content).includes(normalizeExcerpt(excerpt))) return null;
      return {
        name: String(unit.name || '').trim(),
        summary: String(unit.summary || '').trim(),
        category: String(unit.category || 'core'),
        focus_area: matchedArea,
        source_title: source.title,
        source_url: source.url,
        source_excerpt: excerpt,
      } as KnowledgeUnit;
    })
    .filter((unit: KnowledgeUnit | null): unit is KnowledgeUnit => Boolean(unit && unit.name && unit.summary));
  const missingAreas = (focusAreas as string[]).filter((area: string) => !units.some((unit: KnowledgeUnit) => unit.focus_area === area));
  return { units, missingAreas };
}

// ===== Luồng chính: buildWebResearch =====
export interface FocusAreaEvidence {
  area: string;
  verified: boolean;
  reason?: string;
  evidence?: Array<{ source_url: string; source_title: string; excerpt: string }>;
}

export interface BuildWebResearchResult {
  topic: string;
  retrieved_at: string;
  sources: Array<WebSource>;
  knowledge_units: KnowledgeUnit[];
  unresolved_areas: string[];
  area_evidence: FocusAreaEvidence[];
}

export interface BuildWebResearchDeps {
  fetchImpl?: typeof fetch;
  /** Thay thế bước tổng hợp Gemini trong test. */
  synthesize?: typeof synthesizeResearchKnowledge;
}

export async function buildWebResearch(
  topic: string,
  requirements = topic,
  focusAreas: string[] = [],
  searchQueries: string[] = [],
  deps: BuildWebResearchDeps = {}
): Promise<BuildWebResearchResult> {
  const cleanTopic = (topic || 'Chủ đề học tập').trim() || 'Chủ đề học tập';
  const synthesize = deps.synthesize || synthesizeResearchKnowledge;
  const fetchOpts = { fetchImpl: deps.fetchImpl, topicTerms: extractTopicTerms([cleanTopic, ...focusAreas, ...searchQueries]) };

  const seenAreas = new Set<string>();
  const researchAreas = focusAreas
    .map((area) => area.trim())
    .filter((area) => {
      const key = area.toLocaleLowerCase();
      if (!area || seenAreas.has(key)) return false;
      seenAreas.add(key);
      return true;
    });
  if (researchAreas.length === 0) researchAreas.push(cleanTopic);

  // ===== Vòng 1: nguồn chính thức (curated) cho TỪNG focus area =====
  let sources: WebSource[] = [];
  const curatedPerArea = researchAreas.map((area) => collectCuratedSourceUrlsForArea(area, [cleanTopic]));
  const curatedUrls = Array.from(new Set(curatedPerArea.flat()));
  sources = dedupeSources(sources, await fetchCuratedSources(curatedUrls, fetchOpts));

  // ===== Vòng 2: tìm kiếm web cho từng focus area (nếu còn thiếu nguồn) =====
  if (sources.length === 0) {
    for (const area of researchAreas) {
      const query = toSearchableQuery(area);
      if (!query) continue;
      const found = await fetchSearchSourcesForQuery(query, fetchOpts);
      sources = dedupeSources(sources, found);
      if (sources.length >= MAX_TOTAL_SOURCES) break;
    }
    // Wikipedia chỉ là nguồn bổ sung khi vẫn chưa đủ.
    if (sources.length === 0) {
      sources = dedupeSources(sources, await fetchWikipediaSources(cleanTopic, { fetchImpl: deps.fetchImpl }));
    }
  }

  const verifiedAreas = new Set<string>();
  const evidenceByArea = new Map<string, FocusAreaEvidence>();
  const knowledgeUnits: KnowledgeUnit[] = [];
  let pendingAreas = [...researchAreas];

  const runSynthesis = async (areas: string[]) => {
    const result = await synthesize(cleanTopic, requirements, areas, sources);
    for (const unit of result.units) {
      knowledgeUnits.push(unit);
      verifiedAreas.add(unit.focus_area);
      const evidence = evidenceByArea.get(unit.focus_area) || { area: unit.focus_area, verified: true, evidence: [] };
      evidence.evidence!.push({ source_url: unit.source_url, source_title: unit.source_title, excerpt: unit.source_excerpt });
      evidenceByArea.set(unit.focus_area, evidence);
    }
    // Lý do cụ thể cho từng phạm vi thất bại từ unsupported_focus_areas.
    const unsupported = (result as SynthesisResult & { unsupported_focus_areas?: string[] }).unsupported_focus_areas || [];
    return { missingAreas: result.missingAreas, unsupported };
  };

  const firstRun = await runSynthesis(pendingAreas);
  let missingAreas = firstRun.missingAreas;
  const unsupportedReasons = new Map<string, string>();
  for (const entry of firstRun.unsupported || []) {
    const [area, ...rest] = String(entry).split(':');
    if (area && rest.length > 0) unsupportedReasons.set(area.trim(), rest.join(':').trim());
  }
  missingAreas = missingAreas.filter((area) => !verifiedAreas.has(area));
  pendingAreas = missingAreas;

  // ===== Tìm bổ sung CHỈ cho các phạm vi chưa xác minh =====
  for (let attempt = 0; attempt < 2 && pendingAreas.length > 0; attempt += 1) {
    console.info('[AI Research] Tìm bổ sung nguồn cho các phạm vi chưa xác minh.', { attempt: attempt + 1, pendingAreas });
    // Bổ sung nguồn curated riêng cho từng phạm vi còn thiếu.
    const perAreaCurated = pendingAreas.flatMap((area) => collectCuratedSourceUrlsForArea(area, [cleanTopic]));
    sources = dedupeSources(sources, await fetchCuratedSources(perAreaCurated, fetchOpts));

    // Tìm kiếm web riêng cho từng phạm vi (không tìm lại toàn bộ chủ đề).
    for (const area of pendingAreas) {
      const baseQuery = toSearchableQuery(area) || area;
      const queries = attempt === 0
        ? [`${baseQuery} tutorial`, `${baseQuery} python documentation`]
        : [`${baseQuery} official docs`, `${baseQuery} site:docs.python.org`];
      for (const query of queries) {
        const found = await fetchSearchSourcesForQuery(query, fetchOpts);
        sources = dedupeSources(sources, found);
        if (sources.length >= MAX_TOTAL_SOURCES) break;
      }
      if (sources.length >= MAX_TOTAL_SOURCES) break;
    }

    // Wikipedia là nguồn bổ sung cuối cùng, chỉ khi vẫn chưa đủ.
    if (sources.length < MAX_TOTAL_SOURCES) {
      sources = dedupeSources(sources, await fetchWikipediaSources(pendingAreas.join(' '), { fetchImpl: deps.fetchImpl }));
    }

    const run = await runSynthesis(pendingAreas);
    for (const entry of run.unsupported || []) {
      const [area, ...rest] = String(entry).split(':');
      if (area && rest.length > 0 && !unsupportedReasons.has(area.trim())) {
        unsupportedReasons.set(area.trim(), rest.join(':').trim());
      }
    }
    pendingAreas = run.missingAreas.filter((area) => !verifiedAreas.has(area));
  }

  // ===== Báo cáo bằng chứng cho từng phạm vi =====
  const areaEvidence: FocusAreaEvidence[] = researchAreas.map((area) => {
    if (verifiedAreas.has(area)) {
      const evidence = evidenceByArea.get(area)!;
      return { area, verified: true, evidence: evidence.evidence };
    }
    const reason = unsupportedReasons.get(area) || 'Không tìm thấy nguồn đáng tin cậy có nội dung chứng minh phạm vi này sau các vòng tìm kiếm.';
    return { area, verified: false, reason };
  });

  const unresolvedAreas = researchAreas.filter((area) => !verifiedAreas.has(area));

  // KHÔNG tự động bỏ qua điều kiện xác minh: nếu còn phạm vi chưa đủ bằng chứng,
  // chặn việc tạo đề và báo rõ từng phạm vi + nguyên nhân.
  if (unresolvedAreas.length > 0) {
    if (knowledgeUnits.length === 0) {
      console.info('[AI Research] Không xác minh được nguồn cho bất kỳ phạm vi nào.', {
        areaCount: researchAreas.length,
        sourceCount: sources.length,
        sourceDomains: Array.from(new Set(sources.map((source) => source.domain))).slice(0, 10),
      });
      throw new Error(
        `Sau khi tìm bổ sung, vẫn chưa xác minh đủ nguồn cho các phạm vi: ${unresolvedAreas.join(', ')}. ` +
        `Nguyên nhân từng phạm vi: ${areaEvidence.filter((e) => !e.verified).map((e) => `${e.area} (${e.reason})`).join('; ')}. ` +
        `Hãy thu hẹp yêu cầu hoặc cung cấp tài liệu.`
      );
    }
    throw new Error(
      `Không thể tạo đề cho đến khi mọi phạm vi được xác minh. Các phạm vi chưa đủ bằng chứng: ` +
      `${unresolvedAreas.map((area) => {
        const reason = areaEvidence.find((e) => e.area === area)?.reason || 'nguyên nhân không xác định';
        return `${area} (${reason})`;
      }).join('; ')}.`
    );
  }

  return {
    topic: cleanTopic,
    retrieved_at: new Date().toISOString(),
    sources,
    knowledge_units: knowledgeUnits,
    unresolved_areas: [],
    area_evidence: areaEvidence,
  };
}
