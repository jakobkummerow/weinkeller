"use strict";
var GrapeColor;
(function (GrapeColor) {
    GrapeColor["kRed"] = "red";
    GrapeColor["kWhite"] = "white";
    GrapeColor["kUnknown"] = "unknown";
    GrapeColor["kAny"] = "any";
})(GrapeColor || (GrapeColor = {}));
const kAny = '__any__';
const kUnknown = '__unknown__';
const kKnownGrapes = {
    "Auxerrois": GrapeColor.kWhite,
    "Bacchus": GrapeColor.kWhite,
    "Cabernet Sauvignon": GrapeColor.kRed,
    "Chardonnay": GrapeColor.kWhite,
    "Dornfelder": GrapeColor.kRed,
    "Gewürztraminer": GrapeColor.kWhite,
    "Gutedel": GrapeColor.kWhite,
    "Grauburgunder": GrapeColor.kWhite,
    "Kerner": GrapeColor.kWhite,
    "Lagrein": GrapeColor.kRed,
    "Lemberger": GrapeColor.kRed,
    "Merlot": GrapeColor.kRed,
    "Muskateller": GrapeColor.kWhite,
    "Müller-Thurgau": GrapeColor.kWhite,
    "Regent": GrapeColor.kRed,
    "Riesling": GrapeColor.kWhite,
    "Rioja": GrapeColor.kRed,
    "Sauvignon Blanc": GrapeColor.kWhite,
    "Scheurebe": GrapeColor.kWhite,
    "Schwarzriesling": GrapeColor.kRed,
    "Silvaner": GrapeColor.kWhite,
    "Souvignier Gris": GrapeColor.kWhite,
    "Spätburgunder": GrapeColor.kRed,
    "Syrah": GrapeColor.kRed,
    "Trollinger": GrapeColor.kRed,
    "Vernatsch": GrapeColor.kRed,
    "Viognier": GrapeColor.kWhite,
    "Weißburgunder": GrapeColor.kWhite,
    "Zweigelt": GrapeColor.kRed,
    // Escape hatch: when in doubt, just say "white"/"red" grape.
    "rot": GrapeColor.kRed,
    "weiß": GrapeColor.kWhite,
};
const kGrapeGuesses = {
    'Grauer Burgunder': 'Grauburgunder',
    'Klingelberg': 'Riesling',
    'Pinot Blanc': 'Weißburgunder',
    'Pinot Gris': 'Grauburgunder',
    'Pinot Grigio': 'Grauburgunder',
    'Pinot Noir': 'Spätburgunder',
    'Weißer Burgunder': 'Weißburgunder',
};
function GuessGrapeForWine(wine) {
    let wine_lower = wine.toLowerCase();
    for (let grape in kKnownGrapes) {
        if (wine_lower.indexOf(grape.toLowerCase()) !== -1)
            return grape;
    }
    for (let guess in kGrapeGuesses) {
        let guess_lower = guess.toLowerCase();
        if (wine_lower.indexOf(guess_lower) !== -1)
            return kGrapeGuesses[guess];
    }
    return "";
}
var kGrapeColorMap = new Map();
for (let grape in kKnownGrapes) {
    kGrapeColorMap.set(grape, kKnownGrapes[grape]);
}
function ColorForGrape(name) {
    if (name === "" || !kGrapeColorMap.has(name))
        return GrapeColor.kUnknown;
    return kGrapeColorMap.get(name);
}
function AddC(parent, nodetype) {
    return parent.appendChild(document.createElement(nodetype));
}
function AddT(parent, text) {
    parent.appendChild(document.createTextNode(text));
}
function SetText(element, text) {
    let text_node = document.createTextNode(text);
    if (element.firstChild) {
        element.replaceChild(text_node, element.firstChild);
    }
    else {
        element.appendChild(text_node);
    }
}
function FormatPrice(double) {
    if (double === 0)
        return "";
    return double.toLocaleString("de", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ParsePrice(string) {
    return Number(string.replace(",", "."));
}
function PopulateDataList(datalist, options) {
    while (datalist.firstChild)
        datalist.removeChild(datalist.firstChild);
    for (var o of options) {
        AddC(datalist, 'option').value = o;
    }
}
function getDateString() {
    let now = new Date();
    let adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return adjusted.toISOString().substr(0, 10);
}
//# sourceMappingURL=utils.js.map