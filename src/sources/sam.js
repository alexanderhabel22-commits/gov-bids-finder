// SAM.gov contract opportunities (federal).
//
// SAM.gov's own website loads its search results from a public JSON endpoint
// that needs no API key. Search hits are short (title, dates, agency); the
// full notice (NAICS, set-aside, place of performance, contacts, description)
// and its attachments come from two more public endpoints per notice.

import { fetchJson } from '../http.js';
import { htmlToText, clean, cleanEmail, formatPhone, toIso, truncate } from '../normalize.js';

export const SAM_SOURCE = 'sam_gov';
const SEARCH = 'https://sam.gov/api/prod/sgs/v1/search/';
const DETAIL = (id) => `https://sam.gov/api/prod/opps/v2/opportunities/${id}`;
const RESOURCES = (id) => `https://sam.gov/api/prod/opps/v3/opportunities/${id}/resources`;
const DOWNLOAD = (resourceId) => `https://sam.gov/api/prod/opps/v3/opportunities/resources/files/${resourceId}/download`;
export const noticeUrl = (id) => `https://sam.gov/opp/${id}/view`;
const PAGE_SIZE = 100;
const MAX_RECORDS = 10_000; // SAM.gov will not page past this per query.

export const NOTICE_TYPES = {
    solicitation: { code: 'o', title: 'Solicitation' },
    combined_synopsis: { code: 'k', title: 'Combined Synopsis/Solicitation' },
    presolicitation: { code: 'p', title: 'Presolicitation' },
    sources_sought: { code: 'r', title: 'Sources Sought' },
    special_notice: { code: 's', title: 'Special Notice' },
    award: { code: 'a', title: 'Award Notice' },
    intent_to_bundle: { code: 'i', title: 'Intent to Bundle Requirements' },
    justification: { code: 'u', title: 'Justification' },
};
const TYPE_BY_CODE = Object.fromEntries(Object.entries(NOTICE_TYPES).map(([id, t]) => [t.code, id]));

/** Set-aside filter ids, the SAM.gov codes each one covers, and display names. */
export const SET_ASIDES = {
    small_business: { codes: ['SBA', 'SBP'], title: 'Total or partial small business' },
    '8a': { codes: ['8A', '8AN'], title: '8(a)' },
    hubzone: { codes: ['HZC', 'HZS'], title: 'HUBZone' },
    sdvosb: { codes: ['SDVOSBC', 'SDVOSBS'], title: 'Service-disabled veteran-owned' },
    vosb: { codes: ['VSA', 'VSS'], title: 'Veteran-owned (VA)' },
    wosb: { codes: ['WOSB', 'WOSBSS'], title: 'Women-owned' },
    edwosb: { codes: ['EDWOSB', 'EDWOSBSS'], title: 'Economically disadvantaged women-owned' },
    indian_economic: { codes: ['IEE', 'ISBEE', 'BICiv'], title: 'Indian / Buy Indian' },
};
export const SET_ASIDE_NAMES = {
    SBA: 'Total Small Business', SBP: 'Partial Small Business', '8A': '8(a) Set-Aside', '8AN': '8(a) Sole Source',
    HZC: 'HUBZone Set-Aside', HZS: 'HUBZone Sole Source', SDVOSBC: 'Service-Disabled Veteran-Owned Small Business Set-Aside',
    SDVOSBS: 'Service-Disabled Veteran-Owned Small Business Sole Source', WOSB: 'Women-Owned Small Business Set-Aside',
    WOSBSS: 'Women-Owned Small Business Sole Source', EDWOSB: 'Economically Disadvantaged WOSB Set-Aside',
    EDWOSBSS: 'Economically Disadvantaged WOSB Sole Source', VSA: 'Veteran-Owned Small Business Set-Aside (VA)',
    VSS: 'Veteran-Owned Small Business Sole Source (VA)', IEE: 'Indian Economic Enterprise Set-Aside',
    ISBEE: 'Indian Small Business Economic Enterprise Set-Aside', BICiv: 'Buy Indian Set-Aside',
};

/** Builds a SAM.gov search URL. Arrays become comma lists, which SAM.gov reads as "any of". */
export function searchUrl({ page = 0, noticeTypes = [], naics = [], keywords = [], popStates = [], setAsides = [], postedFrom = null }) {
    const p = new URLSearchParams({ index: 'opp', page: String(page), mode: 'search', sort: '-modifiedDate', size: String(PAGE_SIZE), mfe: 'true', is_active: 'true' });
    if (noticeTypes.length) p.set('notice_type', noticeTypes.map((t) => NOTICE_TYPES[t]?.code ?? t).join(','));
    if (naics.length) p.set('naics', naics.join(','));
    if (keywords.length) {
        p.set('q', keywords.map((k) => (/\s/.test(k) ? `"${k}"` : k)).join(' '));
        p.set('qMode', 'ANY');
    }
    if (popStates.length) p.set('pop_state', popStates.join(','));
    if (setAsides.length) p.set('set_aside', setAsides.join(','));
    if (postedFrom) p.set('publish_date.from', `${postedFrom}-00:00`);
    return `${SEARCH}?${p}`;
}

/**
 * Runs one search and reads every page. Returns { hits, total, truncated }.
 * `truncated` is true when SAM.gov had more than it will return.
 */
export async function searchSam(params, { log, shouldStop = () => false, maxHits = MAX_RECORDS } = {}) {
    const hits = [];
    let total = 0;
    for (let page = 0; page * PAGE_SIZE < Math.min(maxHits, MAX_RECORDS); page++) {
        if (shouldStop()) break;
        const data = await fetchJson(searchUrl({ ...params, page }), { log, headers: { Accept: 'application/hal+json, application/json' } });
        total = data?.page?.totalElements ?? 0;
        const results = data?._embedded?.results ?? [];
        hits.push(...results);
        if (results.length < PAGE_SIZE || hits.length >= total) break;
    }
    return { hits, total, truncated: total > hits.length };
}

/** The contracting office's state, from the agency hierarchy in a search hit. */
export function officeOf(hit) {
    const levels = hit.organizationHierarchy ?? [];
    const office = [...levels].reverse().find((l) => l.address?.state) ?? levels[levels.length - 1] ?? {};
    return {
        agency: clean(levels.find((l) => l.level === 1)?.name),
        sub_agency: levels.length > 2 && levels[1]?.name !== levels[0]?.name ? clean(levels.find((l) => l.level === 2)?.name) : null,
        office: clean(levels.length > 2 ? levels[levels.length - 1]?.name : null),
        office_city: clean(office.address?.city),
        office_state: clean(office.address?.state)?.toUpperCase() ?? null,
        office_zip: clean(office.address?.zip),
    };
}

export async function fetchSamDetail(id, { log } = {}) {
    return fetchJson(DETAIL(id), { log, retries: 2, headers: { Accept: '*/*' } });
}

export async function fetchSamAttachments(id, { log } = {}) {
    const data = await fetchJson(RESOURCES(id), { log, retries: 1, headers: { Accept: '*/*' } });
    const lists = data?._embedded?.opportunityAttachmentList ?? [];
    return lists.flatMap((l) => l.attachments ?? [])
        .filter((a) => a.deletedFlag !== '1' && (a.accessLevel ?? 'public') === 'public')
        .map((a) => (a.type === 'link' ? { name: clean(a.name) ?? a.uri, url: a.uri } : { name: clean(a.name), url: DOWNLOAD(a.resourceId) }))
        .filter((a) => a.url);
}

const orgCache = new Map();

/** Agency names for a notice whose search hit came without them: "DEPT.AGENCY.OFFICE" path. */
export async function fetchSamOrg(orgId, { log } = {}) {
    if (!orgId) return null;
    if (!orgCache.has(orgId)) {
        orgCache.set(orgId, fetchJson(`https://sam.gov/api/prod/federalorganizations/v1/organizations/${orgId}`, { log, retries: 1, headers: { Accept: '*/*' } })
            .then((d) => {
                const parts = String(d?._embedded?.[0]?.org?.fullParentPathName ?? '').split('.').map((x) => clean(x)).filter(Boolean);
                return parts.length ? { agency: parts[0], sub_agency: parts.length > 2 ? parts[1] : null, office: parts.length > 1 ? parts[parts.length - 1] : null } : null;
            })
            .catch(() => null));
    }
    return orgCache.get(orgId);
}

const title = (s) => (s ? s.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()) : s);

/** Merges a search hit and (optional) detail record into one output-shaped record. */
export function mapSam(hit, detail, attachments, scrapedAt, { includeContacts = true, org = null } = {}) {
    const d2 = detail?.data2 ?? {};
    const office = officeOf(hit);
    if (!office.agency && org) Object.assign(office, org);
    const pop = d2.placeOfPerformance ?? {};
    const contact = (d2.pointOfContact ?? []).find((c) => c.type === 'primary') ?? (d2.pointOfContact ?? [])[0] ?? {};
    const naics = (d2.naics ?? []).flatMap((n) => n.code ?? []);
    const typeCode = d2.type ?? hit.type?.code;
    const setAsideCode = d2.solicitation?.setAside ?? null;
    const awardee = d2.award?.awardee ?? hit.award?.awardee ?? {};
    const description = htmlToText(detail?.description?.map((x) => x.body).join('\n\n')) || htmlToText(hit.descriptions?.[0]?.content);
    const popState = clean(pop.state?.code)?.toUpperCase() ?? null;
    return {
        source: SAM_SOURCE,
        source_name: 'SAM.gov (federal)',
        government_level: 'federal',
        notice_id: hit._id,
        solicitation_number: clean(hit.solicitationNumber ?? d2.solicitationNumber),
        title: clean(hit.title ?? d2.title),
        notice_type: NOTICE_TYPES[TYPE_BY_CODE[typeCode]]?.title ?? clean(hit.type?.value),
        status: hit.isCanceled ? 'Cancelled' : 'Active',
        buyer: office.office ?? office.sub_agency ?? office.agency,
        agency: office.agency,
        sub_agency: office.sub_agency,
        office: office.office,
        state: popState ?? office.office_state,
        location_basis: popState ? 'place_of_performance' : office.office_state ? 'contracting_office' : null,
        place_of_performance_city: clean(pop.city?.name),
        place_of_performance_zip: clean(pop.zip),
        place_of_performance_country: clean(pop.country?.code),
        office_city: office.office_city ? title(office.office_city) : null,
        office_state: office.office_state,
        posted_date: toIso(hit.publishDate ?? detail?.postedDate),
        response_deadline: toIso(hit.responseDateActual ?? hit.responseDate ?? d2.solicitation?.deadlines?.response),
        naics_codes: naics,
        product_service_code: clean(d2.classificationCode),
        commodity_codes: [],
        set_aside: setAsideCode ? SET_ASIDE_NAMES[setAsideCode] ?? setAsideCode : null,
        set_aside_code: setAsideCode,
        description: truncate(description, 6000),
        contact_name: includeContacts ? clean(contact.fullName) : null,
        contact_email: includeContacts ? cleanEmail(contact.email) : null,
        contact_phone: includeContacts ? formatPhone(contact.phone) : null,
        attachments: attachments ?? [],
        award_amount: d2.award?.amount != null ? Number(d2.award.amount) || null : null,
        award_date: toIso(d2.award?.date),
        awardee_name: clean(awardee.name),
        awardee_uei: clean(awardee.ueiSAM),
        url: noticeUrl(hit._id),
        last_updated: toIso(hit.modifiedDate ?? detail?.modifiedDate),
        scraped_at: scrapedAt,
        _hasDetail: Boolean(detail),
        _popState: popState,
    };
}
