import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriesFor, CATEGORY_IDS, naicsForCategories } from '../src/categories.js';
import { formatPhone, usDateToIso, htmlToText, truncate, daysUntil } from '../src/normalize.js';
import { parseInput, matcher, BidDeduper, interleave, toOutputRow, rank, isNarrowed } from '../src/main.js';

test('categories: titles, NAICS, NIGP and commodity text', () => {
    assert.deepEqual(categoriesFor({ title: 'Roof Replacement at Fire Station 3' }, ['roofing', 'construction']), ['roofing']);
    assert.deepEqual(categoriesFor({ title: 'Services', naics: ['561720'] }, ['janitorial']), ['janitorial']);
    assert.deepEqual(categoriesFor({ title: 'Bldg 4', nigp: ['91460'] }, ['construction']), ['construction']);
    assert.deepEqual(categoriesFor({ title: 'Annual contract', commodities: 'Janitorial Services' }, ['janitorial']), ['janitorial']);
    // Look-alikes that are not construction work.
    assert.deepEqual(categoriesFor({ title: 'Portable Construction Equipment' }, ['construction']), []);
    assert.deepEqual(categoriesFor({ title: 'Cabling', commodities: 'Cable Construction, Installation And Maintenance' }, ['construction']), []);
    assert.deepEqual(categoriesFor({ title: 'Diabetes Education', description: 'In addition to classes we offer support' }, ['construction']), []);
    // A long description only counts on multi-word phrases.
    assert.deepEqual(categoriesFor({ title: 'Annual services', description: 'Includes snow removal at all sites' }, ['grounds']), ['grounds']);
    assert.deepEqual(categoriesFor({ title: 'Annual services', description: 'Lawn' }, ['grounds']), []);
    assert.ok(naicsForCategories(['roofing', 'janitorial']).includes('238160'));
});

test('every category compiles and has keywords and NAICS codes', () => {
    for (const id of CATEGORY_IDS) {
        assert.ok(Array.isArray(categoriesFor({ title: 'x' }, [id])));
        assert.ok(naicsForCategories([id]).length > 0, id);
    }
});

test('normalize helpers', () => {
    assert.equal(formatPhone('2538884936'), '(253) 888-4936');
    assert.equal(formatPhone('(413) 863-3200 Ext. 110'), '(413) 863-3200 ext. 110');
    assert.equal(formatPhone('(512) 111-1111'), null);
    assert.equal(usDateToIso('12/9/2026', '2:00 PM', -6), '2026-12-09T20:00:00.000Z');
    assert.equal(usDateToIso('12/02/2026 02:00:00 PM', '12/02/2026 02:00:00 PM', -5), '2026-12-02T19:00:00.000Z');
    assert.equal(usDateToIso('12/9/2026', '', -6), '2026-12-10T05:59:00.000Z', 'no time = end of day');
    assert.equal(htmlToText('<p>One &amp; two</p><p>Three</p>'), 'One & two\nThree');
    assert.equal(truncate('alpha beta gamma', 12), 'alpha beta...');
    assert.equal(daysUntil('2026-11-20T00:00:00Z', Date.parse('2026-11-15T00:00:00Z')), 5);
});

test('parseInput defaults and validation', () => {
    const d = parseInput({});
    assert.deepEqual(d.categories, ['construction']);
    assert.deepEqual(d.noticeTypes, ['solicitation', 'combined_synopsis', 'presolicitation', 'sources_sought']);
    assert.equal(d.maxResults, 1000);
    assert.equal(d.onlyOpen, true);
    assert.deepEqual(parseInput({ states: ['tx', 'ma'] }).states, ['TX', 'MA']);
    assert.deepEqual(parseInput({ keywords: 'Roof, HVAC' }).keywords, ['roof', 'hvac']);
    assert.throws(() => parseInput({ states: ['XX'] }), /Unknown state code: XX/);
    assert.throws(() => parseInput({ categories: ['nope'] }), /Unknown category/);
    assert.throws(() => parseInput({ naicsCodes: ['1'] }), /2 to 6 digits/);
    assert.throws(() => parseInput({ includeFederal: false, includeStateLocal: false }), /Turn on/);
    assert.equal(isNarrowed(parseInput({ categories: [] })), false);
});

test('matcher: categories, keywords and NAICS', () => {
    const m = matcher(parseInput({ categories: ['roofing'], keywords: ['gutter'], naicsCodes: ['5617'] }));
    assert.equal(m({ title: 'Roof repair', naics_codes: [] }).ok, true);
    const g = m({ title: 'Gutter cleaning', naics_codes: [] });
    assert.deepEqual(g.matched_keywords, ['gutter']);
    assert.equal(m({ title: 'Cleaning', naics_codes: ['561720'] }).ok, true);
    assert.equal(m({ title: 'Software licenses', naics_codes: ['511210'] }).ok, false);
    // No filters at all: everything matches.
    assert.equal(matcher(parseInput({ categories: [] }))({ title: 'Anything', naics_codes: [] }).ok, true);
});

test('dedupe keeps the newest version of the same solicitation', () => {
    const d = new BidDeduper();
    const base = { state: 'TX', government_level: 'federal', solicitation_number: 'W912-26-R-0001' };
    d.add({ ...base, notice_id: 'a', notice_type: 'Presolicitation', last_updated: '2026-10-01', description: 'old' });
    d.add({ ...base, notice_id: 'b', notice_type: 'Solicitation', last_updated: '2026-11-01', description: null });
    d.add({ ...base, notice_id: 'c', state: 'OK', solicitation_number: 'W912-26-R-0001', last_updated: '2026-11-02' });
    assert.equal(d.rows.length, 2);
    assert.equal(d.rows[0].notice_id, 'b');
    assert.equal(d.rows[0].description, 'old', 'gaps filled from the older notice');
    assert.deepEqual(d.rows[0].related_notice_ids, ['a']);
});

test('interleave, output row and ranking', () => {
    assert.deepEqual(interleave([[1, 2, 3], ['a'], ['x', 'y']]), [1, 'a', 'x', 2, 'y', 3]);
    const row = toOutputRow({ title: 'T', response_deadline: '2026-11-20T00:00:00Z', naics_codes: [], commodity_codes: [] }, Date.parse('2026-11-15T00:00:00Z'));
    assert.equal(row.days_left, 5);
    assert.ok(!Object.keys(row).some((k) => k.startsWith('_')));
    const ranked = rank([{ title: 'old', posted_date: '2026-10-01' }, { title: 'none' }, { title: 'new', posted_date: '2026-11-01' }]);
    assert.deepEqual(ranked.map((r) => r.title), ['new', 'old', 'none']);
});
