export const COUNTRY_OPTIONS = [
  { value: "DZ", label: "Algeria", dialCode: "+213", currency: "DZD" },
  { value: "AO", label: "Angola", dialCode: "+244", currency: "AOA" },
  { value: "BJ", label: "Benin", dialCode: "+229", currency: "XOF" },
  { value: "BW", label: "Botswana", dialCode: "+267", currency: "BWP" },
  { value: "BF", label: "Burkina Faso", dialCode: "+226", currency: "XOF" },
  { value: "BI", label: "Burundi", dialCode: "+257", currency: "BIF" },
  { value: "CV", label: "Cabo Verde", dialCode: "+238", currency: "CVE" },
  { value: "CM", label: "Cameroon", dialCode: "+237", currency: "XAF" },
  { value: "CF", label: "Central African Republic", dialCode: "+236", currency: "XAF" },
  { value: "TD", label: "Chad", dialCode: "+235", currency: "XAF" },
  { value: "KM", label: "Comoros", dialCode: "+269", currency: "KMF" },
  { value: "CG", label: "Republic of the Congo", dialCode: "+242", currency: "XAF" },
  { value: "CD", label: "Democratic Republic of the Congo", dialCode: "+243", currency: "CDF" },
  { value: "CI", label: "Cote d'Ivoire", dialCode: "+225", currency: "XOF" },
  { value: "DJ", label: "Djibouti", dialCode: "+253", currency: "DJF" },
  { value: "EG", label: "Egypt", dialCode: "+20", currency: "EGP" },
  { value: "GQ", label: "Equatorial Guinea", dialCode: "+240", currency: "XAF" },
  { value: "ER", label: "Eritrea", dialCode: "+291", currency: "ERN" },
  { value: "SZ", label: "Eswatini", dialCode: "+268", currency: "SZL" },
  { value: "ET", label: "Ethiopia", dialCode: "+251", currency: "ETB" },
  { value: "GA", label: "Gabon", dialCode: "+241", currency: "XAF" },
  { value: "GM", label: "Gambia", dialCode: "+220", currency: "GMD" },
  { value: "GH", label: "Ghana", dialCode: "+233", currency: "GHS" },
  { value: "GN", label: "Guinea", dialCode: "+224", currency: "GNF" },
  { value: "GW", label: "Guinea-Bissau", dialCode: "+245", currency: "XOF" },
  { value: "KE", label: "Kenya", dialCode: "+254", currency: "KES" },
  { value: "LS", label: "Lesotho", dialCode: "+266", currency: "LSL" },
  { value: "LR", label: "Liberia", dialCode: "+231", currency: "LRD" },
  { value: "LY", label: "Libya", dialCode: "+218", currency: "LYD" },
  { value: "MG", label: "Madagascar", dialCode: "+261", currency: "MGA" },
  { value: "MW", label: "Malawi", dialCode: "+265", currency: "MWK" },
  { value: "ML", label: "Mali", dialCode: "+223", currency: "XOF" },
  { value: "MR", label: "Mauritania", dialCode: "+222", currency: "MRU" },
  { value: "MU", label: "Mauritius", dialCode: "+230", currency: "MUR" },
  { value: "MA", label: "Morocco", dialCode: "+212", currency: "MAD" },
  { value: "MZ", label: "Mozambique", dialCode: "+258", currency: "MZN" },
  { value: "NA", label: "Namibia", dialCode: "+264", currency: "NAD" },
  { value: "NE", label: "Niger", dialCode: "+227", currency: "XOF" },
  { value: "NG", label: "Nigeria", dialCode: "+234", currency: "NGN" },
  { value: "RW", label: "Rwanda", dialCode: "+250", currency: "RWF" },
  { value: "ST", label: "Sao Tome and Principe", dialCode: "+239", currency: "STN" },
  { value: "SN", label: "Senegal", dialCode: "+221", currency: "XOF" },
  { value: "SC", label: "Seychelles", dialCode: "+248", currency: "SCR" },
  { value: "SL", label: "Sierra Leone", dialCode: "+232", currency: "SLE" },
  { value: "SO", label: "Somalia", dialCode: "+252", currency: "SOS" },
  { value: "ZA", label: "South Africa", dialCode: "+27", currency: "ZAR" },
  { value: "SS", label: "South Sudan", dialCode: "+211", currency: "SSP" },
  { value: "SD", label: "Sudan", dialCode: "+249", currency: "SDG" },
  { value: "TZ", label: "Tanzania", dialCode: "+255", currency: "TZS" },
  { value: "TG", label: "Togo", dialCode: "+228", currency: "XOF" },
  { value: "TN", label: "Tunisia", dialCode: "+216", currency: "TND" },
  { value: "UG", label: "Uganda", dialCode: "+256", currency: "UGX" },
  { value: "ZM", label: "Zambia", dialCode: "+260", currency: "ZMW" },
  { value: "ZW", label: "Zimbabwe", dialCode: "+263", currency: "ZWG" },
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]["value"];
export type CurrencyCode = (typeof COUNTRY_OPTIONS)[number]["currency"];

export function isCountryCode(value: unknown): value is CountryCode {
  return COUNTRY_OPTIONS.some((option) => option.value === value);
}

export function currencyForCountry(country: string): CurrencyCode {
  return (
    COUNTRY_OPTIONS.find((option) => option.value === country)?.currency ||
    "UGX"
  );
}
