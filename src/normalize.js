// Small helpers for cleaning up text, dates and phone numbers.

export const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
    DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
    PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    PR: 'Puerto Rico', GU: 'Guam', VI: 'U.S. Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...', bull: '*' };

export function decodeEntities(s) {
    return String(s ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** HTML to readable plain text: paragraphs become line breaks, tags go. */
export function htmlToText(html) {
    if (!html) return '';
    const t = String(html)
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, ' ');
    return decodeEntities(t)
        .replace(/[ \t ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Collapses whitespace in a short field. Empty becomes null. */
export function clean(s) {
    const t = decodeEntities(s ?? '').replace(/\s+/g, ' ').trim();
    return t || null;
}

/** Shortens long text at a word boundary. */
export function truncate(s, max = 5000) {
    if (!s || s.length <= max) return s || null;
    const cut = s.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 50))}...`;
}

export const phoneDigits = (p) => {
    const d = String(p ?? '').replace(/\D/g, '');
    const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
    return ten.length >= 10 ? ten.slice(0, 10) : null;
};

/** (555) 555-0100, keeping an extension when there is one. Fake 111-1111 style numbers are dropped. */
export function formatPhone(p) {
    const raw = String(p ?? '');
    const d = phoneDigits(raw);
    if (!d || /^(\d)\1{9}$/.test(d) || /1111111$|0000000$|5551212$/.test(d)) return null;
    const ext = raw.match(/(?:ext\.?|x|extension)\s*(\d{1,6})\s*$/i);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}${ext ? ` ext. ${ext[1]}` : ''}`;
}

export function cleanEmail(e) {
    const m = String(e ?? '').trim().toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    return m ? m[0] : null;
}

/**
 * US "MM/DD/YYYY [hh:mm[:ss] AM]" to ISO. Portals post local times without a
 * zone, so the caller passes the portal's usual UTC offset in hours.
 */
export function usDateToIso(date, time = '', offsetHours = -5) {
    const m = String(date ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    let [h, min, s] = [23, 59, 0];
    const t = String(time || date).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i);
    if (t) {
        h = Number(t[1]) % 12 + (/p/i.test(t[4] ?? '') ? 12 : 0);
        if (!t[4]) h = Number(t[1]);
        min = Number(t[2]);
        s = Number(t[3] ?? 0);
    }
    const utc = Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h - offsetHours, min, s);
    return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}

/** "2026-11-13T23:16:43+00:00" or other ISO-ish strings to a normal ISO string. */
export function toIso(s) {
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Whole days from now until an ISO time (negative when past). */
export function daysUntil(iso, now = Date.now()) {
    if (!iso) return null;
    return Math.floor((Date.parse(iso) - now) / 86_400_000);
}

/** A loose key for matching the same bid across sources. */
export const solicitationKey = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;

export const titleKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
