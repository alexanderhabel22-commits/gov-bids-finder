// US Government Bids & RFPs: Apify Actor entry point.
//
// 1. Read the input (what you sell, where, which notice types).
// 2. Search SAM.gov for federal opportunities and the state portals (Texas
//    ESBD and the Periscope portals of MA, IL, NJ, OR and NV) for state and
//    local bids.
// 3. Keep the bids that match, open each one for its description, contact
//    and attachments, merge duplicates, and push one row per bid, charging
//    the "opportunity" pay-per-event event.

import { pathToFileURL } from 'node:url';
import { Actor, log } from 'apify';
import { CATEGORIES, CATEGORY_IDS, categoriesFor, escapeRegex, keywordRegex, naicsForCategories } from './categories.js';
import { US_STATES, daysUntil, solicitationKey } from './normalize.js';
import { mapPool } from './http.js';
import { NOTICE_TYPES, SET_ASIDES, SAM_SOURCE, searchSam, officeOf, fetchSamDetail, fetchSamAttachments, fetchSamOrg, mapSam } from './sources/sam.js';
import { TEXAS_SOURCE, searchTexas, mapTexasLine, fetchTexasDetail } from './sources/texas.js';
import { PERISCOPE_PORTALS, PERISCOPE_SOURCE, searchPeriscope, mapPeriscopeRow, fetchPeriscopeDetail, applyPeriscopeDetail } from './sources/periscope.js';

export const CHARGE_EVENT = 'opportunity';
export const STATE_PORTAL_STATES = ['TX', ...Object.keys(PERISCOPE_PORTALS)];
const DEFAULT_NOTICE_TYPES = ['solicitation', 'combined_synopsis', 'presolicitation', 'sources_sought'];

/** When Apify will stop the run, minus a margin for saving. Null locally. */
export function runDeadline(env = process.env, marginMs = 60_000) {
    const at = Date.parse(env.ACTOR_TIMEOUT_AT ?? env.APIFY_TIMEOUT_AT ?? '');
    return Number.isFinite(at) ? at - marginMs : null;
}

const clampInt = (v, def, lo, hi) => {
    const n = Number(v ?? def);
    return Number.isFinite(n) ? Math.max(lo, Math.min(Math.round(n), hi)) : def;
};

const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(/[,\n]/));

/** Validates and fills defaults. Throws a plain-language message on bad input. */
export function parseInput(raw = {}) {
    const categories = [...new Set(list(raw.categories ?? ['construction']).map((c) => String(c).trim()).filter(Boolean))];
    const badCats = categories.filter((c) => !CATEGORIES[c]);
    if (badCats.length) throw new Error(`Unknown category: ${badCats.join(', ')}. Use one of ${CATEGORY_IDS.join(', ')}.`);

    const keywords = [...new Set(list(raw.keywords).map((k) => String(k).trim().toLowerCase()).filter((k) => k.length >= 2))];
    const naicsCodes = [...new Set(list(raw.naicsCodes).map((n) => String(n).replace(/\D/g, '')).filter(Boolean))];
    const badNaics = naicsCodes.filter((n) => n.length < 2 || n.length > 6);
    if (badNaics.length) throw new Error(`NAICS codes must be 2 to 6 digits: ${badNaics.join(', ')}.`);

    const states = [...new Set(list(raw.states).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
    const badStates = states.filter((s) => !US_STATES[s]);
    if (badStates.length) throw new Error(`Unknown state code: ${badStates.join(', ')}. Use two-letter codes such as TX.`);

    const noticeTypes = [...new Set(list(raw.noticeTypes ?? DEFAULT_NOTICE_TYPES).filter(Boolean))];
    const badTypes = noticeTypes.filter((t) => !NOTICE_TYPES[t]);
    if (badTypes.length) throw new Error(`Unknown notice type: ${badTypes.join(', ')}. Use one of ${Object.keys(NOTICE_TYPES).join(', ')}.`);

    const setAsides = [...new Set(list(raw.setAsides).filter(Boolean))];
    const badSa = setAsides.filter((s) => !SET_ASIDES[s]);
    if (badSa.length) throw new Error(`Unknown set-aside: ${badSa.join(', ')}. Use one of ${Object.keys(SET_ASIDES).join(', ')}.`);

    const includeFederal = raw.includeFederal !== false;
    const includeStateLocal = raw.includeStateLocal !== false;
    if (!includeFederal && !includeStateLocal) throw new Error('Turn on federal bids, state & local bids, or both.');

    return {
        categories,
        keywords,
        naicsCodes,
        states,
        noticeTypes: noticeTypes.length ? noticeTypes : DEFAULT_NOTICE_TYPES,
        setAsides,
        postedWithinDays: clampInt(raw.postedWithinDays, 0, 0, 3650),
        onlyOpen: raw.onlyOpen !== false,
        includeFederal,
        includeStateLocal,
        matchContractingOfficeState: raw.matchContractingOfficeState !== false,
        includeDetails: raw.includeDetails !== false,
        includeContacts: raw.includeContacts === true,
        maxResults: clampInt(raw.maxResults, 1000, 1, 50_000),
    };
}

const GENERIC_MAILBOX = /^(procurement|purchasing|purchases|bids?|bidding|contracts?|contracting|solicitations?|rfps?|acquisitions?|buyers?|info|admin|office|finance|business|vendors?|supply|supplies|materials|sourcing|ops|operations|help|support|questions|inquiries|general|main|clerk|cityclerk|townclerk)[a-z0-9._-]*@/i;

/** Without the buyer-contact option, drop named people: keep only role mailboxes such as bids@ or purchasing@. */
export function scrubContact(rec, input) {
    if (input.includeContacts) return rec;
    rec.contact_name = null;
    rec.contact_phone = null;
    if (rec.contact_email && !GENERIC_MAILBOX.test(rec.contact_email)) rec.contact_email = null;
    return rec;
}

/** True when the input narrows by what is being bought (not just where). */
export const isNarrowed = (input) => Boolean(input.categories.length || input.keywords.length || input.naicsCodes.length);

/** Builds the "does this bid match what the user sells" test. */
export function matcher(input) {
    const kw = keywordRegex(input.keywords.map(escapeRegex));
    return (rec, { titleOnly = false } = {}) => {
        const matched = categoriesFor({
            title: rec.title,
            description: titleOnly ? '' : rec.description,
            naics: rec.naics_codes,
            nigp: rec._nigp ?? [],
            commodities: rec._commodityText ?? '',
        }, input.categories.length ? input.categories : []);
        const text = titleOnly ? `${rec.title ?? ''} ${rec._commodityText ?? ''}` : `${rec.title ?? ''} ${rec._commodityText ?? ''} ${rec.description ?? ''}`;
        const keywordHits = kw ? input.keywords.filter((k) => keywordRegex([escapeRegex(k)]).test(text)) : [];
        const naicsHit = input.naicsCodes.length && rec.naics_codes.some((c) => input.naicsCodes.some((p) => c.startsWith(p)));
        return { matched_categories: matched, matched_keywords: keywordHits, ok: !isNarrowed(input) || matched.length > 0 || keywordHits.length > 0 || Boolean(naicsHit) };
    };
}

/** Same bid, listed twice: same notice id, or same solicitation number in the same state. */
export class BidDeduper {
    constructor() {
        this.rows = [];
        this.index = new Map();
    }

    static keys(rec) {
        const keys = [`id:${rec.notice_id}`];
        const sol = solicitationKey(rec.solicitation_number);
        if (sol && sol.length >= 6) keys.push(`sol:${sol}|${rec.state ?? ''}|${rec.government_level}`);
        return keys;
    }

    add(rec) {
        const keys = BidDeduper.keys(rec);
        const hit = keys.map((k) => this.index.get(k)).find((i) => i !== undefined);
        if (hit === undefined) {
            this.rows.push(rec);
            for (const k of keys) this.index.set(k, this.rows.length - 1);
            return true;
        }
        const old = this.rows[hit];
        // Keep the newest version of the notice (e.g. the solicitation that followed a presolicitation).
        const newer = (rec.last_updated ?? rec.posted_date ?? '') > (old.last_updated ?? old.posted_date ?? '');
        const [keep, other] = newer ? [rec, old] : [old, rec];
        for (const [k, v] of Object.entries(other)) if (keep[k] == null || keep[k] === '') keep[k] = v;
        keep.related_notice_ids = [...new Set([...(keep.related_notice_ids ?? []), other.notice_id, ...(other.related_notice_ids ?? [])])].filter((id) => id !== keep.notice_id);
        this.rows[hit] = keep;
        for (const k of BidDeduper.keys(keep)) this.index.set(k, hit);
        return false;
    }
}

/** Takes rows from each list in turn, so a capped run still covers every source. */
export function interleave(lists) {
    const out = [];
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
}

/** Final output row with a fixed field order and no internal fields. */
export function toOutputRow(rec, now = Date.now()) {
    return {
        title: rec.title,
        government_level: rec.government_level,
        buyer: rec.buyer,
        state: rec.state,
        notice_type: rec.notice_type,
        response_deadline: rec.response_deadline,
        days_left: daysUntil(rec.response_deadline, now),
        posted_date: rec.posted_date,
        matched_categories: rec.matched_categories ?? [],
        matched_keywords: rec.matched_keywords ?? [],
        set_aside: rec.set_aside,
        naics_codes: rec.naics_codes,
        product_service_code: rec.product_service_code,
        commodity_codes: rec.commodity_codes,
        solicitation_number: rec.solicitation_number,
        description: rec.description,
        contact_name: rec.contact_name,
        contact_email: rec.contact_email,
        contact_phone: rec.contact_phone,
        agency: rec.agency,
        sub_agency: rec.sub_agency,
        office: rec.office,
        office_city: rec.office_city,
        office_state: rec.office_state,
        place_of_performance_city: rec.place_of_performance_city,
        place_of_performance_zip: rec.place_of_performance_zip,
        location_basis: rec.location_basis,
        attachments: rec.attachments ?? [],
        award_amount: rec.award_amount,
        award_date: rec.award_date,
        awardee_name: rec.awardee_name,
        awardee_uei: rec.awardee_uei,
        status: rec.status,
        url: rec.url,
        external_url: rec.external_url ?? null,
        source: rec.source,
        source_name: rec.source_name,
        notice_id: rec.notice_id,
        related_notice_ids: rec.related_notice_ids ?? [],
        last_updated: rec.last_updated,
        scraped_at: rec.scraped_at,
    };
}

/** Newest first; bids with no posting date go after, soonest deadline first. */
export function rank(rows) {
    return rows.sort((a, b) => (b.posted_date ?? '').localeCompare(a.posted_date ?? '')
        || (a.response_deadline ?? '9').localeCompare(b.response_deadline ?? '9')
        || (a.title ?? '').localeCompare(b.title ?? ''));
}

export async function collect(input, { log: logger = log, deadline = runDeadline(), now = Date.now() } = {}) {
    const outOfTime = () => deadline != null && Date.now() > deadline;
    let warnedTime = false;
    const late = (what) => () => {
        if (!outOfTime()) return false;
        if (!warnedTime) logger.warning(`Running out of time: skipping the rest of the ${what}. Raise the run timeout to get everything.`);
        warnedTime = true;
        return true;
    };
    const scrapedAt = new Date(now).toISOString();
    const match = matcher(input);
    const stat = () => ({ searched: 0, found: 0, matched: 0, errors: 0, last_error: null });
    const stats = { [SAM_SOURCE]: stat(), [TEXAS_SOURCE]: stat(), [PERISCOPE_SOURCE]: stat(), details: { tried: 0, ok: 0, failed: 0 } };
    const fail = (source, err, what) => {
        stats[source].errors++;
        stats[source].last_error = `${what}: ${err.message}`;
        logger.warning(`${what} failed: ${err.message}`);
    };
    const postedFrom = input.postedWithinDays ? new Date(now - input.postedWithinDays * 86_400_000).toISOString().slice(0, 10) : null;
    const stateSet = new Set(input.states);
    const inStates = (s) => !stateSet.size || stateSet.has(s);
    const isOpen = (rec) => !input.onlyOpen || !rec.response_deadline || Date.parse(rec.response_deadline) >= now;
    const postedOk = (rec) => !postedFrom || !rec.posted_date || rec.posted_date.slice(0, 10) >= postedFrom;

    // ---- Federal: SAM.gov -------------------------------------------------
    const runSam = async () => {
        if (!input.includeFederal) return [];
        const naics = [...new Set([...naicsForCategories(input.categories), ...input.naicsCodes])];
        const base = { noticeTypes: input.noticeTypes, setAsides: input.setAsides.flatMap((s) => SET_ASIDES[s].codes), postedFrom };
        // What to search for: NAICS codes (from categories and the NAICS input) and, separately, keywords.
        const whats = [];
        if (naics.length) whats.push({ naics });
        if (input.keywords.length) whats.push({ keywords: input.keywords });
        if (!whats.length) whats.push({});
        const queries = [];
        for (const w of whats) {
            if (input.states.length) {
                queries.push({ ...base, ...w, popStates: input.states, why: 'pop' });
                // Many notices list no place of performance: also look at where the buying office is.
                if (input.matchContractingOfficeState) queries.push({ ...base, ...w, why: 'office' });
            } else {
                queries.push({ ...base, ...w, why: 'all' });
            }
        }
        const hits = new Map();
        for (const q of queries) {
            if (late('federal searches')()) break;
            try {
                const { hits: found, total, truncated } = await searchSam(q, { log: logger, shouldStop: late('federal searches') });
                stats[SAM_SOURCE].searched++;
                if (q.why === 'office' && truncated) {
                    logger.warning(`SAM.gov: ${total} notices matched before the state filter; only the newest ${found.length} were checked for a buying office in your states. Narrow the search to check them all.`);
                } else if (truncated) {
                    logger.warning(`SAM.gov: ${total} notices matched; SAM.gov returns at most ${found.length} per search. Narrow the search (categories, states or posted within days) to get them all.`);
                }
                for (const h of found) {
                    if (q.why === 'office' && !stateSet.has(officeOf(h).office_state)) continue;
                    if (!hits.has(h._id)) hits.set(h._id, { hit: h, why: q.why });
                }
            } catch (err) {
                fail(SAM_SOURCE, err, 'SAM.gov search');
            }
        }
        stats[SAM_SOURCE].found = hits.size;
        return [...hits.values()].map(({ hit, why }) => ({ ...mapSam(hit, null, [], scrapedAt, input), _hit: hit, _why: why }));
    };

    // ---- State & local: Texas ESBD ----------------------------------------
    const runTexas = async () => {
        if (!input.includeStateLocal || !inStates('TX')) return [];
        try {
            // Keyword-only searches can use the portal's own keyword search; categories need every open bid.
            const kw = input.keywords.length && !input.categories.length && !input.naicsCodes.length ? input.keywords : [];
            const lines = await searchTexas({ keywords: kw }, { log: logger, shouldStop: late('Texas search') });
            stats[TEXAS_SOURCE].searched++;
            stats[TEXAS_SOURCE].found = lines.length;
            return lines.map((l) => mapTexasLine(l, scrapedAt));
        } catch (err) {
            fail(TEXAS_SOURCE, err, 'Texas ESBD search');
            return [];
        }
    };

    // ---- State & local: Periscope portals ---------------------------------
    const runPeriscope = async () => {
        if (!input.includeStateLocal) return [];
        const states = Object.keys(PERISCOPE_PORTALS).filter(inStates);
        const out = [];
        await mapPool(states, 3, async (state) => {
            try {
                const { rows } = await searchPeriscope(state, { log: logger, shouldStop: late('state portal searches') });
                stats[PERISCOPE_SOURCE].searched++;
                stats[PERISCOPE_SOURCE].found += rows.length;
                out.push(rows.map((r) => ({ ...mapPeriscopeRow(state, r, scrapedAt), _portal: state })));
            } catch (err) {
                fail(PERISCOPE_SOURCE, err, `${PERISCOPE_PORTALS[state].name} search`);
            }
        });
        return interleave(out);
    };

    const [sam, texas, periscope] = await Promise.all([runSam(), runTexas(), runPeriscope()]);

    // First pass on what the list pages show. SAM.gov rows from a NAICS search
    // already match; state rows are judged on title and commodity codes.
    const prefilter = (rec) => {
        if (!isOpen(rec)) return false;
        if (rec.source === SAM_SOURCE) return true;
        return match(rec, { titleOnly: true }).ok && postedOk(rec);
    };
    const candidates = interleave([sam.filter(prefilter), texas.filter(prefilter), periscope.filter(prefilter)]);
    logger.info(`Candidates: ${candidates.length} (federal ${sam.length}, Texas ${texas.length}, other state portals ${periscope.length} before filtering)`);

    // Open each bid for its full details, at most a little over maxResults.
    const budget = Math.min(candidates.length, Math.ceil(input.maxResults * 1.15) + 20);
    const todo = candidates.slice(0, budget);
    if (input.includeDetails || todo.some((r) => r.source === SAM_SOURCE)) {
        logger.info(`Opening ${todo.length} bids for descriptions, contacts and attachments`);
        const stop = late('bid details');
        await mapPool(todo, 8, async (rec) => {
            if (stop()) return;
            // SAM.gov rows found by office state need the detail to check place of performance.
            if (rec.source !== SAM_SOURCE && !input.includeDetails) return;
            stats.details.tried++;
            try {
                if (rec.source === SAM_SOURCE) {
                    const [detail, attachments] = await Promise.all([
                        fetchSamDetail(rec.notice_id, { log: logger }),
                        input.includeDetails ? fetchSamAttachments(rec.notice_id, { log: logger }).catch(() => []) : [],
                    ]);
                    const org = officeOf(rec._hit).agency ? null : await fetchSamOrg(detail?.data2?.organizationId, { log: logger });
                    Object.assign(rec, mapSam(rec._hit, detail, attachments, scrapedAt, { org }), { _why: rec._why });
                } else if (rec.source === TEXAS_SOURCE) {
                    const d = await fetchTexasDetail(rec, { log: logger });
                    rec.description = d.description;
                    rec.attachments = d.attachments;
                    Object.assign(rec, { contact_name: d.contact_name, contact_email: d.contact_email, contact_phone: d.contact_phone });
                } else {
                    applyPeriscopeDetail(rec, await fetchPeriscopeDetail(rec._portal, rec, { log: logger }), rec._portal);
                }
                rec._detailed = true;
                stats.details.ok++;
            } catch (err) {
                stats.details.failed++;
                logger.debug(`Details for ${rec.url} failed: ${err.message}`);
            }
        });
    }

    const deduper = new BidDeduper();
    for (const rec of todo) {
        // Federal notices found through the buying office: drop them when the notice says the work is in another state.
        if (rec.source === SAM_SOURCE && rec._why === 'office' && rec._popState && !stateSet.has(rec._popState)) continue;
        if (rec.source === SAM_SOURCE && rec._why === 'office' && !rec._hasDetail) continue;
        if (!isOpen(rec) || !postedOk(rec)) continue;
        const m = match(rec);
        if (!m.ok) continue;
        scrubContact(rec, input);
        rec.matched_categories = m.matched_categories;
        rec.matched_keywords = m.matched_keywords;
        stats[rec.source].matched++;
        deduper.add(rec);
    }
    return { rows: rank(deduper.rows.map((r) => toOutputRow(scrubContact(r, input), now))), stats, candidates: candidates.length };
}

async function run() {
    await Actor.init();
    const input = parseInput((await Actor.getInput()) ?? {});
    log.info('Input', input);

    const { rows, stats, candidates } = await collect(input);
    const used = [stats[SAM_SOURCE], stats[TEXAS_SOURCE], stats[PERISCOPE_SOURCE]].filter((s) => s.searched || s.errors);
    if (rows.length === 0 && used.length && used.every((s) => s.errors > 0 && s.found === 0)) {
        throw new Error('Every source failed. See the log for details.');
    }

    // Respect both maxResults and the spending limit the user set for the run.
    const charging = Actor.getChargingManager();
    const affordable = charging.calculateMaxEventChargeCountWithinLimit(CHARGE_EVENT);
    const limit = Math.min(input.maxResults, Number.isFinite(affordable) ? affordable : Infinity);
    const out = rows.slice(0, limit);
    for (let i = 0; i < out.length; i += 100) {
        const res = await Actor.pushData(out.slice(i, i + 100), CHARGE_EVENT);
        if (res?.eventChargeLimitReached) {
            log.info('Reached the spending limit for this run.');
            break;
        }
    }

    const byLevel = (lvl) => out.filter((r) => r.government_level === lvl).length;
    const summary = {
        candidates,
        matched: rows.length,
        returned: out.length,
        federal: byLevel('federal'),
        state: byLevel('state'),
        local: byLevel('local'),
        with_contact_email: out.filter((r) => r.contact_email).length,
        with_attachments: out.filter((r) => r.attachments.length).length,
        sources: stats,
    };
    await Actor.setValue('RUN_SUMMARY', summary);
    log.info('Done', summary);
    await Actor.setStatusMessage(`Found ${rows.length} matching open bids, returned ${out.length} (${summary.federal} federal, ${summary.state} state, ${summary.local} local).`, { isStatusMessageTerminal: true });
    await Actor.exit();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    run().catch(async (err) => {
        log.error(err.message);
        await Actor.fail(err.message);
    });
}
