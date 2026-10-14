import type { TaxIdType } from "@src/types/billingDetails";

export const TAX_ID_TYPE_OPTIONS: Record<TaxIdType, { label: string; example: string }> = {
  eu_vat: { label: "EU VAT number", example: "DE123456789" },
  gb_vat: { label: "UK VAT number", example: "GB123456789" },
  ch_vat: { label: "Swiss VAT number", example: "CHE-123.456.789 MWST" },
  no_vat: { label: "Norwegian VAT number", example: "123456789MVA" },
  us_ein: { label: "US EIN", example: "12-3456789" },
  ca_bn: { label: "Canadian BN", example: "123456789" },
  au_abn: { label: "Australian ABN", example: "12345678912" },
  nz_gst: { label: "New Zealand GST number", example: "123456789" },
  in_gst: { label: "Indian GSTIN", example: "12ABCDE3456FGZH" },
  sg_gst: { label: "Singapore GST number", example: "M12345678X" },
  jp_cn: { label: "Japanese corporate number", example: "1234567891234" },
  kr_brn: { label: "South Korean BRN", example: "123-45-67890" },
  br_cnpj: { label: "Brazilian CNPJ", example: "01.234.456/5432-10" },
  mx_rfc: { label: "Mexican RFC", example: "ABC010203AB9" },
  ae_trn: { label: "UAE TRN", example: "123456789012345" },
  za_vat: { label: "South African VAT number", example: "4123456789" }
};

export function isSelectableTaxIdType(type: string): type is TaxIdType {
  return Object.hasOwn(TAX_ID_TYPE_OPTIONS, type);
}

export function describeTaxIdType(type: string): string {
  return isSelectableTaxIdType(type) ? TAX_ID_TYPE_OPTIONS[type].label : type.toUpperCase();
}

const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO " +
  "CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR " +
  "HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN " +
  "MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD " +
  "SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK " +
  "YE YT ZA ZM ZW"
).split(" ");

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function getCountryName(code: string): string {
  return regionNames.of(code) ?? code;
}

export const COUNTRY_OPTIONS = COUNTRY_CODES.map(code => ({ code, name: getCountryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
