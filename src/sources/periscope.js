// State e-procurement portals that run Periscope BuySpeed ("bso").
//
// Several states publish every open bid from state agencies, and from the
// cities, towns, counties and school districts that buy through the state
// system, on a public "Open Bids" page. The first page is plain HTML; later
// pages come from the page's own paging request (25 rows at a time), which
// needs the session cookie, the form's ViewState and its _csrf token.

import { BROWSER_UA } from '../http.js';
import { clean, cleanEmail, decodeEntities, formatPhone, htmlToText, truncate, usDateToIso } from '../normalize.js';

export const PERISCOPE_SOURCE = 'state_portal';

export const PERISCOPE_PORTALS = {
    MA: { name: 'COMMBUYS (Massachusetts)', host: 'https://www.commbuys.com', utcOffset: -5 },
    IL: { name: 'BidBuy (Illinois)', host: 'https://www.bidbuy.illinois.gov', utcOffset: -6 },
    NJ: { name: 'NJSTART (New Jersey)', host: 'https://www.njstart.gov', utcOffset: -5 },
    OR: { name: 'OregonBuys (Oregon)', host: 'https://oregonbuys.gov', utcOffset: -8 },
    NV: { name: 'Nevada ePro (Nevada)', host: 'https://nevadaepro.com', utcOffset: -8 },
};

const SEARCH_PATH = '/bso/view/search/external/advancedSearchBid.xhtml';
const PAGE_ROWS = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal cookie jar for one portal session. */
class Session {
    constructor(host, log) {
        this.host = host;
        this.log = log;
        this.cookies = new Map();
    }

    remember(res) {
        const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
        for (const c of list) {
            const [pair] = c.split(';');
            const i = pair.indexOf('=');
            if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
        }
    }

    async request(path, { method = 'GET', body, headers = {}, retries = 2 } = {}) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(new URL(path, this.host), {
                    method,
                    body,
                    redirect: 'follow',
                    signal: AbortSignal.timeout(45_000),
                    headers: {
                        'User-Agent': BROWSER_UA,
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
                        ...headers,
                    },
                });
                this.remember(res);
                if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} from ${new URL(this.host).host}`), { status: res.status });
                return await res.text();
            } catch (err) {
                lastError = err;
                if (attempt < retries) await sleep(2000 * 2 ** attempt);
            }
        }
        throw lastError;
    }
}

/** Column labels from the results table header, in order. */
function headerLabels(html) {
    const head = html.match(/<thead id="bidSearchResultsForm:bidResultId_head">([\s\S]*?)<\/thead>/);
    if (!head) return [];
    return [...head[1].matchAll(/<th[^>]*aria-label="([^"]*)"[^>]*>/g)].map((m) => decodeEntities(m[1]).trim());
}

const DEFAULT_LABELS = ['Bid Solicitation #', 'Bid Solicitation #', 'Organization Name', 'Blanket #', 'Blanket #', 'Buyer', 'Description', 'Bid Opening Date', 'Awarded Vendor(s)', 'Status', 'Alternate Id'];

/** Parses result rows (from the full page or a paging response) into plain objects. */
export function parseRows(html, labels = DEFAULT_LABELS) {
    const rows = [];
    for (const m of String(html).matchAll(/<tr data-ri="\d+"[^>]*>([\s\S]*?)<\/tr>/g)) {
        const cells = [...m[1].matchAll(/<td role="gridcell"[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
        const at = (label) => {
            const i = labels.indexOf(label);
            return i >= 0 && i < cells.length ? clean(cells[i].replace(/<[^>]+>/g, ' ')) : null;
        };
        const link = m[1].match(/href="([^"]*bidDetail\.sda\?docId=([^&"]+)[^"]*)"/);
        if (!link) continue;
        rows.push({
            docId: decodeEntities(link[2]),
            organization: at('Organization Name'),
            title: at('Description'),
            openingDate: at('Bid Opening Date'),
            status: at('Status'),
            alternateId: at('Alternate Id'),
        });
    }
    return rows;
}

function formTokens(html) {
    const i = html.indexOf('<form id="bidSearchResultsForm"');
    const form = i >= 0 ? html.slice(i) : html;
    return {
        viewState: form.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)?.[1],
        csrf: form.match(/name="_csrf" value="([^"]+)"/)?.[1],
    };
}

/** Every open bid on one portal. Returns { rows, total }. */
export async function searchPeriscope(state, { log, shouldStop = () => false } = {}) {
    const portal = PERISCOPE_PORTALS[state];
    const session = new Session(portal.host, log);
    const firstUrl = `${SEARCH_PATH}?openBids=true`;
    const html = await session.request(firstUrl);
    const labels = headerLabels(html);
    const rows = parseRows(html, labels.length ? labels : DEFAULT_LABELS);
    const total = Number(html.match(/ui-paginator-current[^>]*>\s*\d+-\d+ of (\d+)/)?.[1] ?? rows.length);
    const { viewState, csrf } = formTokens(html);
    if (!viewState || !csrf) {
        if (total > rows.length) log?.warning?.(`${portal.name}: could not page past the first ${rows.length} bids`);
        return { rows, total };
    }
    for (let first = rows.length; first < total; first += PAGE_ROWS) {
        if (shouldStop()) break;
        const body = new URLSearchParams({
            'javax.faces.partial.ajax': 'true',
            'javax.faces.source': 'bidSearchResultsForm:bidResultId',
            'javax.faces.partial.execute': 'bidSearchResultsForm:bidResultId',
            'javax.faces.partial.render': 'bidSearchResultsForm:bidResultId',
            'bidSearchResultsForm:bidResultId_pagination': 'true',
            'bidSearchResultsForm:bidResultId_first': String(first),
            'bidSearchResultsForm:bidResultId_rows': String(PAGE_ROWS),
            'bidSearchResultsForm:bidResultId_encodeFeature': 'true',
            bidSearchResultsForm: 'bidSearchResultsForm',
            _csrf: csrf,
            'javax.faces.ViewState': viewState,
        });
        const xml = await session.request(SEARCH_PATH, {
            method: 'POST',
            body,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Faces-Request': 'partial/ajax',
                'X-Requested-With': 'XMLHttpRequest',
                Origin: portal.host,
                Referer: new URL(firstUrl, portal.host).href,
            },
        });
        const page = parseRows(xml, labels.length ? labels : DEFAULT_LABELS);
        if (!page.length) {
            log?.warning?.(`${portal.name}: paging stopped at ${rows.length} of ${total} bids`);
            break;
        }
        rows.push(...page);
    }
    return { rows, total };
}

export const detailUrl = (state, docId) => `${PERISCOPE_PORTALS[state].host}/bso/external/bidDetail.sda?docId=${encodeURIComponent(docId)}&external=true&parentUrl=close`;

/** Bids from the state's own agencies vs. cities, counties, schools and other local buyers. */
export function governmentLevel(organization, state) {
    const o = String(organization ?? '');
    if (/\b(city|town|village|borough|township|county|school|schools|isd|usd|district|municipal|authority|regional|college|community|library|housing|fire|water|sewer|transit|port of|public schools|parish)\b/i.test(o)
        && !/\b(state|commonwealth|department|dept|office of|executive office|division|bureau|commission)\b/i.test(o)) return 'local';
    if (state === 'OR' && /^[A-Z]{2,4}$/.test(o)) return 'state';
    return 'state';
}

export function mapPeriscopeRow(state, row, scrapedAt) {
    const portal = PERISCOPE_PORTALS[state];
    return {
        source: PERISCOPE_SOURCE,
        source_name: portal.name,
        government_level: governmentLevel(row.organization, state),
        notice_id: `${state}-${row.docId}`,
        solicitation_number: row.docId,
        title: row.title,
        notice_type: 'Solicitation',
        status: 'Open',
        buyer: row.organization,
        agency: row.organization,
        sub_agency: null,
        office: null,
        state,
        location_basis: 'portal_state',
        place_of_performance_city: null,
        place_of_performance_zip: null,
        place_of_performance_country: 'USA',
        office_city: null,
        office_state: state,
        posted_date: null,
        response_deadline: usDateToIso(row.openingDate, row.openingDate, portal.utcOffset),
        naics_codes: [],
        product_service_code: null,
        commodity_codes: [],
        set_aside: null,
        set_aside_code: null,
        description: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        attachments: [],
        award_amount: null,
        award_date: null,
        awardee_name: null,
        awardee_uei: null,
        url: detailUrl(state, row.docId),
        alternate_id: row.alternateId,
        last_updated: null,
        scraped_at: scrapedAt,
        _commodityText: '',
    };
}

/** Reads the "Label: value" table cells on a bid detail page. */
export function parseDetail(html) {
    const body = String(html ?? '');
    const field = (label) => {
        const words = label.replace(/:$/, '').trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
        const re = new RegExp(`<td class="t-head-01"[^>]*>\\s*${words}\\s*:\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i');
        const m = body.match(re);
        return m ? m[1] : null;
    };
    const text = (label) => clean(htmlToText(field(label) ?? ''));
    const contact = text('Info Contact:');
    const shipTo = htmlToText(field('Ship-to Address:') ?? '');
    const cityState = shipTo.match(/^\s*([A-Za-z .'-]+),\s+([A-Z]{2})\s+(\d{5})/m);
    const codes = [];
    for (const m of body.matchAll(/<u>\s*([\d-]{5,})\s*<\/u>\s*<br>(?:&nbsp;|\s)*([^<]+)/g)) codes.push(`${m[1]} ${clean(m[2])}`);
    for (const m of body.matchAll(/(NIGP|UNSPSC)[^<]{0,20}<\/td>\s*<td[^>]*>\s*([^<]+)/gi)) codes.push(clean(m[2]));
    const attachments = [];
    for (const m of body.matchAll(/href="(\/bso\/external\/bidAttachment[^"]*|javascript:downloadFile\('[^']+'\))"[^>]*>\s*([^<]+)/gi)) {
        const href = decodeEntities(m[1]);
        const file = href.match(/downloadFile\('([^']+)'\)/)?.[1];
        attachments.push({ name: clean(m[2]), url: file ? null : href, file_id: file ?? null });
    }
    const email = cleanEmail(contact);
    const posted = text('Available Date:');
    const desc = [text('Bulletin Desc:'), text('Pre Bid Conference:') ? `Pre-bid conference: ${text('Pre Bid Conference:')}` : null].filter(Boolean).join('\n\n');
    return {
        title: text('Description:'),
        organization: text('Organization:'),
        department: text('Department:'),
        contact_name: !contact ? clean(text('Purchaser:')) : clean(contact.replace(email ?? '', '').replace(/[,;]\s*$/, '').replace(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}.*$/, '')),
        contact_email: email,
        contact_phone: formatPhone(contact?.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(\s*(ext\.?|x)\s*\d+)?/i)?.[0]),
        description: truncate(desc, 6000) || null,
        purchase_method: text('Purchase Method:'),
        posted_date_raw: posted,
        city: cityState ? clean(cityState[1]) : null,
        zip: cityState ? cityState[3] : null,
        commodity_codes: [...new Set(codes)].slice(0, 20),
        attachments: attachments.filter((a) => a.url),
    };
}

export async function fetchPeriscopeDetail(state, rec, { log } = {}) {
    const session = new Session(PERISCOPE_PORTALS[state].host, log);
    const html = await session.request(rec.url, { retries: 1 });
    return parseDetail(html);
}

export function applyPeriscopeDetail(rec, d, state) {
    const offset = PERISCOPE_PORTALS[state].utcOffset;
    rec.title = rec.title ?? d.title;
    if (d.organization) rec.agency = d.organization;
    if (d.department && d.department !== d.organization) rec.office = d.department.replace(/^[A-Z0-9]+ - /, '');
    rec.buyer = d.organization ?? rec.buyer;
    rec.government_level = governmentLevel(rec.buyer, state);
    rec.contact_name = d.contact_name;
    rec.contact_email = d.contact_email;
    rec.contact_phone = d.contact_phone;
    rec.description = d.description;
    rec.place_of_performance_city = d.city;
    rec.place_of_performance_zip = d.zip;
    rec.commodity_codes = d.commodity_codes;
    rec.attachments = d.attachments;
    if (d.purchase_method) rec.notice_type = d.purchase_method === 'Open Market' ? 'Solicitation' : `Solicitation (${d.purchase_method})`;
    if (d.posted_date_raw) rec.posted_date = usDateToIso(d.posted_date_raw, d.posted_date_raw, offset);
    rec._commodityText = d.commodity_codes.join('; ');
    return rec;
}
