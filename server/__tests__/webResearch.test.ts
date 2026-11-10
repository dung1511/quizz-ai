/**
 * Kiểm thử luồng nghiên cứu web mới (server/webResearch.ts):
 *  - Wikipedia trả HTTP 429 → bị bỏ qua / cooldown, không retry vô hạn.
 *  - Tìm được tài liệu Python chính thức.
 *  - URL không liên quan bị loại.
 *  - Trang tài liệu tải thất bại → không dùng làm bằng chứng.
 *  - Nguồn chứa nội dung for/while → xác minh phạm vi vòng lặp.
 *  - Nguồn chứa nội dung List → xác minh phạm vi kiểu dữ liệu danh sách.
 *  - Một phạm vi được xác minh, phạm vi khác chưa đủ bằng chứng → lỗi nêu rõ phạm vi.
 *  - Tất cả phạm vi xác minh thành công → unresolved_areas rỗng.
 * KHÔNG cần API key thật: Gemini được thay bằng stub (deps.synthesize).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWebResearch,
  fetchSourcePageContent,
  fetchPageWithRetry,
  fetchWikipediaSources,
  isOffTopicUrl,
  classifySourceType,
  eligibleSourceDomain,
  dedupeSources,
  collectCuratedSourceUrlsForArea,
  setSleepFunction,
  getDomainCooldownRemaining,
  setDomainCooldown,
  stripHtmlToText,
} from '../webResearch';

// ===== Helper: tạo mock fetch =====
type Handler = (url: string, init?: any) => Response | Promise<Response>;

function makeResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

const PYTHON_CONTROLFLOW_HTML = `<html><head><title>4. More Control Flow Tools — Python 3 Tutorial</title></head>
<body><p>Besides the while statement just introduced, Python uses the usual flow control statements
known from other languages, with some twists. The for statement in Python differs from C or Pascal.
Perhaps the most well-known statement type is the if statement. The range() function is used to
iterate over a sequence of numbers in for loops. While loops execute while a condition is true,
and break and continue statements work with for and while loops.</p></body></html>`;

const PYTHON_DATASTRUCTURES_HTML = `<html><head><title>5. Data Structures — Python 3 Tutorial</title></head>
<body><p>This chapter describes some things you have learned about lists already, and adds some new
things as well. The list data type has some more methods: append, extend, insert, remove, pop, index,
count, sort, reverse. Using lists as stacks and queues. List comprehensions provide a concise way to
create lists. Tuples and sequences. Sets are unordered collections with no duplicate elements.
Dictionaries are sometimes found in other languages as associative memories or associative arrays.</p></body></html>`;

const FAFSA_HTML = `<html><head><title>FAFSA — Free Application for Federal Student Aid</title></head>
<body><p>Apply for federal student aid, grants and loans for college education. FAFSA deadlines
and eligibility requirements for students. Financial aid application process and documents needed.
Federal student aid helps students pay for college with grants, scholarships and work-study.</p></body></html>`;

/** Runtime fetch mock: chuyển hướng theo URL. */
function mockFetch(handler: Handler): typeof fetch {
  return (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input.url ?? input);
    return handler(url, init);
  }) as unknown as typeof fetch;
}

// Tắt sleep thật trong test (tránh backoff chờ nhiều giây).
setSleepFunction(async () => { });

// ===== 1. Bộ lọc URL không liên quan =====
test('isOffTopicUrl: loại URL fafsa.gov và FAA', () => {
  assert.equal(isOffTopicUrl('https://studentaid.gov/understand-aid/eligibility/fafsa'), true);
  assert.equal(isOffTopicUrl('https://www.faa.gov/aircraft/draft_media'), true);
});

test('isOffTopicUrl: giữ URL docs.python.org', () => {
  assert.equal(isOffTopicUrl('https://docs.python.org/3/tutorial/controlflow.html'), false);
});

test('isOffTopicUrl: với topicTerms, URL không nhắc chủ đề bị loại', () => {
  assert.equal(isOffTopicUrl('https://www.postgresql.org/docs/current/tutorial-sql.html', ['python']), true);
  assert.equal(isOffTopicUrl('https://docs.python.org/3/tutorial/', ['python']), false);
});

// ===== 2. Phân loại nguồn =====
test('classifySourceType: docs.python.org là OFFICIAL; fafsa.gov không nằm trong danh sách tin cậy', () => {
  assert.equal(classifySourceType('docs.python.org'), 'OFFICIAL');
  assert.equal(eligibleSourceDomain('docs.python.org'), true);
  assert.equal(classifySourceType('studentaid.gov'), 'GOVERNMENT');
  assert.equal(eligibleSourceDomain('random-ads.example.net'), false);
});

// ===== 3. HTTP 429 với Retry-After =====
test('fetchPageWithRetry: HTTP 429 → backoff + Retry-After, retry đúng số lần rồi trả thất bại', async () => {
  let calls = 0;
  const sleepDurations: number[] = [];
  setSleepFunction(async (ms) => { sleepDurations.push(ms); });
  const impl = mockFetch(async () => {
    calls += 1;
    return makeResponse(429, 'rate limited', { 'retry-after': '1' });
  });
  const result = await fetchPageWithRetry('https://example.com/x', { fetchImpl: impl, maxRetries: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(calls, 2); // 1 lần chính + 1 lần retry
  assert.equal(sleepDurations.length, 2); // 1 backoff 429 + 1 chờ cooldown của domain
  assert.equal(sleepDurations[0], 1000); // tôn trọng Retry-After: 1 (giây)
});

// ===== 4. Wikipedia trả 429 → bị bỏ qua, đặt cooldown =====
test('fetchWikipediaSources: HTTP 429 → đặt cooldown, trả về mảng rỗng, không gọi lại trong cooldown', async () => {
  let calls = 0;
  const impl = mockFetch(async () => {
    calls += 1;
    return makeResponse(429, 'too many requests');
  });
  setDomainCooldown('vi.wikipedia.org', 0, Date.now() - 1); // xóa cooldown cũ nếu còn
  setDomainCooldown('en.wikipedia.org', 0, Date.now() - 1);
  const items = await fetchWikipediaSources('python loops', { fetchImpl: impl });
  assert.deepEqual(items, []);
  assert.ok(calls >= 2); // đã gọi ít nhất 2 ngôn ngữ nhưng bị chặn
  assert.ok(getDomainCooldownRemaining('vi.wikipedia.org') > 0);
  assert.ok(getDomainCooldownRemaining('en.wikipedia.org') > 0);
});

// ===== 5. Tải trang thành công, trích xuất nội dung =====
test('fetchSourcePageContent: trích xuất nội dung trang Python chính thức', async () => {
  const impl = mockFetch(async (url) => {
    if (url.includes('controlflow')) return makeResponse(200, PYTHON_CONTROLFLOW_HTML);
    return makeResponse(404, 'Not Found');
  });
  const page = await fetchSourcePageContent('https://docs.python.org/3/tutorial/controlflow.html', { fetchImpl: impl });
  assert.ok(page);
  assert.equal(page!.domain, 'docs.python.org');
  assert.equal(page!.source_type, 'OFFICIAL');
  assert.ok(page!.content.includes('while'));
  assert.ok(page!.content.includes('for'));
});

// ===== 6. Trang tải thất bại → trả null, không làm bằng chứng =====
test('fetchSourcePageContent: HTTP 500 / nội dung quá ngắn → null', async () => {
  const impl = mockFetch(async (url) => {
    if (url.includes('fail')) return makeResponse(500, 'server error');
    if (url.includes('short')) return makeResponse(200, '<html><body><p>ngắn</p></body></html>');
    return makeResponse(404, 'Not Found');
  });
  assert.equal(await fetchSourcePageContent('https://docs.python.org/3/fail.html', { fetchImpl: impl }), null);
  assert.equal(await fetchSourcePageContent('https://docs.python.org/3/short.html', { fetchImpl: impl }), null);
});

// ===== 7. dedupeSources: loại URL trùng, giới hạn tổng số =====
test('dedupeSources: không thêm URL đã có', () => {
  const existing = [{ title: 'A', url: 'https://a', domain: 'a', source_type: 'OFFICIAL', summary: '', content: '' }];
  const incoming = [
    { title: 'A again', url: 'https://a', domain: 'a', source_type: 'OFFICIAL', summary: '', content: '' },
    { title: 'B', url: 'https://b', domain: 'b', source_type: 'OFFICIAL', summary: '', content: '' },
  ];
  const merged = dedupeSources(existing, incoming);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((source) => source.url), ['https://a', 'https://b']);
});

// ===== 8. collectCuratedSourceUrlsForArea: gợi ý trang Python đúng cho từng phạm vi =====
test('collectCuratedSourceUrlsForArea: phạm vi vòng lặp → controlflow.html', () => {
  const urls = collectCuratedSourceUrlsForArea('Vòng lặp (for, while)', ['Python']);
  assert.ok(urls.includes('https://docs.python.org/3/tutorial/controlflow.html'));
});

test('collectCuratedSourceUrlsForArea: phạm vi danh sách → datastructures.html', () => {
  const urls = collectCuratedSourceUrlsForArea('Kiểu dữ liệu danh sách (List) cơ bản', ['Python']);
  assert.ok(urls.includes('https://docs.python.org/3/tutorial/datastructures.html'));
});

// ===== 9. buildWebResearch: tìm được tài liệu Python chính thức, cả 2 phạm vi xác minh =====
test('buildWebResearch: nguồn Python chính thức chứng minh cả vòng lặp và List', async () => {
  const impl = mockFetch(async (url) => {
    if (url.includes('controlflow')) return makeResponse(200, PYTHON_CONTROLFLOW_HTML);
    if (url.includes('datastructures')) return makeResponse(200, PYTHON_DATASTRUCTURES_HTML);
    // Các trang curated khác của Python: trả trang giới thiệu (nội dung vẫn đủ dài)
    if (url.includes('docs.python.org')) {
      return makeResponse(200, '<html><head><title>Python Tutorial</title></head><body>' +
        '<p>Python is a programming language. Variables store values. Functions group code. ' +
        'Errors can be handled with try and except. Input and output use print and input functions. ' +
        'Classes define objects. Strings and numbers are basic data types in Python programs.</p></body></html>');
    }
    // Mọi URL khác (search engine v.v.): trả trang không liên quan để kiểm tra bộ lọc
    return makeResponse(200, FAFSA_HTML);
  });
  const result = await buildWebResearch(
    'Python cơ bản',
    'Lập trình Python cơ bản, 5 câu hỏi',
    ['Vòng lặp (for, while)', 'Kiểu dữ liệu danh sách (List) cơ bản'],
    [],
    {
      fetchImpl: impl,
      synthesize: async (_topic: string, _req: string, areas: string[], sources: import('../webResearch').WebSource[]) => {
        // Stub Gemini: xác minh từ nội dung trang thật (không giả mạo).
        const units: import('../webResearch').KnowledgeUnit[] = [];
        const controlflow = sources.find((s) => s.url.includes('controlflow'));
        const datastructures = sources.find((s) => s.url.includes('datastructures'));
        for (const area of areas) {
          const lower = area.toLowerCase();
          if (/v[oòô]?ng l[iặ]p|loop/.test(lower) && controlflow) {
            const excerpt = controlflow.content.slice(0, 60);
            units.push({ name: 'Loops', summary: 'summary', category: 'core', focus_area: area,
              source_title: controlflow.title, source_url: controlflow.url, source_excerpt: excerpt });
          }
          if (/danh s[aá]ch|list/.test(lower) && datastructures) {
            const excerpt = datastructures.content.slice(0, 60);
            units.push({ name: 'Lists', summary: 'summary', category: 'core', focus_area: area,
              source_title: datastructures.title, source_url: datastructures.url, source_excerpt: excerpt });
          }
        }
        return { units, missingAreas: areas.filter((area) => !units.some((u) => u.focus_area === area)) };
      },
    }
  );
  assert.equal(result.unresolved_areas.length, 0);
  assert.equal(result.area_evidence.length, 2);
  assert.ok(result.area_evidence.every((e) => e.verified));
  const loopsEvidence = result.area_evidence.find((e: { area: string }) => /v[oòô]?ng l[iặ]p/i.test(e.area));
  assert.ok(loopsEvidence!.evidence![0].source_url.includes('controlflow'));
  const listEvidence = result.area_evidence.find((e: { area: string }) => /danh s/i.test(e.area));
  assert.ok(listEvidence!.evidence![0].source_url.includes('datastructures'));
  // URL không liên quan (fafsa/FAA) không được dùng làm nguồn
  assert.ok(result.sources.every((source) => !/fafsa|faa\.gov/i.test(source.url)));
});

// ===== 10. buildWebResearch: một phạm vi xác minh, phạm vi khác thiếu bằng chứng =====
test('buildWebResearch: thiếu bằng chứng cho 1 phạm vi → lỗi nêu rõ phạm vi và nguyên nhân, không chung chung', async () => {
  const impl = mockFetch(async (url) => {
    if (url.includes('controlflow')) return makeResponse(200, PYTHON_CONTROLFLOW_HTML);
    if (url.includes('docs.python.org')) return makeResponse(200, PYTHON_DATASTRUCTURES_HTML);
    return makeResponse(200, FAFSA_HTML);
  });
  await assert.rejects(
    () => buildWebResearch(
      'Python cơ bản',
      'req',
      ['Vòng lặp (for, while)', 'Lập trình hướng đối tượng'],
      [],
      {
        fetchImpl: impl,
        synthesize: async (_topic: string, _req: string, areas: string[], sources: import('../webResearch').WebSource[]) => {
          const controlflow = sources.find((s) => s.url.includes('controlflow'));
          const units: import('../webResearch').KnowledgeUnit[] = [];
          for (const area of areas) {
            if (/v[oòô]?ng l[iặ]p|loop/i.test(area) && controlflow) {
              units.push({ name: 'Loops', summary: 's', category: 'core', focus_area: area,
                source_title: controlflow.title, source_url: controlflow.url,
                source_excerpt: controlflow.content.slice(0, 60) });
            }
          }
          return {
            units,
            missingAreas: areas.filter((area) => !units.some((u) => u.focus_area === area)),
            unsupported_focus_areas: areas
              .filter((area) => !units.some((u) => u.focus_area === area))
              .map((area) => `${area}: không có nguồn chứa nội dung OOP`),
          };
        },
      }
    ),
    (error: Error) => {
      assert.ok(/Lập trình hướng đối tượng/.test(error.message)); // nêu rõ phạm vi thiếu
      assert.ok(/không có nguồn chứa nội dung OOP/.test(error.message)); // nêu nguyên nhân
      return true;
    }
  );
});

// ===== 11. buildWebResearch: trang tài liệu tải thất bại → không xác minh được =====
test('buildWebResearch: tất cả trang tài liệu tải thất bại → lỗi, không ép tạo đề', async () => {
  const impl = mockFetch(async () => makeResponse(500, 'server error'));
  await assert.rejects(
    () => buildWebResearch('Python cơ bản', 'req', ['Vòng lặp'], [], {
      fetchImpl: impl,
      synthesize: async (_t: string, _r: string, areas: string[]) => ({
        units: [] as import('../webResearch').KnowledgeUnit[],
        missingAreas: areas,
        unsupported_focus_areas: areas.map((a) => `${a}: không có nội dung nguồn`),
      }),
    }),
    (error: Error) => {
      assert.ok(/Vòng lặp/.test(error.message));
      return true;
    }
  );
});

// ===== 12. stripHtmlToText hoạt động đúng =====
test('stripHtmlToText: bỏ tag + decode entity, không dính nội dung script', () => {
  const text = stripHtmlToText('<p>A & B</p><script>bad()</script>');
  assert.equal(text.includes('A & B'), true);
  assert.equal(text.includes('bad()'), false);
});
