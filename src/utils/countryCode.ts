const ISO_COUNTRIES = `
AD|AND|Andorra
AE|ARE|United Arab Emirates
AF|AFG|Afghanistan
AG|ATG|Antigua and Barbuda
AI|AIA|Anguilla
AL|ALB|Albania
AM|ARM|Armenia
AO|AGO|Angola
AQ|ATA|Antarctica
AR|ARG|Argentina
AS|ASM|American Samoa
AT|AUT|Austria
AU|AUS|Australia
AW|ABW|Aruba
AX|ALA|Aland Islands
AZ|AZE|Azerbaijan
BA|BIH|Bosnia and Herzegovina
BB|BRB|Barbados
BD|BGD|Bangladesh
BE|BEL|Belgium
BF|BFA|Burkina Faso
BG|BGR|Bulgaria
BH|BHR|Bahrain
BI|BDI|Burundi
BJ|BEN|Benin
BL|BLM|Saint Barthelemy
BM|BMU|Bermuda
BN|BRN|Brunei
BO|BOL|Bolivia
BQ|BES|Bonaire Sint Eustatius and Saba
BR|BRA|Brazil
BS|BHS|Bahamas
BT|BTN|Bhutan
BV|BVT|Bouvet Island
BW|BWA|Botswana
BY|BLR|Belarus
BZ|BLZ|Belize
CA|CAN|Canada
CC|CCK|Cocos Islands
CD|COD|Democratic Republic of the Congo
CF|CAF|Central African Republic
CG|COG|Republic of the Congo
CH|CHE|Switzerland
CI|CIV|Cote d Ivoire
CK|COK|Cook Islands
CL|CHL|Chile
CM|CMR|Cameroon
CN|CHN|China
CO|COL|Colombia
CR|CRI|Costa Rica
CU|CUB|Cuba
CV|CPV|Cabo Verde
CW|CUW|Curacao
CX|CXR|Christmas Island
CY|CYP|Cyprus
CZ|CZE|Czechia
DE|DEU|Germany
DJ|DJI|Djibouti
DK|DNK|Denmark
DM|DMA|Dominica
DO|DOM|Dominican Republic
DZ|DZA|Algeria
EC|ECU|Ecuador
EE|EST|Estonia
EG|EGY|Egypt
EH|ESH|Western Sahara
ER|ERI|Eritrea
ES|ESP|Spain
ET|ETH|Ethiopia
FI|FIN|Finland
FJ|FJI|Fiji
FK|FLK|Falkland Islands
FM|FSM|Micronesia
FO|FRO|Faroe Islands
FR|FRA|France
GA|GAB|Gabon
GB|GBR|United Kingdom
GD|GRD|Grenada
GE|GEO|Georgia
GF|GUF|French Guiana
GG|GGY|Guernsey
GH|GHA|Ghana
GI|GIB|Gibraltar
GL|GRL|Greenland
GM|GMB|Gambia
GN|GIN|Guinea
GP|GLP|Guadeloupe
GQ|GNQ|Equatorial Guinea
GR|GRC|Greece
GS|SGS|South Georgia and the South Sandwich Islands
GT|GTM|Guatemala
GU|GUM|Guam
GW|GNB|Guinea Bissau
GY|GUY|Guyana
HK|HKG|Hong Kong
HM|HMD|Heard Island and McDonald Islands
HN|HND|Honduras
HR|HRV|Croatia
HT|HTI|Haiti
HU|HUN|Hungary
ID|IDN|Indonesia
IE|IRL|Ireland
IL|ISR|Israel
IM|IMN|Isle of Man
IN|IND|India
IO|IOT|British Indian Ocean Territory
IQ|IRQ|Iraq
IR|IRN|Iran
IS|ISL|Iceland
IT|ITA|Italy
JE|JEY|Jersey
JM|JAM|Jamaica
JO|JOR|Jordan
JP|JPN|Japan
KE|KEN|Kenya
KG|KGZ|Kyrgyzstan
KH|KHM|Cambodia
KI|KIR|Kiribati
KM|COM|Comoros
KN|KNA|Saint Kitts and Nevis
KP|PRK|North Korea
KR|KOR|South Korea
KW|KWT|Kuwait
KY|CYM|Cayman Islands
KZ|KAZ|Kazakhstan
LA|LAO|Laos
LB|LBN|Lebanon
LC|LCA|Saint Lucia
LI|LIE|Liechtenstein
LK|LKA|Sri Lanka
LR|LBR|Liberia
LS|LSO|Lesotho
LT|LTU|Lithuania
LU|LUX|Luxembourg
LV|LVA|Latvia
LY|LBY|Libya
MA|MAR|Morocco
MC|MCO|Monaco
MD|MDA|Moldova
ME|MNE|Montenegro
MF|MAF|Saint Martin
MG|MDG|Madagascar
MH|MHL|Marshall Islands
MK|MKD|North Macedonia
ML|MLI|Mali
MM|MMR|Myanmar
MN|MNG|Mongolia
MO|MAC|Macao
MP|MNP|Northern Mariana Islands
MQ|MTQ|Martinique
MR|MRT|Mauritania
MS|MSR|Montserrat
MT|MLT|Malta
MU|MUS|Mauritius
MV|MDV|Maldives
MW|MWI|Malawi
MX|MEX|Mexico
MY|MYS|Malaysia
MZ|MOZ|Mozambique
NA|NAM|Namibia
NC|NCL|New Caledonia
NE|NER|Niger
NF|NFK|Norfolk Island
NG|NGA|Nigeria
NI|NIC|Nicaragua
NL|NLD|Netherlands
NO|NOR|Norway
NP|NPL|Nepal
NR|NRU|Nauru
NU|NIU|Niue
NZ|NZL|New Zealand
OM|OMN|Oman
PA|PAN|Panama
PE|PER|Peru
PF|PYF|French Polynesia
PG|PNG|Papua New Guinea
PH|PHL|Philippines
PK|PAK|Pakistan
PL|POL|Poland
PM|SPM|Saint Pierre and Miquelon
PN|PCN|Pitcairn
PR|PRI|Puerto Rico
PS|PSE|Palestine
PT|PRT|Portugal
PW|PLW|Palau
PY|PRY|Paraguay
QA|QAT|Qatar
RE|REU|Reunion
RO|ROU|Romania
RS|SRB|Serbia
RU|RUS|Russia
RW|RWA|Rwanda
SA|SAU|Saudi Arabia
SB|SLB|Solomon Islands
SC|SYC|Seychelles
SD|SDN|Sudan
SE|SWE|Sweden
SG|SGP|Singapore
SH|SHN|Saint Helena Ascension and Tristan da Cunha
SI|SVN|Slovenia
SJ|SJM|Svalbard and Jan Mayen
SK|SVK|Slovakia
SL|SLE|Sierra Leone
SM|SMR|San Marino
SN|SEN|Senegal
SO|SOM|Somalia
SR|SUR|Suriname
SS|SSD|South Sudan
ST|STP|Sao Tome and Principe
SV|SLV|El Salvador
SX|SXM|Sint Maarten
SY|SYR|Syria
SZ|SWZ|Eswatini
TC|TCA|Turks and Caicos Islands
TD|TCD|Chad
TF|ATF|French Southern Territories
TG|TGO|Togo
TH|THA|Thailand
TJ|TJK|Tajikistan
TK|TKL|Tokelau
TL|TLS|Timor Leste
TM|TKM|Turkmenistan
TN|TUN|Tunisia
TO|TON|Tonga
TR|TUR|Turkey
TT|TTO|Trinidad and Tobago
TV|TUV|Tuvalu
TW|TWN|Taiwan
TZ|TZA|Tanzania
UA|UKR|Ukraine
UG|UGA|Uganda
UM|UMI|United States Minor Outlying Islands
US|USA|United States
UY|URY|Uruguay
UZ|UZB|Uzbekistan
VA|VAT|Vatican City
VC|VCT|Saint Vincent and the Grenadines
VE|VEN|Venezuela
VG|VGB|British Virgin Islands
VI|VIR|United States Virgin Islands
VN|VNM|Vietnam
VU|VUT|Vanuatu
WF|WLF|Wallis and Futuna
WS|WSM|Samoa
YE|YEM|Yemen
YT|MYT|Mayotte
ZA|ZAF|South Africa
ZM|ZMB|Zambia
ZW|ZWE|Zimbabwe
`.trim()

function normalizeLookupValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const alpha2Codes = new Set<string>()
const alpha3ToAlpha2 = new Map<string, string>()
const countryNameToAlpha2 = new Map<string, string>()

for (const row of ISO_COUNTRIES.split('\n')) {
  const [alpha2, alpha3, name] = row.split('|')
  alpha2Codes.add(alpha2)
  alpha3ToAlpha2.set(alpha3, alpha2)
  countryNameToAlpha2.set(normalizeLookupValue(name), alpha2)
}

const COUNTRY_ALIASES: Record<string, string> = {
  'u s': 'US',
  usa: 'US',
  america: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'u k': 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  'russian federation': 'RU',
  'viet nam': 'VN',
  'korea republic of': 'KR',
  'republic of korea': 'KR',
  'korea south': 'KR',
  'democratic people s republic of korea': 'KP',
  'korea democratic people s republic of': 'KP',
  'korea north': 'KP',
  'iran islamic republic of': 'IR',
  'syrian arab republic': 'SY',
  'lao people s democratic republic': 'LA',
  'moldova republic of': 'MD',
  'bolivia plurinational state of': 'BO',
  'venezuela bolivarian republic of': 'VE',
  'tanzania united republic of': 'TZ',
  'brunei darussalam': 'BN',
  'czech republic': 'CZ',
  'ivory coast': 'CI',
  'cote d ivoire': 'CI',
  congo: 'CG',
  'congo brazzaville': 'CG',
  'congo kinshasa': 'CD',
  drc: 'CD',
  'dr congo': 'CD',
  'democratic republic of congo': 'CD',
  'the democratic republic of the congo': 'CD',
  'palestinian territory': 'PS',
  'palestine state of': 'PS',
  macedonia: 'MK',
  'the former yugoslav republic of macedonia': 'MK',
  swaziland: 'SZ',
  'cape verde': 'CV',
  'east timor': 'TL',
  'federated states of micronesia': 'FM',
  'micronesia federated states of': 'FM',
  'taiwan province of china': 'TW',
  'hong kong sar china': 'HK',
  'hong kong s a r': 'HK',
  'macao sar china': 'MO',
  macau: 'MO',
  turkiye: 'TR',
  'bahamas the': 'BS',
  'gambia the': 'GM',
  'saint martin french part': 'MF',
  'sint maarten dutch part': 'SX',
  'virgin islands british': 'VG',
  'virgin islands u s': 'VI',
  '中国': 'CN',
  '美国': 'US',
  '俄罗斯': 'RU',
  '德国': 'DE',
  '法国': 'FR',
  '英国': 'GB',
  '日本': 'JP',
  '韩国': 'KR',
  '朝鲜': 'KP',
  '新加坡': 'SG',
  '印度': 'IN',
  '巴西': 'BR',
  '加拿大': 'CA',
  '澳大利亚': 'AU',
  '越南': 'VN',
  '荷兰': 'NL',
  '印度尼西亚': 'ID',
  '中国香港': 'HK',
  '中国台湾': 'TW',
  '土耳其': 'TR',
  '乌克兰': 'UA',
}

for (const [name, alpha2] of Object.entries(COUNTRY_ALIASES)) {
  countryNameToAlpha2.set(normalizeLookupValue(name), alpha2)
}

// Common non-ISO spellings used as code fields by GeoIP and legacy APIs.
alpha3ToAlpha2.set('XKX', 'XK')
countryNameToAlpha2.set('kosovo', 'XK')

function normalizeCandidate(value?: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const upper = trimmed.toUpperCase()
  if (alpha2Codes.has(upper) || upper === 'XK') return upper
  if (alpha3ToAlpha2.has(upper)) return alpha3ToAlpha2.get(upper) ?? null
  return countryNameToAlpha2.get(normalizeLookupValue(trimmed)) ?? null
}

export function normalizeCountryCode(code?: string | null, country?: string | null): string {
  return normalizeCandidate(code) ?? normalizeCandidate(country) ?? '--'
}
