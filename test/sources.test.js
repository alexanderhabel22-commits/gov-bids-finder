import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTexasDetail, mapTexasLine, splitAgency, parseNigp, isStateAgency } from '../src/sources/texas.js';
import { parseRows, parseDetail, mapPeriscopeRow, applyPeriscopeDetail, governmentLevel } from '../src/sources/periscope.js';
import { mapSam, searchUrl, officeOf } from '../src/sources/sam.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Texas detail page: contact, description and attachments', () => {
    const d = parseTexasDetail(fixture('texas-detail.html'));
    assert.equal(d.contact_name, 'Pat Example');
    assert.equal(d.contact_email, 'pat.example@tea.texas.gov');
    assert.equal(d.contact_phone, null, 'placeholder (512) 111-1111 is dropped');
    assert.match(d.description, /^The Texas Education Agency/);
    assert.equal(d.attachments.length, 2);
    assert.equal(d.attachments[0].name, '701-27-004 Final for ESBD.pdf');
    assert.match(d.attachments[0].url, /^https:\/\/www\.txsmartbuy\.gov\/core\/media\/media\.nl\?id=34130613/);
});

test('Texas list line maps to a row', () => {
    const rec = mapTexasLine({
        internalid: '570817', title: 'Mail House Services', solicitationId: '754-TXST-2027-RFP-523', responseDue: '12/13/2026', responseTime: '5:00 PM',
        agencyNumber: '754', agencyName: 'Texas State University - 754', statusName: 'Posted', postingDate: '10/21/2026', lastModified: '11/13/2026 5:01 pm',
        nigpCodes: '91558-Mailing Services (Includes Addressing);\n91544-*Fulfillment;', url: '',
    }, '2026-11-15T00:00:00.000Z');
    assert.equal(rec.government_level, 'state');
    assert.equal(rec.response_deadline, '2026-12-13T23:00:00.000Z', '5 PM Central');
    assert.equal(rec.url, 'https://www.txsmartbuy.gov/esbd/754-TXST-2027-RFP-523');
    assert.deepEqual(rec._nigp, ['91558', '91544']);
    assert.equal(rec.commodity_codes[0], 'NIGP 91558 Mailing Services (Includes Addressing)');
});

test('Texas agency helpers', () => {
    assert.deepEqual(splitAgency('Abilene ISD - S2211'), { name: 'Abilene ISD', number: 'S2211' });
    assert.equal(isStateAgency('S2211'), false);
    assert.equal(isStateAgency('701'), true);
    assert.equal(parseNigp('').length, 0);
});

test('Periscope list rows', () => {
    const rows = parseRows(fixture('periscope-list.html'));
    assert.equal(rows.length, 3);
    assert.equal(rows[0].docId, 'S-C03342-00018415');
    assert.equal(rows[0].organization, 'Washington County');
    assert.equal(rows[0].title, '2026.104-ITB Printing Services for Solid Waste & Recycling');
    assert.equal(rows[0].openingDate, '12/03/2026 2:00 PM');
    const rec = mapPeriscopeRow('OR', rows[0], 'now');
    assert.equal(rec.government_level, 'local');
    assert.equal(rec.response_deadline, '2026-12-03T22:00:00.000Z', '2 PM Pacific');
    assert.match(rec.url, /^https:\/\/oregonbuys\.gov\/bso\/external\/bidDetail\.sda\?docId=S-C03342-00018415/);
});

test('Periscope detail page', () => {
    const d = parseDetail(fixture('periscope-detail.html'));
    assert.equal(d.organization, 'Town of Montague');
    assert.equal(d.contact_name, 'Chris Example');
    assert.equal(d.contact_email, 'chris.example@montague-ma.gov');
    assert.match(d.description, /^The Town of Montague will receive Responses/);
    assert.match(d.description, /Pre-bid conference: A Briefing Session/);
    assert.equal(d.city, 'Turners Falls');
    assert.equal(d.zip, '01376');
    assert.equal(d.posted_date_raw, '11/11/2026 10:00:00 AM');
    assert.deepEqual(d.commodity_codes, ['72-14-15 Land preparation services']);
    const rec = applyPeriscopeDetail(mapPeriscopeRow('MA', { docId: 'BD-1', organization: 'Town of Montague', title: 'Mill demolition', openingDate: '12/02/2026 02:00:00 PM' }, 'now'), d, 'MA');
    assert.equal(rec.government_level, 'local');
    assert.equal(rec.posted_date, '2026-11-11T15:00:00.000Z');
});

test('Periscope government level', () => {
    assert.equal(governmentLevel('City of Boston', 'MA'), 'local');
    assert.equal(governmentLevel('Department of Transportation', 'OR'), 'state');
    assert.equal(governmentLevel('DNR - Natural Resources', 'IL'), 'state');
    assert.equal(governmentLevel('Scituate Housing Authority', 'MA'), 'local');
});

test('SAM.gov hit + detail map to a row', () => {
    const hit = JSON.parse(fixture('sam-hit.json'));
    const detail = JSON.parse(fixture('sam-detail.json'));
    const rec = mapSam(hit, detail, [{ name: 'a.docx', url: 'u' }], 'now');
    assert.equal(rec.title, 'Gutter Maintenance');
    assert.equal(rec.notice_type, 'Sources Sought');
    assert.equal(rec.state, 'WA');
    assert.equal(rec.location_basis, 'place_of_performance');
    assert.equal(rec.place_of_performance_city, 'Tacoma');
    assert.deepEqual(rec.naics_codes, ['238160']);
    assert.equal(rec.set_aside, 'Total Small Business');
    assert.equal(rec.contact_email, 'robin.example@va.gov');
    assert.equal(rec.contact_phone, '(253) 555-0100');
    assert.equal(rec.description, 'Roof drainage (gutter) maintenance');
    assert.equal(rec.url, 'https://sam.gov/opp/f151911bb4d6459eb12d3c0e9b18f0d3/view');
    const noContacts = mapSam(hit, detail, [], 'now', { includeContacts: false });
    assert.equal(noContacts.contact_email, null);
    // Without the detail, the office address stands in for the location.
    const bare = mapSam(hit, null, [], 'now');
    assert.equal(bare.location_basis, officeOf(hit).office_state ? 'contracting_office' : null);
});

test('SAM.gov search URL', () => {
    const u = new URL(searchUrl({ page: 2, noticeTypes: ['solicitation', 'sources_sought'], naics: ['238'], keywords: ['roof', 'snow removal'], popStates: ['TX', 'OK'], setAsides: ['SBA'], postedFrom: '2026-11-01' }));
    assert.equal(u.searchParams.get('notice_type'), 'o,r');
    assert.equal(u.searchParams.get('naics'), '238');
    assert.equal(u.searchParams.get('q'), 'roof "snow removal"');
    assert.equal(u.searchParams.get('qMode'), 'ANY');
    assert.equal(u.searchParams.get('pop_state'), 'TX,OK');
    assert.equal(u.searchParams.get('set_aside'), 'SBA');
    assert.equal(u.searchParams.get('publish_date.from'), '2026-11-01-00:00');
    assert.equal(u.searchParams.get('page'), '2');
});
