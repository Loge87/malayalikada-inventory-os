/** Picks an emoji and a soft colour pair for a category card from its name. */

const RULES: [RegExp, string][] = [
  [/rice|grain|cereal|wheat|atta|flour|millet|oats/i, "🌾"],
  [/spice|masala|chilli|chili|pepper|curry|seasoning/i, "🌶️"],
  [/lentil|dal|dhal|pulse|bean|gram|chickpea/i, "🫘"],
  [/oil|ghee|butter|fat/i, "🫒"],
  [/tea|coffee|chai/i, "🍵"],
  [/drink|beverage|juice|soda|water|squash|syrup/i, "🥤"],
  [/snack|chip|crisp|namkeen|biscuit|cookie|cracker/i, "🍿"],
  [/sweet|dessert|candy|chocolate|mithai|jaggery|sugar/i, "🍬"],
  [/frozen|ice|chilled/i, "❄️"],
  [/veg|vegetable|greens|produce/i, "🥦"],
  [/fruit/i, "🍎"],
  [/dairy|milk|paneer|yogh?urt|cheese|cream/i, "🥛"],
  [/meat|chicken|mutton|lamb|beef/i, "🍗"],
  [/fish|seafood|prawn|shrimp/i, "🐟"],
  [/pickle|chutney|achar|jam|preserve/i, "🥒"],
  [/sauce|paste|ketchup|canned|tinned|soup/i, "🥫"],
  [/bread|bakery|bake|baking|noodle|pasta|vermicelli/i, "🥖"],
  [/nut|almond|cashew|dry fruit|seed|raisin/i, "🥜"],
  [/household|clean|home|soap|detergent/i, "🧼"],
  [/personal|care|beauty|hair/i, "🧴"],
];

const PALETTE: [string, string][] = [
  ["#eaf7ef", "#cfeedd"],
  ["#fff3df", "#ffe4b8"],
  ["#eaf2ff", "#d2e3ff"],
  ["#fdeaf1", "#fbd3e3"],
  ["#f1ecff", "#ded3ff"],
  ["#e6f8f7", "#c6efec"],
  ["#fff0e8", "#ffd9c4"],
  ["#f3f7e4", "#e2edbb"],
];

export function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryVisual(name: string): { emoji: string; from: string; to: string } {
  const emoji = RULES.find(([re]) => re.test(name))?.[1] ?? "🛒";
  const [from, to] = PALETTE[hashString(name) % PALETTE.length];
  return { emoji, from, to };
}

/** Monogram gradient for brand tiles. */
const BRAND_GRADIENTS: [string, string][] = [
  ["#17703f", "#3aa86a"],
  ["#e08a12", "#f2b04a"],
  ["#2563eb", "#5b93f5"],
  ["#c0352b", "#e8706a"],
  ["#7c3aed", "#a98af2"],
  ["#0d9488", "#4fc3b9"],
  ["#db2777", "#f0709f"],
  ["#4d7c0f", "#8ab83f"],
];
export function brandGradient(name: string): [string, string] {
  return BRAND_GRADIENTS[hashString(name) % BRAND_GRADIENTS.length];
}
