"use strict";
var GrapeColor;
(function (GrapeColor) {
    GrapeColor["kRed"] = "red";
    GrapeColor["kRose"] = "rose";
    GrapeColor["kWhite"] = "white";
    GrapeColor["kUnknown"] = "unknown";
    GrapeColor["kAny"] = "any";
})(GrapeColor || (GrapeColor = {}));
const kAny = '__any__';
const kUnknown = '__unknown__';
const kDeleted = '__deleted__';
const kKnownGrapes = {
    // Must come before "Riesling" to prevent erroneous substring matches:
    "Schwarzriesling": GrapeColor.kRed,
    // Rest of the list is alpha-sorted:
    "Auxerrois": GrapeColor.kWhite,
    "Bacchus": GrapeColor.kWhite,
    "Cabernet Sauvignon": GrapeColor.kRed,
    "Chardonnay": GrapeColor.kWhite,
    "Dornfelder": GrapeColor.kRed,
    "Frühburgunder": GrapeColor.kRed,
    "Gewürztraminer": GrapeColor.kWhite,
    "Gutedel": GrapeColor.kWhite,
    "Grauburgunder": GrapeColor.kWhite,
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
    "Trollinger": GrapeColor.kRed,
    "Vernatsch": GrapeColor.kRed,
    "Viognier": GrapeColor.kWhite,
    "Weißburgunder": GrapeColor.kWhite,
    "Zweigelt": GrapeColor.kRed,
    // Escape hatch: when in doubt, just say "white"/"red" grape.
    "rosé": GrapeColor.kRose,
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
const kRosePattern = /(\bros(e\b|é(?=[\s)"',.?!\-])|é$)|\bweißherbst\b)/iu;
function ColorForGrape(grape, wine_name) {
    if (kRosePattern.test(wine_name))
        return GrapeColor.kRose;
    if (grape === "" || !kGrapeColorMap.has(grape))
        return GrapeColor.kUnknown;
    return kGrapeColorMap.get(grape);
}
var LogReason;
(function (LogReason) {
    LogReason[LogReason["kUnknown"] = 0] = "kUnknown";
    LogReason[LogReason["kBought"] = 1] = "kBought";
    LogReason[LogReason["kExisting"] = 2] = "kExisting";
    LogReason[LogReason["kReceivedAsGift"] = 3] = "kReceivedAsGift";
    LogReason[LogReason["kConsumed"] = 11] = "kConsumed";
    LogReason[LogReason["kGivenAway"] = 12] = "kGivenAway";
    LogReason[LogReason["kLost"] = 13] = "kLost";
    LogReason[LogReason["kStock"] = 20] = "kStock";
})(LogReason || (LogReason = {}));
var MergeResult;
(function (MergeResult) {
    MergeResult[MergeResult["kOK"] = 0] = "kOK";
    MergeResult[MergeResult["kRegionConflict"] = 1] = "kRegionConflict";
    MergeResult[MergeResult["kCountryConflict"] = 2] = "kCountryConflict";
    MergeResult[MergeResult["kWebsiteConflict"] = 3] = "kWebsiteConflict";
    MergeResult[MergeResult["kAddressConflict"] = 4] = "kAddressConflict";
    MergeResult[MergeResult["kCommentConflict"] = 5] = "kCommentConflict";
    MergeResult[MergeResult["kGrapeConflict"] = 6] = "kGrapeConflict";
})(MergeResult || (MergeResult = {}));
function IsValidReasonFor(reason, delta) {
    if (delta > 0)
        return reason > 0 && reason < 10;
    if (delta < 0)
        return reason > 10 && reason < 20;
    return reason === 0;
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