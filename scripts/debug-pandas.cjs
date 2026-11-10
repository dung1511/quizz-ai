const VI_TO_EN_TERMS = { phan: ['element', 'item'], thu: ['order', 'index', 'sequence'] };
const stopWords = new Set(['cua', 'cac', 'nhung', 'mot', 'nhieu', 'theo', 'trong', 'ngoai', 'voi', 'duoc', 'la', 'va', 'hoac', 'nay', 'do', 'gi', 'nao', 'sau', 'khi', 'thi', 'tu', 'den', 'the', 'this', 'that', 'with', 'from', 'what', 'which', 'into', 'are', 'for', 'cau', 'lenh', 'dung', 'phuong', 'an', 'de', 'nen', 'can', 'phan', 'co', 'khong', 've']);
const PYTHON_RESERVED = new Set(['for', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue', 'pass', 'class', 'import', 'try', 'except', 'finally', 'raise', 'with', 'as', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'in', 'not', 'is', 'and', 'or', 'list', 'tuple', 'dict', 'set', 'str', 'int', 'float', 'bool', 'append', 'extend', 'insert', 'remove', 'pop', 'sort', 'reverse', 'index', 'range', 'len', 'print', 'input', 'type', 'data', 'python', 'loop', 'function', 'variable', 'string', 'integer', 'dictionary', 'value', 'key', 'element', 'item', 'method', 'sequence', 'iteration', 'comprehension', 'stack', 'queue']);
const text = 'Hàm thư viện bên thứ ba pandas dataframe đọc tệp excel';
const raw = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').match(/[a-z0-9]+/g) || [];
const out = new Set();
for (const w of raw) {
  if (PYTHON_RESERVED.has(w)) { out.add(w); continue; }
  if (w.length > 2 && !stopWords.has(w)) { out.add(w); const en = VI_TO_EN_TERMS[w]; if (en) en.forEach((t) => out.add(t)); }
}
console.log('raw words:', JSON.stringify(raw));
console.log('keywords:', JSON.stringify([...out]));
