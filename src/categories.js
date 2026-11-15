// What a buyer is looking for, in plain categories.
//
// Federal notices (SAM.gov) carry NAICS codes, so each category lists NAICS
// prefixes that SAM.gov can filter on. State and local portals use their own
// commodity codes (NIGP in Texas, UNSPSC on Periscope portals) or none, so
// each category also has keywords. A bid matches a category when its NAICS
// code starts with one of the prefixes, its 3-digit NIGP class is listed, or
// its title or commodity code descriptions match one of the keywords. Long
// descriptions only count on multi-word phrases.

export const CATEGORIES = {
    construction: {
        title: 'Construction, renovation & building repair',
        naics: ['236', '237', '238'],
        nigp: ['909', '912', '913', '914'],
        keywords: ['(?<!cable )construction(?! (equipment|materials?|supplies|signs?|lamps?|cable|cost|loans?))', 'renovat\\w*', 'remodel\\w*', 'build[- ]?out', 'building addition', 'repair[s]? (of|to) (the )?(building|facility)', 'facility improvements?', 'capital improvements?', 'design[- ]build', 'general contractor', 'construction manager', 'cm at risk', 'job order contract\\w*', 'jocs?'],
    },
    roofing: {
        title: 'Roofing',
        naics: ['238160'],
        nigp: [],
        keywords: ['roof\\w*', 'gutters?'],
    },
    hvac: {
        title: 'HVAC, mechanical & boilers',
        naics: ['238220'],
        nigp: ['031'],
        keywords: ['hvac', 'heating', 'air condition\\w*', 'chillers?', 'boilers?', 'cooling towers?', 'mechanical (services|systems|contractor|maintenance|upgrades?)', 'ventilation', 'rooftop units?', 'rtus?', 'heat pumps?'],
    },
    plumbing: {
        title: 'Plumbing',
        naics: ['238220'],
        nigp: ['670'],
        keywords: ['plumbing', 'backflow', 'water heaters?', 'sewer (line|repair)', 'drain cleaning'],
    },
    electrical: {
        title: 'Electrical, lighting & generators',
        naics: ['238210', '335'],
        nigp: ['285'],
        keywords: ['electrical', 'electric(al)? (work|services|contractor|upgrades?)', 'lighting', 'generators?', 'switchgear', 'ev charg\\w*', 'transformers?', 'fiber optic\\w*'],
    },
    roads_bridges: {
        title: 'Roads, bridges, paving & site work',
        naics: ['237310', '237990', '238910', '238990'],
        nigp: [],
        keywords: ['paving', 'asphalt', 'roads?', 'roadway', 'highway', 'bridges?', 'culverts?', 'sidewalks?', 'curb', 'striping', 'pavement', 'resurfacing', 'chip seal', 'crack seal\\w*', 'excavation', 'site work', 'sitework', 'grading', 'demolition', 'storm ?water', 'drainage', 'guardrail'],
    },
    water_utilities: {
        title: 'Water, wastewater & utilities',
        naics: ['221', '237110', '237120', '237130'],
        nigp: [],
        keywords: ['water main', 'waterline', 'water line', 'wastewater', 'sewer', 'lift station', 'pump station', 'water treatment', 'utility (line|relocation|work)', 'well drilling', 'water tower', 'reservoir'],
    },
    painting_flooring: {
        title: 'Painting, flooring & finishes',
        naics: ['238320', '238330', '238310', '238340', '238350', '238390'],
        nigp: [],
        keywords: ['painting', 'paint', 'coatings?', 'flooring', 'carpet\\w*', 'tile', 'terrazzo', 'drywall', 'ceilings?', 'millwork', 'casework', 'cabinet\\w*', 'doors? (and|&) hardware', 'windows?', 'glazing'],
    },
    janitorial: {
        title: 'Janitorial & custodial',
        naics: ['561720', '561740', '561790'],
        nigp: [],
        keywords: ['janitorial', 'custodial', 'cleaning services?', 'window (washing|cleaning)', 'pressure washing', 'power washing', 'carpet cleaning', 'floor care', 'disinfect\\w*', 'sanitation services'],
    },
    grounds: {
        title: 'Landscaping, mowing & tree work',
        naics: ['561730', '115310'],
        nigp: ['988'],
        keywords: ['landscap\\w*', 'mowing', 'grounds (maintenance|keeping)', 'groundskeeping', 'lawn', 'trees? (trimming|removal|services|care)', 'tree work', 'arborist', 'irrigation', 'snow (removal|plowing)', 'herbicide', 'vegetation'],
    },
    facilities: {
        title: 'Facility maintenance & building services',
        naics: ['561210', '561790', '811310', '238290'],
        nigp: ['910', '936'],
        keywords: ['facility maintenance', 'facilities maintenance', 'building maintenance', 'preventive maintenance', 'elevators?', 'escalators?', 'fire (alarm|sprinkler|suppression|extinguishers?)', 'sprinkler systems?', 'pest control', 'extermination', 'locksmith', 'access control', 'overhead doors?', 'generator maintenance'],
    },
    security: {
        title: 'Security guards, alarms & surveillance',
        naics: ['561611', '561612', '561613', '561621'],
        nigp: [],
        keywords: ['security (guard|officer|services|patrol)s?', 'guard services', 'armed guards?', 'unarmed guards?', 'surveillance', 'cctv', 'video (surveillance|security)', 'security cameras?', 'alarm (monitoring|systems?)', 'intrusion detection'],
    },
    it_software: {
        title: 'IT, software & cybersecurity',
        naics: ['5415', '5182', '5112', '513210', '519'],
        nigp: ['204', '208', '209', '920'],
        keywords: ['software', 'saas', 'information technology', 'it (services|support|staff\\w*|consult\\w*)', 'cyber ?security', 'network (equipment|services|infrastructure)', 'cloud', 'data (center|management|analytics)', 'help ?desk', 'erp', 'gis', 'website', 'web (design|development|portal)', 'servers?', 'computers?', 'laptops?', 'licenses?', 'microsoft', 'cisco', 'artificial intelligence', 'ai'],
    },
    telecom: {
        title: 'Telecom, radio & cabling',
        naics: ['517', '238210'],
        nigp: [],
        keywords: ['telecom\\w*', 'telephon\\w*', 'voip', 'radio', 'p25', 'two[- ]way radio', 'cabling', 'structured cabling', 'wireless', 'cellular', 'broadband', 'internet (service|access)'],
    },
    engineering: {
        title: 'Engineering, architecture & surveying',
        naics: ['541310', '541320', '541330', '541340', '541350', '541360', '541370', '541380', '541620', '541690'],
        nigp: ['906', '925'],
        keywords: ['engineering', 'architect\\w*', 'a/e services', 'design services', 'survey(ing)?', 'geotechnical', 'environmental (assessment|consulting|services)', 'inspection services', 'materials testing', 'construction (inspection|administration|management services)', 'planning services', 'master plan', 'feasibility study'],
    },
    consulting: {
        title: 'Consulting, training & professional services',
        naics: ['5416', '5411', '5412', '5419', '6114', '6116', '6117'],
        nigp: ['918'],
        keywords: ['consult\\w*', 'professional services', 'training', 'audit\\w*', 'accounting', 'legal services', 'attorneys?', 'outside counsel', 'actuarial', 'management (services|consulting)', 'strategic plan\\w*', 'program management', 'evaluation services', 'grant (writing|administration)', 'financial advis\\w*', 'insurance (broker|services)', 'translation', 'interpret\\w*'],
    },
    marketing_printing: {
        title: 'Marketing, printing & media',
        naics: ['5418', '323', '512', '541430'],
        nigp: [],
        keywords: ['marketing', 'advertising', 'printing', 'print services', 'graphic design', 'branding', 'public relations', 'outreach (campaign|services)', 'media (buy\\w*|services|campaign)', 'video production', 'signage', 'signs', 'promotional (items|products)', 'mailing services'],
    },
    staffing: {
        title: 'Staffing & temporary labor',
        naics: ['5613'],
        nigp: [],
        keywords: ['staffing', 'temporary (staff\\w*|personnel|labor|employees)', 'temp (staff|labor)', 'personnel services', 'recruit\\w*'],
    },
    medical: {
        title: 'Medical, dental & lab supplies and services',
        naics: ['3391', '423450', '4246', '621', '622', '623', '325412', '334510'],
        nigp: ['465', '466', '948'],
        keywords: ['medical', 'healthcare', 'health care', 'hospital', 'pharmac\\w*', 'drugs?', 'vaccines?', 'nursing', 'clinical', 'dental', 'laboratory (supplies|equipment|services)', 'lab (supplies|equipment|services)', 'surgical', 'patient', 'x-ray', 'imaging', 'mri', 'ultrasound', 'ems', 'ambulance', 'behavioral health', 'telehealth'],
    },
    vehicles_fleet: {
        title: 'Vehicles, fleet & heavy equipment',
        naics: ['3361', '3362', '3363', '423110', '441', '532', '811111', '811121', '333120'],
        nigp: ['060', '065', '070', '071', '075'],
        keywords: ['vehicles?', 'trucks?', 'pickups?', 'suvs?', 'vans?', 'buses', 'fleet', 'police (cars?|vehicles?|interceptors?)', 'fire (trucks?|apparatus|engines?)', 'ambulances?', 'trailers?', 'tires?', 'automotive', 'auto (parts|repair)', 'heavy equipment', 'excavators?', 'loaders?', 'backhoes?', 'tractors?', 'mowers?', 'forklifts?', 'equipment rental'],
    },
    transportation: {
        title: 'Transportation, freight & moving',
        naics: ['484', '485', '488', '492', '493'],
        nigp: [],
        keywords: ['freight', 'trucking', 'transportation services', 'moving services', 'movers', 'relocation services', 'courier', 'delivery services', 'shipping', 'logistics', 'shuttle', 'charter bus', 'student transportation', 'paratransit', 'towing', 'warehous\\w*', 'storage services'],
    },
    environmental_waste: {
        title: 'Waste, recycling & environmental remediation',
        naics: ['562', '541620'],
        nigp: ['926'],
        keywords: ['waste', 'recycl\\w*', 'trash', 'refuse', 'garbage', 'solid waste', 'hazardous (waste|materials)', 'remediation', 'abatement', 'asbestos', 'lead paint', 'mold', 'environmental cleanup', 'dumpsters?', 'roll[- ]off', 'shredding', 'portable toilets?', 'septic', 'grease trap'],
    },
    food: {
        title: 'Food, catering & food service',
        naics: ['311', '4244', '722'],
        nigp: ['375', '390', '393', '395'],
        keywords: ['food', 'catering', 'meals?', 'food service', 'cafeteria', 'dining', 'vending', 'groceries', 'produce', 'dairy', 'meat', 'bakery', 'beverages?', 'coffee', 'nutrition'],
    },
    furniture_supplies: {
        title: 'Furniture, office & janitorial supplies',
        naics: ['337', '4232', '4241', '424130', '424690', '339940'],
        nigp: ['420', '425', '615', '620'],
        keywords: ['furniture', 'office supplies', 'paper', 'toner', 'janitorial supplies', 'cleaning supplies', 'chairs', 'desks', 'seating', 'shelving', 'lockers', 'copiers?', 'printers', 'mattress\\w*', 'uniforms?', 'apparel', 'footwear', 'ppe', 'gloves'],
    },
    metal_manufacturing: {
        title: 'Metal fabrication, machining & manufactured parts',
        naics: ['331', '332', '333', '334', '335', '336', '339'],
        nigp: [],
        keywords: ['fabricat\\w*', 'machin(ing|ed)', 'metal', 'steel', 'aluminum', 'welding', 'castings?', 'forgings?', 'sheet metal', 'parts', 'valves?', 'pumps?', 'bearings?', 'fasteners?', 'hydraulic', 'connectors?'],
    },
    energy_solar: {
        title: 'Energy, solar & fuel',
        naics: ['2211', '237130', '324', '424710', '424720', '454310'],
        nigp: ['405'],
        keywords: ['solar', 'photovoltaic', 'pv systems?', 'energy (efficiency|savings|services|audit|conservation)', 'espc', 'battery storage', 'microgrid', 'fuel', 'diesel', 'gasoline', 'propane', 'natural gas', 'electricity supply', 'led (retrofit|lighting|upgrades?)', 'wind turbines?'],
    },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

/** Escapes a plain user keyword so it can sit inside a regex. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds one case-insensitive whole-word regex from keyword patterns. */
export function keywordRegex(patterns) {
    const list = patterns.filter(Boolean);
    if (!list.length) return null;
    return new RegExp(`(?<![a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');
}

/** Pre-built matchers for every category. */
const MATCHERS = Object.fromEntries(
    CATEGORY_IDS.map((id) => [id, { re: keywordRegex(CATEGORIES[id].keywords), naics: CATEGORIES[id].naics, nigp: CATEGORIES[id].nigp }]),
);

/**
 * Which categories a bid belongs to. Short generic keywords ("ai", "paint")
 * only count in the title, so a long description that mentions them in
 * passing does not drag a bid into the wrong category.
 */
export function categoriesFor({ title = '', description = '', naics = [], nigp = [], commodities = '' }, ids = CATEGORY_IDS) {
    const hits = [];
    const text = `${title}`;
    const long = `${title} ${description ?? ''}`.slice(0, 4000);
    for (const id of ids) {
        const m = MATCHERS[id];
        if (naics.some((code) => m.naics.some((p) => String(code).startsWith(p)))) { hits.push(id); continue; }
        if (nigp.some((code) => m.nigp.some((p) => String(code).startsWith(p)))) { hits.push(id); continue; }
        if (m.re.test(text)) { hits.push(id); continue; }
        if (commodities && m.re.test(commodities)) { hits.push(id); continue; }
        // Descriptions are long and wordy: only the multi-word phrases count there.
        if (description && strongMatch(m.re, long)) hits.push(id);
    }
    return hits;
}

function strongMatch(re, text) {
    const m = text.match(new RegExp(re.source, 'gi'));
    return Boolean(m && m.some((w) => w.length >= 8 && /\s|-/.test(w)));
}

/** All NAICS prefixes for the picked categories, for the SAM.gov server-side filter. */
export function naicsForCategories(ids) {
    return [...new Set(ids.flatMap((id) => CATEGORIES[id].naics))];
}
