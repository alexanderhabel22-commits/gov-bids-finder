// Texas Electronic State Business Daily (ESBD) on txsmartbuy.gov.
//
// Every Texas state agency, and many cities, counties, school districts,
// colleges and utility districts that are Texas SmartBuy members, must post
// bids over $25,000 here. The search page loads results from a public JSON
// service; each bid's page is server-rendered with the description, contact
// and attachments.

import { fetchText } from '../http.js';
import { BROWSER_UA } from '../http.js';
import { clean, cleanEmail, decodeEntities, formatPhone, htmlToText, truncate, usDateToIso } from '../normalize.js';

export const TEXAS_SOURCE = 'texas_esbd';
const BASE = 'https://www.txsmartbuy.gov';
const SERVICE = `${BASE}/app/extensions/CPA/CPAMain/1.0.0/services/ESBD.Service.ss`;
const CENTRAL = -6; // Central Standard Time

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJson(body, { log, retries = 3 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(SERVICE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': BROWSER_UA, Origin: BASE, Referer: `${BASE}/esbd` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(45_000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} from txsmartbuy.gov`);
            return await res.json();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                log?.debug?.(`Texas ESBD request failed (${err.message}); retrying`);
                await sleep(2000 * 2 ** attempt);
            }
        }
    }
    throw lastError;
}

/**
 * Open bids (status "Posted", which includes bids with addenda). One request
 * per keyword when keywords are given, else every open bid. Returns raw lines.
 */
export async function searchTexas({ keywords = [] } = {}, { log, shouldStop = () => false } = {}) {
    const queries = keywords.length ? keywords : [null];
    const byId = new Map();
    for (const keyword of queries) {
        for (let page = 1; page < 500; page++) {
            if (shouldStop()) return [...byId.values()];
            const body = { lines: [], page, urlRoot: 'esbd', status: '1' };
            if (keyword) body.keyword = keyword;
            const data = await postJson(body, { log });
            const lines = data?.lines ?? [];
            for (const l of lines) byId.set(l.internalid ?? l.solicitationId, l);
            const perPage = data?.recordsPerPage ?? 24;
            if (lines.length < perPage || page * perPage >= (data?.totalRecordsFound ?? 0)) break;
        }
    }
    return [...byId.values()];
}

/** "Abilene ISD - S2211" -> { name: "Abilene ISD", number: "S2211" }. */
export function splitAgency(s) {
    const m = String(s ?? '').match(/^(.*?)\s+-\s+([A-Z]?\d+[A-Z]?)\s*$/);
    return m ? { name: clean(m[1]), number: m[2] } : { name: clean(s), number: null };
}

/** Texas state agencies have numeric member numbers; local members have a letter prefix. */
export const isStateAgency = (number) => /^\d+$/.test(String(number ?? ''));

/** "91558-Mailing Services (...);\n91544-..." -> [{ code, name }]. */
export function parseNigp(s) {
    return String(s ?? '')
        .split(/;\s*/)
        .map((x) => x.trim().match(/^(\d{3,5})-(.+)$/))
        .filter(Boolean)
        .map((m) => ({ code: m[1], name: clean(m[2]) }));
}

export const texasUrl = (solicitationId) => `${BASE}/esbd/${encodeURIComponent(solicitationId)}`;

export function mapTexasLine(l, scrapedAt) {
    const agency = splitAgency(l.agencyName);
    const nigp = parseNigp(l.nigpCodes);
    return {
        source: TEXAS_SOURCE,
        source_name: 'Texas ESBD (state & local)',
        government_level: isStateAgency(agency.number ?? l.agencyNumber) ? 'state' : 'local',
        notice_id: `TX-${l.internalid}`,
        solicitation_number: clean(l.solicitationId),
        title: clean(l.title),
        notice_type: 'Solicitation',
        status: clean(l.statusName),
        buyer: agency.name,
        agency: agency.name,
        sub_agency: null,
        office: null,
        state: 'TX',
        location_basis: 'portal_state',
        place_of_performance_city: null,
        place_of_performance_zip: null,
        place_of_performance_country: 'USA',
        office_city: null,
        office_state: 'TX',
        posted_date: usDateToIso(l.postingDate, '12:00 AM', CENTRAL),
        response_deadline: usDateToIso(l.responseDue, l.responseTime || '11:59 PM', CENTRAL),
        naics_codes: [],
        product_service_code: null,
        commodity_codes: nigp.map((n) => `NIGP ${n.code} ${n.name}`),
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
        url: texasUrl(l.solicitationId),
        external_url: clean(l.url) || null,
        last_updated: usDateToIso(l.lastModified, l.lastModified, CENTRAL),
        scraped_at: scrapedAt,
        _nigp: nigp.map((n) => n.code),
        _commodityText: nigp.map((n) => n.name).join('; '),
    };
}

/** Reads the labelled cells, description and attachments from the server-rendered bid page. */
export function parseTexasDetail(html) {
    const body = String(html ?? '');
    const field = (label) => {
        const re = new RegExp(`<strong>\\s*${label}:?(?:\\s|&nbsp;)*</strong>\\s*<p>([^<]*)</p>`, 'i');
        const m = body.match(re);
        return m ? clean(m[1]) : null;
    };
    let description = null;
    const d = body.match(/Solicitation Description:?(?:\s|&nbsp;)*<\/strong>\s*<div class="rich-text-editor-content">([\s\S]*?)<\/div>\s*<\/div>/i);
    if (d) description = htmlToText(d[1]);
    const attachments = [];
    for (const m of body.matchAll(/data-href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi)) {
        attachments.push({ name: clean(m[2]).replace(/^ESBD_\d+_\d+_/, ''), url: new URL(decodeEntities(m[1]), BASE).href });
    }
    return {
        contact_name: field('Contact Name'),
        contact_phone: formatPhone(field('Contact Number')),
        contact_email: cleanEmail(field('Contact Email')),
        description: truncate(description, 6000) || null,
        attachments,
    };
}

export async function fetchTexasDetail(rec, { log } = {}) {
    const { text } = await fetchText(rec.url, { log, retries: 2 });
    return parseTexasDetail(text);
}
