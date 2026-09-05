// Resumable, read-only company/address audit. Does not modify the database.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const dns = require('node:dns');
const net = require('node:net');
const { Client } = require('pg');
const { parseDocument } = require('htmlparser2');
const { textContent, findAll } = require('domutils');
const dir = path.resolve(__dirname, '../docs/audits/cartography-full-20260905');
fs.mkdirSync(dir, { recursive: true });
const snapshot = path.join(dir, 'companies.json');
const checkpoint = path.join(dir, 'domains.jsonl');
const blocked = new net.BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(ip,bits,'ipv4');
for (const [ip, bits] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8]]) blocked.addSubnet(ip,bits,'ipv6');
function safeLookup(host, options, callback) {
  dns.lookup(host, { all: true }, (error, addresses) => {
    if (error) return callback(error);
    const valid = addresses.filter(a => !blocked.check(a.address, a.family === 4 ? 'ipv4' : 'ipv6') && !a.address.startsWith('::ffff:'));
    if (!valid.length) return callback(new Error('non_public_host'));
    callback(null, options.all ? valid : valid[0].address, valid[0].family);
  });
}
function fetchPage(raw, depth = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(raw); } catch { reject(new Error('invalid_url')); return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port)) || net.isIP(url.hostname)) {
      reject(new Error('unsupported_url')); return;
    }
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      lookup: safeLookup,
      headers: { 'User-Agent': 'VierraCompanyAddressAudit/1.0', Accept: 'text/html,application/xhtml+xml,text/plain' },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        clearTimeout(timer);
        if (depth >= 4) return reject(new Error('redirect_limit'));
        return fetchPage(new URL(res.headers.location, url).href, depth + 1).then(resolve,reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('http_' + res.statusCode)); }
      const parts = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 1000000) request.destroy(new Error('page_too_large')); else parts.push(chunk); });
      res.on('end', () => resolve({ url: url.href, html: Buffer.concat(parts).toString('utf8') }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new Error('timeout')), 7000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}
const normalize = s => String(s || '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function extract(page) {
  const doc = parseDocument(page.html);
  const nodes = findAll(() => true, doc.children);
  const organizations = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.name && value.address && value['@type']) {
      const types = [].concat(value['@type']);
      if (types.some(t => /Organization|Business|Corporation|Store|Agency|Service|Office|Restaurant|Hospital|School|College|Government/i.test(t))) {
        for (const a of [].concat(value.address)) {
          if (a && typeof a === 'object' && a.streetAddress && a.addressLocality) {
            organizations.push({ name: String(value.name), street: String(a.streetAddress), city: String(a.addressLocality), region: String(a.addressRegion || ''), postal: String(a.postalCode || ''), address: [a.streetAddress,a.addressLocality,[a.addressRegion,a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '), source: page.url });
          }
        }
      }
    }
    for (const child of Object.values(value)) if (typeof child === 'object') {
      if (Array.isArray(child)) child.forEach(walk); else walk(child);
    }
  }
  for (const node of nodes) if (node.name === 'script' && /ld\+json/i.test(node.attribs?.type || '')) {
    try { walk(JSON.parse(textContent(node))); } catch { /* invalid publisher JSON */ }
  }
  const title = nodes.filter(n => n.name === 'title').map(textContent).join(' ');
  const body = nodes.filter(n => ['p','address','footer','h1','h2','li'].includes(n.name)).map(textContent).join(' ').replace(/\s+/g,' ').slice(0,180000);
  const contacts = nodes.filter(n => n.name === 'a' && /^(contact|contact us|locations|our locations|offices)$/i.test(textContent(n).trim())).map(n => n.attribs?.href).filter(Boolean).map(h => { try { return new URL(h,page.url).href; } catch { return null; } }).filter(h => h && new URL(h).origin === new URL(page.url).origin);
  return { url: page.url, title, text: body, organizations, contacts: [...new Set(contacts)] };
}
function domainOf(raw) {
  try { const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); return u.hostname.toLowerCase().replace(/^www\./,''); } catch { return null; }
}
async function auditDomain(domain) {
  const result = { domain, checkedAt: new Date().toISOString(), pages: [], errors: [] };
  try {
    const robots = await fetchPage('https://' + domain + '/robots.txt');
    let applies = false;
    for (const line of robots.html.split(/\r?\n/)) {
      if (/^user-agent:/i.test(line)) applies = /:\s*\*\s*$/i.test(line) || /VierraCompanyAddressAudit/i.test(line);
      if (applies && /^disallow:\s*\/\s*$/i.test(line)) return { ...result, errors: ['robots_disallow_all'] };
    }
  } catch { /* Missing/unavailable robots is recorded by website outcome below. */ }
  try {
    const home = extract(await fetchPage('https://' + domain));
    result.pages.push(home);
    if (home.contacts[0] && home.contacts[0] !== home.url) {
      try { result.pages.push(extract(await fetchPage(home.contacts[0]))); } catch (e) { result.errors.push('contact:' + (e.code || e.message)); }
    }
  } catch (e) { result.errors.push(e.code || e.message); }
  return result;
}
function classify(company, result) {
  const base = { ...company, checkedAt: result?.checkedAt || new Date().toISOString() };
  if (!result) return { ...base, status: 'missing_or_invalid_domain' };
  if (!result.pages.length) return { ...base, status: 'website_unavailable', errors: result.errors };
  const identity = normalize(company.name).replace(/\b(inc|llc|ltd|corporation|corp|pllc)\b/g,'').trim();
  const matchName = name => normalize(name).replace(/\b(inc|llc|ltd|corporation|corp|pllc)\b/g,'').trim() === identity;
  const orgs = result.pages.flatMap(p => p.organizations).filter(o => matchName(o.name));
  const unique = [...new Map(orgs.map(o => [normalize(o.address),o])).values()];
  const sources = result.pages.map(p => p.url);
  const existing = normalize(company.address);
  const same = unique.find(o => existing.includes(normalize(o.street)) && existing.includes(normalize(o.city)) && o.postal && existing.includes(normalize(o.postal)));
  if (same) return { ...base, status: 'address_corroborated_structured', evidence: same, sources };
  if (unique.length === 1) return { ...base, status: 'address_difference_needs_review', evidence: unique[0], sources };
  if (unique.length > 1) return { ...base, status: 'multiple_addresses_needs_review', evidence: unique, sources };
  const nameSeen = result.pages.some(p => identity.length >= 5 && normalize(p.title + ' ' + p.text).includes(identity));
  if (nameSeen && existing.length > 15 && result.pages.some(p => normalize(p.text).includes(existing))) return { ...base, status: 'address_corroborated_page_text', sources };
  return { ...base, status: nameSeen ? 'company_name_found_address_unverified' : 'identity_needs_review', sources, pageTitles: result.pages.map(p => p.title) };
}
async function main() {
  if (!fs.existsSync(snapshot)) {
    const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
    try { await db.connect(); const result = await db.query('SELECT id,name,domain,address,lat,lng FROM cartography_companies ORDER BY id'); fs.writeFileSync(snapshot, JSON.stringify(result.rows,null,2)); } finally { await db.end(); }
  }
  const companies = JSON.parse(fs.readFileSync(snapshot,'utf8'));
  const saved = new Map();
  if (fs.existsSync(checkpoint)) for (const line of fs.readFileSync(checkpoint,'utf8').split('\n').filter(Boolean)) { const r=JSON.parse(line); saved.set(r.domain,r); }
  const domains = [...new Set(companies.map(c=>domainOf(c.domain || '')).filter(Boolean))].filter(d=>!saved.has(d));
  let next = 0; let done = saved.size;
  console.log(JSON.stringify({ companies: companies.length, pendingDomains: domains.length, resumedDomains: done }));
  await Promise.all(Array.from({length:48},async()=>{
    while (next < domains.length) {
      const domain = domains[next++]; const result = await auditDomain(domain);
      fs.appendFileSync(checkpoint,JSON.stringify(result)+'\n'); saved.set(domain,result); done++;
      if (done % 100 === 0) console.log(JSON.stringify({ completedDomains: done, remaining: domains.length-next, at:new Date().toISOString() }));
    }
  }));
  const rows = companies.map(c=>classify(c,saved.get(domainOf(c.domain || ''))));
  const counts = {}; for (const row of rows) counts[row.status]=(counts[row.status]||0)+1;
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(rows,null,2));
  fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({ finishedAt:new Date().toISOString(), total:rows.length,counts },null,2));
  console.log(JSON.stringify({ complete:true,total:rows.length,counts }));
}
if (require.main === module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports = { normalize, extract, classify, domainOf };
