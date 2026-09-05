const fs = require('node:fs');
const path = require('node:path');
const { classify, domainOf, normalize } = require('./audit-cartography-all.cjs');
const directory = path.resolve(__dirname, '../docs/audits/cartography-full-20260905');

function addressKey(value) {
  return normalize(value)
    .replace(/\b(street|avenue|road|drive|boulevard|parkway|highway|lane|court|place|terrace|suite|ste|north|south|east|west)\b/g, word => ({
      street:'st',avenue:'ave',road:'rd',drive:'dr',boulevard:'blvd',parkway:'pkwy',highway:'hwy',lane:'ln',court:'ct',place:'pl',terrace:'ter',suite:'',ste:'',north:'n',south:'s',east:'e',west:'w',
    })[word]).replace(/\s+/g,' ').trim();
}
function refine(row) {
  if (row.status === 'address_difference_needs_review' && addressKey(row.address) === addressKey(row.evidence.address)) {
    return { ...row, status: 'address_corroborated_formatting_difference' };
  }
  return row;
}
function csvCell(value) {
  let string = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(string)) string = "'" + string;
  return '"' + string.replace(/"/g,'""') + '"';
}
function main() {
  const companies = JSON.parse(fs.readFileSync(path.join(directory,'companies.json'),'utf8'));
  const domains = new Map();
  for (const line of fs.readFileSync(path.join(directory,'domains.jsonl'),'utf8').split('\n').filter(Boolean)) {
    try { const record=JSON.parse(line); domains.set(record.domain,record); } catch { /* Running scan may have a partial last line. */ }
  }
  const results = companies.map(company=> {
    const domain=domainOf(company.domain || '');
    if (domain && !domains.has(domain)) return {...company,status:'pending'};
    return refine(classify(company,domains.get(domain)));
  });
  const counts = {}; for (const row of results) counts[row.status]=(counts[row.status]||0)+1;
  const summary = { generatedAt:new Date().toISOString(), total:results.length, checked:results.length-(counts.pending||0), complete:!counts.pending, counts };
  const columns = ['id','name','domain','address','status','suggestedAddress','sources','errors'];
  const csv = [columns.join(',')];
  const reviews = [columns.join(',')];
  const unresolved = [columns.join(',')];
  for (const row of results) {
    const line = columns.map(key=>csvCell(key==='suggestedAddress' ? (Array.isArray(row.evidence)?row.evidence.map(e=>e.address).join(' | '):row.evidence?.address) : key==='sources' ? row.sources?.join(' | ') : key==='errors' ? row.errors?.join(' | ') : row[key])).join(',');
    csv.push(line);
    if (['address_difference_needs_review','multiple_addresses_needs_review'].includes(row.status)) reviews.push(line);
    else if (!row.status.startsWith('address_corroborated') && row.status !== 'pending') unresolved.push(line);
  }
  fs.writeFileSync(path.join(directory,'company-address-audit.csv'),csv.join('\n')+'\n');
  fs.writeFileSync(path.join(directory,'address-review-candidates.csv'),reviews.join('\n')+'\n');
  fs.writeFileSync(path.join(directory,'unresolved-companies.csv'),unresolved.join('\n')+'\n');
  fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(results,null,2));
  fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary,null,2));
  fs.writeFileSync(path.join(directory,'README.md'),[
    '# Full Cartography company/address audit',
    '',`Generated: ${summary.generatedAt}`,`Coverage: ${summary.checked} / ${summary.total} company records. ${summary.complete?'Scan complete.':'Scan in progress.'}`,
    '', 'This checks the stored public website and, when linked, one contact/location page per distinct domain. It is an evidence audit, not a guarantee that every company exists or that an office remains occupied.',
    '', 'No database rows are modified by the scan. No address from another domain or an ambiguous organization match is automatically applied.',
    '', '| Outcome | Records |','| --- | ---: |',...Object.entries(counts).map(([status,count])=>`| ${status} | ${count} |`),
    '', '## Files', '', '- `company-address-audit.csv`: all companies, outcomes, suggested addresses, sources, and errors.', '- `address-review-candidates.csv`: different or multiple published addresses requiring review.', '- `unresolved-companies.csv`: identity/address evidence missing or website unavailable.', '- `results.json`: full per-company evidence.', '- `summary.json`: counts and coverage.', '- `companies.json`: read-only database snapshot.', '- `domains.jsonl`: resumable first-party page evidence.',
    '', '## Interpretation', '', 'Corroborated means the stored address is supported by company-name-matched structured data or by matching company name and address text on a retrieved page. It does not establish postal deliverability or validate coordinates.',
    '', 'An address difference is a review candidate, not proof of an error: a company can have multiple branches, mailing addresses, or stale structured data. Unavailable websites and missing identity matches are unresolved, not proof that a company is fictitious. Abbreviations and suite formatting may still yield review candidates.',
    '', 'Coverage limitations: JavaScript-only sites, blocked crawlers, timeouts, redirects, missing domains, incomplete contact pages, and company-name variations can prevent corroboration. The audit does not purchase third-party data or infer addresses from an AI model.',
    '', 'Resume with `node scripts/audit-cartography-all.cjs`; regenerate this report with `node scripts/report-cartography-audit.cjs`.', '',
  ].join('\n'));
  console.log(JSON.stringify(summary));
}
if (require.main === module) main();
module.exports={addressKey,refine,csvCell};
