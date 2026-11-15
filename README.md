# US Government Bids & RFPs: SAM.gov + State & Local

Find open government bids and RFPs that fit what you sell, from **federal, state and local** buyers, in one clean list. Pick a category ("roofing", "janitorial", "IT & software"...) or your own keywords and NAICS codes, pick your states, and get every open opportunity with its deadline, buyer, contact, description and attachment links. No login, no API key, no subscription.

Most bid tools cover either SAM.gov or a paid state and local feed. This Actor puts both in the same table:

- **Federal**: every active SAM.gov contract opportunity (solicitations, combined synopses, presolicitations, sources sought, and optionally awards and special notices).
- **State & local**: the state procurement portals of **Texas (ESBD), Massachusetts (COMMBUYS), Illinois (BidBuy), New Jersey (NJSTART), Oregon (OregonBuys) and Nevada (Nevada ePro)**. These carry state agency bids plus many city, county, school district, college, housing authority and transit bids.

## Who uses it

- **Small contractors and service companies** (construction, roofing, HVAC, janitorial, landscaping, security, IT...) that want a daily or weekly list of bids they can win, without paying $100+/month for a bid service.
- **Business development and capture teams** tracking opportunities by NAICS code, set-aside (8(a), HUBZone, SDVOSB, WOSB) and state.
- **Bid consultants, proposal writers and lead-gen agencies** building bid alerts for clients.
- **Suppliers and distributors** who want to know which agencies are buying their products right now.

## What you get

| title | government_level | buyer | state | response_deadline | days_left | set_aside | contact_email | url |
|---|---|---|---|---|---|---|---|---|
| Replace AHU and chiller, Bldg 28 | federal | Network Contracting Office 17 | TX | 2026-12-28T20:00:00Z | 43 | SDVOSB Set-Aside | contracting@agency.gov | sam.gov/opp/... |
| Parking operations janitorial services | state | UT MD Anderson Cancer Center | TX | 2026-12-15T22:00:00Z | 30 | | | txsmartbuy.gov/esbd/... |
| Malcolm X Park landscape maintenance | local | City of Boston | MA | 2026-12-03T19:00:00Z | 18 | | | commbuys.com/bso/... |

*(Illustrative rows.)* Every row also has:

- **What**: notice type, solicitation number, matched categories and keywords, NAICS codes, product/service code, NIGP or UNSPSC commodity codes, and the full description (up to 6,000 characters).
- **Who**: agency, sub-agency, office and office city/state, plus the office's role mailbox (bids@, purchasing@) when the notice gives one. Optionally the buyer named on the notice.
- **Where**: place of performance city, state and ZIP, and `location_basis` telling you whether the state comes from the place of performance, the buying office, or the state portal.
- **When**: posted date, response deadline (ISO time, converted from the portal's time zone) and days left.
- **Documents**: attachment names and direct download links (SAM.gov and Texas).
- **Awards** (when you include award notices): awardee name, UEI, amount and date.
- Links to the original notice, the source name, and IDs of earlier versions merged into the row.

Typical results (November 2026): construction in Texas returns about 240 open bids in under a minute (200 state and local, 40 federal); janitorial and grounds nationwide about 150 in 2.5 minutes; construction nationwide 1,000+ in about 4 minutes.

## Categories

Construction and renovation, roofing, HVAC and mechanical, plumbing, electrical and lighting, roads and bridges and site work, water and wastewater, painting and flooring and finishes, janitorial, landscaping and grounds, facility maintenance, security guards and surveillance, IT and software and cybersecurity, telecom and radio, engineering and architecture, consulting and training, marketing and printing, staffing, medical and lab, vehicles and fleet, transportation and freight, waste and recycling and remediation, food service, furniture and office supplies, metal fabrication and manufactured parts, energy and solar and fuel.

Each category maps to NAICS codes for federal bids and to title keywords and commodity codes for state and local bids. Add your own **keywords** ("body cameras", "snow removal") and **NAICS codes** (238220, 5415) on top.

## How it works

1. **SAM.gov**: searches active notices by NAICS code and keyword, by place of performance, and (optionally) by the buying office's state for notices that give no place of performance. Then it opens each notice for the description, contact, set-aside, NAICS code and attachments.
2. **State portals**: reads every open bid on each state portal you selected, keeps the ones whose title or commodity codes match, and opens each for the description and contact.
3. **Cleanup**: drops bids whose deadline has passed, merges repeat notices for the same solicitation (keeping the newest), and sorts newest first.

## Input

- **What you sell**: categories, keywords and/or NAICS codes. Leave all three empty to get every open bid in your states.
- **States**: two-letter codes. Leave empty for the whole US.
- **Federal bids** and **state and local bids**: turn either source off.
- **Federal notice types** and **set-asides** (small business, 8(a), HUBZone, SDVOSB, VOSB, WOSB, EDWOSB, Indian).
- **Posted within (days)**: only new bids. Use 1 with a daily schedule, 7 with a weekly one.
- **Only bids still open**, **open each bid for details**, **include named buyer contact**, **maximum results**.

## Tips

- Schedule it daily with "posted within 1 day" and connect the dataset to email, Slack, Google Sheets or Zapier for a free bid alert.
- State and local bids are matched by words in the title, so add the words your buyers use ("custodial", "mowing", "HVAC PM").
- Federal notices with no place of performance are matched to your state by the contracting office; turn **Also use the buying office's state** off if you only want work located in your state.

## Data

Only public notices that agencies publish for vendors. Nothing behind a login. By default no named people are returned, only role mailboxes; turn on **Include named buyer contact** to add the buyer named on each notice.

## How much does it cost?

**$4 per 1,000 bids** ($0.004 each), plus $0.005 per run. You pay only for bids returned.

| You get | You pay |
|---|---|
| 100 bids | about $0.41 |
| 1,000 bids | about $4.01 |
| 5,000 bids | about $20.01 |

Apify's free plan includes $5 of credit every month, which covers about 1,200 bids, so you can try it without paying anything. Set **Maximum results** or a spending limit and the run stops there.

## FAQ

**Is this a SAM.gov scraper?** Yes, and more: it reads every active SAM.gov opportunity plus state portals (Texas ESBD, COMMBUYS, BidBuy, NJSTART, OregonBuys, Nevada ePro) that carry city, county and school bids.

**Can I get daily bid alerts by email or Slack?** Yes. Schedule the Actor daily with Posted within = 1 day and connect it to email, Slack or Google Sheets. That replaces a $100+/month bid service.

**Can I search by NAICS code or set-aside?** Yes. Enter NAICS codes and pick set-asides such as 8(a), HUBZone, SDVOSB or WOSB.

**Do I need a SAM.gov API key?** No. You don't need any account or key.

**How is this different from GovSpend, BidNet or GovWin?** Those are annual subscriptions. This gives you the open bids for your categories and states as a spreadsheet, and you pay only for the bids returned.

## Use it from your own tools

Run it from the Apify API (see the API tab), on a schedule, or from Zapier, Make, n8n, Google Sheets and Slack integrations. Each run's results stay in a dataset you can download as CSV, Excel, JSON or XML.

## More B2B lead lists from the same developer

Same pricing, same clean one-row-per-company format:

- [US Manufacturer & Machine Shop Leads](https://apify.com/habes22/fabricator-finder): metal fabricators and machine shops by capability (laser, CNC, welding)
- [Construction Contractor & Subcontractor Finder](https://apify.com/habes22/construction-contractor-finder): commercial contractors and subs by trade
- [Trucking Company & Carrier Leads (FMCSA)](https://apify.com/habes22/trucking-carrier-finder): trucking companies by cargo, fleet size and area, with safety data
- [Medical Practice & Clinic Leads (NPI)](https://apify.com/habes22/medical-practice-leads): dental, medical and therapy practices by specialty
- [Commercial Property Owner Leads](https://apify.com/habes22/commercial-property-owner-leads): who owns offices, warehouses and other commercial buildings
