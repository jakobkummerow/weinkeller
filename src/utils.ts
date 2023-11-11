"use strict";

enum GrapeColor {
  kRed = "red",
  kRose = "rose",
  kWhite = "white",
  // Bit of a hack to treat sparkling wine as another color, but fits in
  // well with both implementation and usability.
  kSparkling = "sparkling",
  kUnknown = "unknown",
  kAny = "any",  // For convenience.
}

const kAny = '__any__';
const kUnknown = '__unknown__';
const kDeleted = '__deleted__';

const kKnownGrapes: any = {
  // Must come before "Riesling" to prevent erroneous substring matches:
  "Schwarzriesling": GrapeColor.kRed,
  // Rest of the list is alpha-sorted:
  "Auxerrois": GrapeColor.kWhite,
  "Bacchus": GrapeColor.kWhite,
  "Cabernet Franc": GrapeColor.kRed,
  "Cabernet Sauvignon": GrapeColor.kRed,
  "Chardonnay": GrapeColor.kWhite,
  "Dornfelder": GrapeColor.kRed,
  "Frühburgunder": GrapeColor.kRed,
  "Gewürztraminer": GrapeColor.kWhite,
  "Grenache": GrapeColor.kRed,
  "Gutedel": GrapeColor.kWhite,
  "Grauburgunder": GrapeColor.kWhite,
  "Grüner Veltliner": GrapeColor.kWhite,
  "Kerner": GrapeColor.kWhite,
  "Lagrein": GrapeColor.kRed,
  "Lemberger": GrapeColor.kRed,
  "Merlot": GrapeColor.kRed,
  "Muskateller": GrapeColor.kWhite,
  "Müller-Thurgau": GrapeColor.kWhite,
  "Nebbiolo": GrapeColor.kRed,
  "Portugieser": GrapeColor.kRed,
  "Primitivo": GrapeColor.kRed,
  "Regent": GrapeColor.kRed,
  "Riesling": GrapeColor.kWhite,
  "Rioja": GrapeColor.kRed,
  "Saint Laurent": GrapeColor.kRed,
  "Sangiovese": GrapeColor.kRed,
  "Sauvignon Blanc": GrapeColor.kWhite,
  "Scheurebe": GrapeColor.kWhite,
  "Silvaner": GrapeColor.kWhite,
  "Souvignier Gris": GrapeColor.kWhite,
  "Spätburgunder": GrapeColor.kRed,
  "Syrah": GrapeColor.kRed,
  "Tempranillo": GrapeColor.kRed,
  "Trollinger": GrapeColor.kRed,
  "Vernatsch": GrapeColor.kRed,
  "Viognier": GrapeColor.kWhite,
  "Weißburgunder": GrapeColor.kWhite,
  "Zweigelt": GrapeColor.kRed,
  // Escape hatch: when in doubt, just say "white"/"red" grape.
  "rosé": GrapeColor.kRose,
  "rot": GrapeColor.kRed,
  "weiß": GrapeColor.kWhite,
  "Sekt": GrapeColor.kSparkling,
};

const kGrapeGuesses: any = {
  'Grauer Burgunder': 'Grauburgunder',
  'Klingelberg': 'Riesling',  // Implicitly covers "Klingelberger".
  'Pinot Blanc': 'Weißburgunder',
  'Pinot Gris': 'Grauburgunder',
  'Pinot Grigio': 'Grauburgunder',
  'Pinot Noir': 'Spätburgunder',
  'St. Laurent': 'Saint Laurent',
  'Weißer Burgunder': 'Weißburgunder',
};

function GuessGrapeForWine(wine: string): string {
  let wine_lower = wine.toLowerCase();
  for (let grape in kKnownGrapes) {
    if (wine_lower.indexOf(grape.toLowerCase()) !== -1) return grape;
  }
  for (let guess in kGrapeGuesses) {
    let guess_lower = guess.toLowerCase();
    if (wine_lower.indexOf(guess_lower) !== -1) return kGrapeGuesses[guess];
  }
  return "";
}

var kGrapeColorMap = new Map<string, GrapeColor>();
for (let grape in kKnownGrapes) {
  kGrapeColorMap.set(grape, kKnownGrapes[grape] as GrapeColor);
}

const kRosePattern = /(\bros(e\b|é(?=[\s)"',.?!\-])|é$)|\bweißherbst\b)/iu;
// Must end at a word boundary, but not necessarily start at one, in order
// to match "Rieslingsekt" etc.
const kSparklingPattern = /sekt\b/iu;
function ColorForGrape(grape: string, wine_name: string) {
  if (kSparklingPattern.test(wine_name)) return GrapeColor.kSparkling;
  if (kRosePattern.test(wine_name)) return GrapeColor.kRose;
  if (grape === "" || !kGrapeColorMap.has(grape)) return GrapeColor.kUnknown;
  return kGrapeColorMap.get(grape);
}

enum LogReason {
  kUnknown = 0,
  kBought = 1,
  kExisting = 2,
  kReceivedAsGift = 3,
  kConsumed = 11,
  kGivenAway = 12,
  kLost = 13,
  kStock = 20,
}

enum MergeResult {
  kOK = 0,
  kRegionConflict = 1,
  kCountryConflict = 2,
  kWebsiteConflict = 3,
  kAddressConflict = 4,
  kCommentConflict = 5,
  kGrapeConflict = 6,
}

function IsValidReasonFor(reason: number, delta: number) {
  if (delta > 0) return reason > 0 && reason < 10;
  if (delta < 0) return reason > 10 && reason < 20;
  return reason === 0;
}

function AddC<K extends keyof HTMLElementTagNameMap>(parent: Node, nodetype: K):
    HTMLElementTagNameMap[K] {
  return parent.appendChild(document.createElement(nodetype));
}

function AddT(parent: Node, text: string) {
  parent.appendChild(document.createTextNode(text));
}

function SetText(element: Node, text: string) {
  let text_node = document.createTextNode(text);
  if (element.firstChild) {
    element.replaceChild(text_node, element.firstChild);
  } else {
    element.appendChild(text_node);
  }
}

function FormatPrice(double: number) {
  if (double === 0) return "";
  return double.toLocaleString(
      "de", {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

function ParsePrice(string: string) {
  return Number(string.replace(",", "."));
}

function PopulateDataList(datalist: HTMLDataListElement, options: string[]) {
  while (datalist.firstChild) datalist.removeChild(datalist.firstChild);
  for (var o of options) {
    AddC(datalist, 'option').value = o;
  }
}

function getDateString() {
  let now = new Date();
  let adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().substr(0, 10);
}
