"use strict";
var kLang = {
    vineyard: 'Weingut',
    wine: 'Wein',
    wine_new: 'neuer Wein',
    year: 'Jahr',
    count: 'Anzahl',
    stock: 'Inventur',
    price: 'Preis',
    comment: 'Kommentar',
    rating: 'Bewertung',
    value: 'Preis/Leist',
    sweetness: 'Süße',
    age: 'Alter',
    checkmark: '\u2714',
    edit_button_text: '\u270E',
    save_string: '\u2714',
    plus_button_text: '+',
    minus_button_text: '−',
    delete_button_text: '\u2717',
    confirm_delete_wine: 'Diesen Wein (samt Preis, Kommentar, Bewertung) löschen?',
    invalid_count: 'Anzahl fehlt/ungültig!',
    invalid_price: 'Ungültiger Preis!',
    invalid_vineyard: 'Weingut fehlt!',
    invalid_wine: 'Wein fehlt!',
    invalid_year: 'Jahr fehlt/ungültig!',
    year_exists: 'Jahr existiert bereits für diesen Wein!',
    rating_labels: ['Herausragend', 'Sehr gut', 'Gut', 'OK', 'Nicht gut'],
    value_labels: ['Herausragend', 'Sehr gut', 'Solide', 'Mäßig', 'Schlecht'],
    sweetness_labels: ['Dessertwein', 'lieblich', 'feinherb', 'trocken', 'sauer'],
    ages: [
        'unbekannt', 'zu jung', 'wird noch besser', 'genau richtig', 'muss weg',
        'zu alt'
    ],
    total: 'Insgesamt:',
};
var kPricePattern = "[0-9]{1,3}([\.|,][0-9]{1,2})?";
const kRow = 'tr';
const kCell = 'td';
function createCell() {
    return document.createElement(kCell);
}
function FormatAge(int) {
    return kLang.ages[int];
}
function MakeStockApplyButton(callback) {
    let button = document.createElement('button');
    button.className = 'apply';
    button.onclick = callback;
    AddT(button, kLang.checkmark);
    return button;
}
class HideableNameTD {
    constructor(src, className, hidden, onclick) {
        this.src = src;
        this.className = className;
        this.hidden = hidden;
        this.onclick = onclick;
        this.td = createCell();
        this.span = document.createElement('span');
        this.stock_mode = false;
        this.stock_apply_button = null;
        this.td.className = this.className;
        src.registerObserver(this);
    }
    create() {
        this.td.appendChild(this.span);
        AddT(this.span, this.src.data.name);
        this.setHiddenInternal();
        return this.td;
    }
    update() {
        if (this.hidden)
            return;
        if (this.src.data.isDirty()) {
            this.td.classList.add('dirty');
        }
        else {
            this.td.classList.remove('dirty');
        }
        SetText(this.span, this.src.data.name);
        this.createTitle();
    }
    setHidden(hidden) {
        if (hidden === this.hidden)
            return;
        this.hidden = hidden;
        this.setHiddenInternal();
    }
    setHiddenInternal() {
        if (this.hidden) {
            this.span.style.display = 'none';
            this.td.title = '';
            this.td.classList.remove('handcursor');
            this.td.classList.remove('dirty');
            this.td.onclick = null;
        }
        else {
            this.span.style.display = '';
            this.td.classList.add('handcursor');
            this.td.onclick = this.onclick;
            if (this.stock_mode)
                this.getStockApplyButton();
            this.update();
        }
    }
    getStockApplyButton() {
        if (!this.stock_apply_button) {
            this.stock_apply_button = MakeStockApplyButton((event) => {
                event.stopPropagation();
                this.src.applyStock();
            });
            this.span.appendChild(this.stock_apply_button);
        }
        return this.stock_apply_button;
    }
    startStockMode() {
        if (this.stock_mode)
            return;
        this.stock_mode = true;
        if (this.hidden)
            return;
        this.getStockApplyButton().style.display = 'inline-block';
    }
    stopStockMode() {
        if (!this.stock_mode)
            return;
        this.stock_mode = false;
        if (this.hidden)
            return;
        if (!this.stock_apply_button)
            throw "must startStockMode() before stopping";
        this.stock_apply_button.style.display = 'none';
    }
}
class VineyardTD extends HideableNameTD {
    constructor(vineyard, hidden) {
        super(vineyard, 'vineyard', hidden, (event) => {
            g_vineyard_editor.show(vineyard);
        });
    }
    createTitle() {
        this.td.title = this.src.data.region;
    }
}
class WineTD extends HideableNameTD {
    constructor(wine, hidden) {
        super(wine, 'wine', hidden, (event) => {
            g_wine_editor.show(wine);
        });
    }
    createTitle() {
        this.td.title = this.src.data.grape;
    }
}
class YearTD {
    constructor(year) {
        this.year = year;
        this.td = createCell();
        this.stock_apply_button = null;
        AddT(this.td, year.data.year.toString());
    }
    create() { return this.td; }
    update(dirty) {
        if (dirty) {
            this.td.classList.add('dirty');
        }
        else {
            this.td.classList.remove('dirty');
        }
    }
    startStockMode() {
        if (!this.stock_apply_button) {
            this.stock_apply_button = MakeStockApplyButton((event) => {
                event.stopPropagation();
                this.year.applyStock();
            });
            this.td.appendChild(this.stock_apply_button);
        }
        this.stock_apply_button.style.display = 'inline-block';
    }
    stopStockMode() {
        if (!this.stock_apply_button)
            return;
        this.stock_apply_button.style.display = 'none';
    }
}
class BaseCountTD {
    constructor(year) {
        this.year = year;
        this.td = createCell();
        this.plus_button = document.createElement('button');
        this.minus_button = document.createElement('button');
    }
    create(plus_callback, minus_callback) {
        AddT(this.plus_button, kLang.plus_button_text);
        this.plus_button.className = 'plus';
        this.plus_button.onclick = plus_callback;
        this.minus_button.className = 'minus';
        this.minus_button.onclick = minus_callback;
        AddT(this.td, ""); // To be updated.
        this.td.appendChild(this.plus_button);
        this.td.appendChild(this.minus_button);
        this.td.className = 'count';
        return this.td;
    }
}
class CountTD extends BaseCountTD {
    constructor(year) { super(year); }
    create() {
        return super.create((_) => { this.year.clickPlus(); }, (_) => { this.clickMinus(); });
    }
    update(count) {
        SetText(this.td, count.toString());
        if (count === 0) {
            SetText(this.minus_button, kLang.delete_button_text);
        }
        else {
            SetText(this.minus_button, kLang.minus_button_text);
        }
    }
    clickMinus() {
        if (this.year.data.count > 0)
            return this.year.clickMinus();
        if (!confirm(kLang.confirm_delete_wine))
            return;
        this.year.clickDelete();
    }
}
class StockTD extends BaseCountTD {
    constructor(year) {
        super(year);
        this.hidden = false;
        AddT(this.minus_button, kLang.minus_button_text);
    }
    create() {
        return super.create((_) => { this.year.clickStockPlus(); }, (_) => { this.year.clickStockMinus(); });
    }
    update(stock) {
        SetText(this.td, stock.toString());
        this.minus_button.disabled = (stock === 0);
        if (stock !== this.year.data.count) {
            this.td.classList.add('highlight');
        }
        else {
            this.td.classList.remove('highlight');
        }
    }
    hide() {
        if (this.hidden)
            return;
        this.hidden = true;
        this.td.style.display = 'none';
    }
    show() {
        if (!this.hidden)
            return;
        this.hidden = false;
        this.td.style.display = 'table-cell';
    }
}
class EditableTD {
    constructor(year) {
        this.year = year;
        this.td = createCell();
        this.div = document.createElement('div');
        this.input = null;
        this.td.appendChild(this.div);
        this.div.className = 'editable';
    }
    configureInput(input) { }
    create() { return this.td; }
    update() { SetText(this.div, this.readData()); }
    startEditing(keyup_handler) {
        if (this.input === null) {
            this.input = document.createElement('input');
            this.input.className = 'edit';
            this.input.type = 'text';
            this.input.onkeyup = keyup_handler;
            this.configureInput(this.input);
        }
        this.input.value = this.readData();
        this.td.replaceChild(this.input, this.td.firstChild);
    }
    stopEditing() {
        this.td.replaceChild(this.div, this.td.firstChild);
        this.update();
    }
}
class PriceTD extends EditableTD {
    constructor(year) {
        super(year);
        this.td.className = 'price';
    }
    isValid() {
        if (!this.input)
            throw "must startEditing() before calling isValid()";
        return this.input.reportValidity();
    }
    value() {
        if (!this.input)
            throw "must startEditing() before calling value()";
        return ParsePrice(this.input.value);
    }
    readData() { return FormatPrice(this.year.data.price); }
    configureInput(input) {
        input.pattern = kPricePattern;
        input.classList.add('price');
    }
}
class CommentTD extends EditableTD {
    constructor(year) {
        super(year);
    }
    value() {
        if (!this.input)
            throw "must startEditing() before calling value()";
        return this.input.value.trim();
    }
    readData() { return this.year.data.comment; }
}
class ButtonTD {
    constructor(year_tr) {
        this.year_tr = year_tr;
        this.td = createCell();
        this.button = document.createElement('button');
    }
    create() {
        this.button.className = "edit";
        this.button.onclick = (event) => {
            this.year_tr.clickEdit();
        };
        this.td.appendChild(this.button);
        this.stopEditing();
        return this.td;
    }
    startEditing() {
        SetText(this.button, kLang.save_string);
    }
    stopEditing() {
        SetText(this.button, kLang.edit_button_text);
    }
}
class BaseRatingTD {
    constructor(year) {
        this.year = year;
        this.inputs = [];
        this.count = 0;
    }
    createInternal(labels, radio_basename) {
        let td = createCell();
        let fieldset = AddC(td, 'fieldset');
        fieldset.className = 'rating';
        this.count = labels.length;
        let name = radio_basename + this.year.local_id;
        for (let i = 0; i < this.count; i++) {
            let value = this.count - i;
            let input = AddC(fieldset, 'input');
            input.type = 'radio';
            input.name = name;
            input.value = value.toString();
            if (i === 0)
                input.className = 'fivestar';
            this.inputs.push(input);
            let star = AddC(fieldset, 'span');
            star.title = labels[i];
            star.onclick = (event) => {
                event.preventDefault();
                this.clicked(value);
            };
            AddT(star, '★');
        }
        return td;
    }
    update(value) {
        if (value === 0)
            return; // "0" means "not set".
        this.inputs[(this.count - value)].checked = true;
    }
}
class RatingTD extends BaseRatingTD {
    constructor(year) { super(year); }
    create() {
        return this.createInternal(kLang.rating_labels, "rating");
    }
    clicked(value) {
        this.year.updateRating(value);
    }
}
class ValueTD extends BaseRatingTD {
    constructor(year) { super(year); }
    create() {
        return this.createInternal(kLang.value_labels, "value");
    }
    clicked(value) {
        this.year.updateValue(value);
    }
}
class SweetnessTD extends BaseRatingTD {
    constructor(year) { super(year); }
    create() {
        return this.createInternal(kLang.sweetness_labels, "sweetness");
    }
    clicked(value) {
        this.year.updateSweetness(value);
    }
}
class AgeTD {
    constructor(year) {
        this.year = year;
        this.td = createCell();
        this.select = document.createElement('select');
    }
    create() {
        AddT(this.td, ""); // To be replaced.
        this.td.appendChild(this.select);
        this.select.className = 'reason';
        this.select.onchange = (_) => { this.clicked(); };
        for (let i = 0; i < kLang.ages.length; i++) {
            let option = AddC(this.select, 'option');
            option.value = i.toString();
            AddT(option, FormatAge(i));
        }
        return this.td;
    }
    update(value) {
        SetText(this.td, FormatAge(value));
        this.select.options[value].selected = true;
    }
    clicked() {
        let value = this.select.value;
        this.year.updateAge(Number(value));
    }
}
class HideableTR {
    constructor() {
        this.tr = document.createElement(kRow);
    }
    hide() {
        var _a;
        (_a = this.tr.parentElement) === null || _a === void 0 ? void 0 : _a.removeChild(this.tr);
    }
}
class YearTR extends HideableTR {
    constructor(year, showVineyard, showWine) {
        super();
        this.year = year;
        this.showVineyard = showVineyard;
        this.showWine = showWine;
        this.editing = false;
        this.keyup_handler = null;
        year.registerObserver(this);
        this.vineyard = new VineyardTD(year.wine.vineyard, !showVineyard);
        this.wine = new WineTD(year.wine, !showWine);
        this.year_td = new YearTD(this.year);
        this.count = new CountTD(this.year);
        this.stock = new StockTD(this.year);
        this.price = new PriceTD(this.year);
        this.comment = new CommentTD(this.year);
        this.button = new ButtonTD(this);
        this.rating = new RatingTD(this.year);
        this.value = new ValueTD(this.year);
        this.sweetness = new SweetnessTD(this.year);
        this.age = new AgeTD(this.year);
        this.tr.appendChild(this.vineyard.create());
        this.tr.appendChild(this.wine.create());
        this.tr.appendChild(this.year_td.create());
        this.tr.appendChild(this.count.create());
        this.tr.appendChild(this.stock.create());
        this.tr.appendChild(this.price.create());
        this.tr.appendChild(this.comment.create());
        this.tr.appendChild(this.button.create());
        this.tr.appendChild(this.rating.create());
        this.tr.appendChild(this.value.create());
        this.tr.appendChild(this.sweetness.create());
        this.tr.appendChild(this.age.create());
        this.update();
    }
    setShowVineyard(show) {
        this.vineyard.setHidden(!show);
    }
    setShowWine(show) {
        this.wine.setHidden(!show);
    }
    update() {
        let data = this.year.data;
        this.year_td.update(data.isDirty());
        this.count.update(data.count);
        this.stock.update(data.stock);
        this.rating.update(data.rating);
        this.value.update(data.value);
        this.sweetness.update(data.sweetness);
        this.age.update(data.age);
        if (this.editing)
            return; // Don't interfere with the user.
        this.price.update();
        this.comment.update();
    }
    clickEdit() {
        if (!this.editing) {
            this.editing = true;
            this.price.startEditing(this.getKeyupHandler());
            this.comment.startEditing(this.getKeyupHandler());
            this.button.startEditing();
        }
        else {
            this.stopEditing(true);
        }
    }
    stopEditing(save) {
        if (save) {
            if (!this.price.isValid()) {
                alert(kLang.invalid_price);
                return;
            }
            this.year.editPriceComment(this.price.value(), this.comment.value());
        }
        this.price.stopEditing();
        this.comment.stopEditing();
        this.button.stopEditing();
        this.editing = false;
    }
    getKeyupHandler() {
        if (this.keyup_handler === null) {
            this.keyup_handler = (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.stopEditing(true);
                }
                else if (event.key === "Escape") {
                    event.preventDefault();
                    this.stopEditing(false);
                }
            };
        }
        return this.keyup_handler;
    }
    startStockMode() {
        this.vineyard.startStockMode();
        this.wine.startStockMode();
        this.year_td.startStockMode();
    }
    stopStockMode() {
        this.vineyard.stopStockMode();
        this.wine.stopStockMode();
        this.year_td.stopStockMode();
    }
}
class InputTD {
    constructor(placeholder) {
        this.td = createCell();
        this.input = document.createElement('input');
        this.td.appendChild(this.input);
        this.input.className = 'edit';
        this.input.placeholder = placeholder;
    }
    getStringValue() {
        return this.input.value.trim();
    }
    clear() {
        this.input.value = "";
    }
}
class VineyardInputTD extends InputTD {
    constructor(data) {
        super(kLang.vineyard);
        this.data = data;
        this.list = document.createElement('datalist');
        let list_id = "vineyard_completions";
        this.list.id = list_id;
        this.td.appendChild(this.list);
        this.input.setAttribute("list", list_id);
        this.input.size = 10;
        this.input.onfocus = (_) => {
            PopulateDataList(this.list, this.data.getVineyardNames());
        };
    }
}
class WineInputTD extends InputTD {
    constructor(row) {
        super(kLang.wine_new);
        this.row = row;
        this.list = document.createElement('datalist');
        let list_id = 'wine_completions';
        if (this.row.vineyard)
            list_id += this.row.vineyard.local_id;
        this.list.id = list_id;
        this.td.appendChild(this.list);
        this.input.setAttribute("list", list_id);
        this.input.size = 10;
        this.input.onfocus = (_) => { this.populateCompletions(); };
    }
    populateCompletions() {
        if (this.row.vineyard) {
            PopulateDataList(this.list, this.row.vineyard.getWineNames());
        }
        else if (this.row.vineyard_td) {
            let name = this.row.vineyard_td.getStringValue();
            PopulateDataList(this.list, this.row.data.getWineNamesForVineyard(name));
        }
    }
}
class IntegerInputTD extends InputTD {
    constructor(placeholder, min, max, className) {
        super(placeholder);
        this.input.type = 'number';
        this.input.min = min;
        this.input.max = max;
        this.input.step = "1";
        this.input.classList.add(className);
    }
    isValid() {
        return this.input.value !== "" && this.input.reportValidity();
    }
    getNumberValue() {
        return Number(this.input.value);
    }
}
class PriceInputTD extends InputTD {
    constructor() {
        super(kLang.price);
        this.td.classList.add('price');
        this.input.pattern = kPricePattern;
        this.input.classList.add('price');
    }
    isValid() {
        return this.input.reportValidity();
    }
    getNumberValue() {
        return ParsePrice(this.input.value);
    }
}
class EmptyTD {
    constructor() {
        this.td = createCell();
        this.hidden = false;
    }
    hide() {
        if (this.hidden)
            return;
        this.hidden = true;
        this.td.style.display = 'none';
    }
    show() {
        if (!this.hidden)
            return;
        this.hidden = false;
        this.td.style.display = 'table-cell';
    }
}
class EditTR extends HideableTR {
    constructor(data, vineyard = null, wine = null) {
        super();
        this.data = data;
        this.vineyard = vineyard;
        this.wine = wine;
        // TODO: factor into EditTrContents and create lazily on first show()?
        this.vineyard_td = null;
        this.wine_td = null;
        this.year = new IntegerInputTD(kLang.year, "1900", "2200", 'year');
        this.count = new IntegerInputTD(kLang.count, "0", "9999", 'count');
        this.stock = new EmptyTD();
        this.price = new PriceInputTD();
        this.comment = new InputTD(kLang.comment);
        if (this.vineyard) {
            AddC(this.tr, kCell);
        }
        else {
            this.vineyard_td = new VineyardInputTD(data);
            this.tr.appendChild(this.vineyard_td.td);
        }
        if (this.wine) {
            AddC(this.tr, kCell);
        }
        else {
            this.wine_td = new WineInputTD(this);
            this.tr.appendChild(this.wine_td.td);
        }
        this.tr.appendChild(this.year.td);
        this.tr.appendChild(this.count.td);
        this.tr.appendChild(this.stock.td);
        this.tr.appendChild(this.price.td);
        this.tr.appendChild(this.comment.td);
        let button_td = AddC(this.tr, kCell);
        let button = AddC(button_td, 'button');
        AddT(button, kLang.checkmark);
        button.className = "add";
        button.onclick = (_) => { this.clickAdd(); };
    }
    clickAdd() {
        // Check validity of inputs.
        let vineyard_name = "";
        let wine_name = "";
        if (this.vineyard_td) {
            vineyard_name = this.vineyard_td.getStringValue();
            if (!vineyard_name) {
                alert(kLang.invalid_vineyard);
                return;
            }
        }
        if (this.wine_td) {
            wine_name = this.wine_td.getStringValue();
            if (!wine_name) {
                alert(kLang.invalid_wine);
                return;
            }
        }
        if (!this.year.isValid()) {
            alert(kLang.invalid_year);
            return;
        }
        if (!this.count.isValid()) {
            alert(kLang.invalid_count);
            return;
        }
        if (!this.price.isValid()) {
            alert(kLang.invalid_price);
            return;
        }
        // Commit.
        let vineyard = this.vineyard || this.data.getOrCreateVineyard(vineyard_name);
        let wine = this.wine || this.data.getOrCreateWine(vineyard, wine_name);
        let year = this.year.getNumberValue();
        let count = this.count.getNumberValue();
        let price = this.price.getNumberValue();
        let comment = this.comment.getStringValue();
        // One more check which we couldn't do before. This can only fire if
        // vineyard and wine existed already, so we effectively haven't committed
        // anything yet in that case.
        if (wine.hasYear(year)) {
            alert(kLang.year_exists);
            return;
        }
        this.data.getOrCreateYear(wine, year, count, price, comment);
        // Clear.
        if (this.vineyard_td)
            this.vineyard_td.clear();
        if (this.wine_td)
            this.wine_td.clear();
        this.year.clear();
        this.price.clear();
        this.count.clear();
        this.comment.clear();
    }
}
class TotalsTR {
    constructor(data) {
        this.data = data;
        this.tr = document.createElement(kRow);
        this.price_td = createCell();
        this.stock = new EmptyTD();
        this.count_td = createCell();
        this.total_price = 0;
        this.total_count = 0;
        g_watchpoints.totals.registerObserver(this);
        let label = AddC(this.tr, kCell);
        AddT(label, kLang.total);
        AddC(this.tr, kCell); // Wine.
        AddC(this.tr, kCell); // Year.
        this.tr.appendChild(this.count_td);
        this.tr.appendChild(this.stock.td);
        this.tr.appendChild(this.price_td);
        this.price_td.className = 'price';
        this.data.iterateYears((year) => {
            let count = year.data.count;
            this.total_count += count;
            this.total_price += year.data.price * count;
        });
        this.updateText();
    }
    update() {
        // TODO: This logic is imprecise insofar as it doesn't check whether the
        // year that the delta refers to is currently displayed or hidden.
        // Specifically, if only white wines are shown and the server sends an
        // update about a red wine, this would erroneously update the totals.
        this.total_price += g_watchpoints.totals.priceDelta();
        this.total_count += g_watchpoints.totals.countDelta();
        this.updateText();
    }
    updateText() {
        SetText(this.count_td, this.total_count.toString());
        SetText(this.price_td, FormatPrice(this.total_price));
    }
    updateDisplayedTotals(total_count, total_price) {
        this.total_count = total_count;
        this.total_price = total_price;
        this.updateText();
    }
}
var SortMode;
(function (SortMode) {
    SortMode[SortMode["kDefault"] = 0] = "kDefault";
    SortMode[SortMode["kYear"] = 1] = "kYear";
    SortMode[SortMode["kCount"] = 2] = "kCount";
    SortMode[SortMode["kPrice"] = 3] = "kPrice";
    SortMode[SortMode["kRating"] = 4] = "kRating";
    SortMode[SortMode["kValue"] = 5] = "kValue";
    SortMode[SortMode["kSweetness"] = 6] = "kSweetness";
    SortMode[SortMode["kAge"] = 7] = "kAge";
})(SortMode || (SortMode = {}));
class GrapeNameWatcher {
    constructor(sorter) {
        this.sorter = sorter;
        g_watchpoints.grape_names.registerObserver(this);
    }
    update() { this.sorter.grapeChanged(); }
}
class VineyardCountryWatcher {
    constructor(sorter) {
        this.sorter = sorter;
        g_watchpoints.vineyard_countries.registerObserver(this);
    }
    update() { this.sorter.countryChanged(); }
}
class VineyardRegionWatcher {
    constructor(sorter) {
        this.sorter = sorter;
        g_watchpoints.vineyard_regions.registerObserver(this);
    }
    update() { this.sorter.regionChanged(); }
}
class YearDeletionWatcher {
    constructor(sorter) {
        this.sorter = sorter;
        g_watchpoints.deletions.registerObserver(this);
    }
    update() { this.sorter.sortAgain(); }
}
class TableSorter {
    constructor(winelist, tbody) {
        this.winelist = winelist;
        this.tbody = tbody;
        this.sort_mode = SortMode.kDefault;
        this.edit_mode = false;
        this.only_existing = true;
        this.color_filter = GrapeColor.kAny;
        this.grape_filter = kAny;
        this.country_filter = kAny;
        this.region_filter = kAny;
        this.getYear = (year) => year.data.year;
        this.getCount = (year) => year.data.count;
        this.getPrice = (year) => year.data.price;
        this.getRating = (year) => year.data.rating;
        this.getValue = (year) => year.data.value;
        this.getSweetness = (year) => year.data.sweetness;
        this.getAge = (year) => year.data.age;
        this.getDefault = (year) => {
            return {
                vineyard: year.wine.vineyard.data.name,
                wine: year.wine.data.name,
                year: year.data.year
            };
        };
        this.compareAsc = (a, b) => a.value - b.value;
        this.compareDesc = (a, b) => b.value - a.value;
        this.compareDefault = (a, b) => {
            let a_val = a.value;
            let b_val = b.value;
            let comp = a_val.vineyard.localeCompare(b_val.vineyard);
            if (comp !== 0)
                return comp;
            comp = a_val.wine.localeCompare(b_val.wine);
            if (comp !== 0)
                return comp;
            return a_val.year - b_val.year;
        };
        this.getter = this.getDefault;
        this.comparer = this.compareDefault;
        new GrapeNameWatcher(this);
        new VineyardCountryWatcher(this);
        new VineyardRegionWatcher(this);
        new YearDeletionWatcher(this);
    }
    setEditMode(editMode) {
        if (editMode === this.edit_mode)
            return;
        this.edit_mode = editMode;
        if (editMode) {
            this.sortAgain();
        }
        else {
            for (let edit_row of this.winelist.edit_rows) {
                edit_row.hide();
            }
        }
    }
    setOnlyExisting(only_existing) {
        if (only_existing === this.only_existing)
            return;
        this.only_existing = only_existing;
        this.sortAgain();
    }
    setColorFilter(color) {
        if (color === this.color_filter)
            return;
        this.color_filter = color;
        this.sortAgain();
    }
    setGrapeFilter(grape) {
        if (grape === this.grape_filter)
            return;
        this.grape_filter = grape;
        this.sortAgain();
    }
    setCountryFilter(country) {
        if (country === this.country_filter)
            return;
        this.country_filter = country;
        this.sortAgain();
    }
    setRegionFilter(region) {
        if (region === this.region_filter)
            return;
        this.region_filter = region;
        this.sortAgain();
    }
    grapeChanged() {
        if (this.color_filter === GrapeColor.kAny)
            return;
        this.sortAgain();
    }
    countryChanged() {
        if (this.country_filter === kAny)
            return;
        this.sortAgain();
    }
    regionChanged() {
        if (this.region_filter === kAny)
            return;
        this.sortAgain();
    }
    isShown(year) {
        if (this.only_existing && year.data.count === 0) {
            if (!this.winelist.isStockMode() || year.data.stock === 0) {
                return false;
            }
        }
        if (year.data.count < 0)
            return false;
        const grape = year.wine.data.grape;
        if (this.color_filter !== GrapeColor.kAny &&
            this.color_filter !== ColorForGrape(grape)) {
            return false;
        }
        if (this.grape_filter !== kAny) {
            if (this.grape_filter === kUnknown) {
                if (grape)
                    return false;
            }
            else {
                if (grape !== this.grape_filter)
                    return false;
            }
        }
        if (this.country_filter !== kAny) {
            const country = year.wine.vineyard.data.country;
            if (this.country_filter === kUnknown) {
                if (country)
                    return false;
            }
            else {
                if (country !== this.country_filter)
                    return false;
            }
        }
        if (this.region_filter !== kAny) {
            const region = year.wine.vineyard.data.region;
            if (this.region_filter === kUnknown) {
                if (region)
                    return false;
            }
            else {
                if (region !== this.region_filter)
                    return false;
            }
        }
        return true;
    }
    sort(mode) {
        if (mode === SortMode.kDefault) {
            this.comparer = this.compareDefault;
            this.getter = this.getDefault;
        }
        else if (mode === this.sort_mode) {
            if (this.comparer === this.compareAsc) {
                this.comparer = this.compareDesc;
            }
            else {
                this.comparer = this.compareAsc;
            }
        }
        else {
            if (mode === SortMode.kYear) {
                this.comparer = this.compareAsc;
                this.getter = this.getYear;
            }
            else if (mode === SortMode.kCount) {
                this.comparer = this.compareDesc;
                this.getter = this.getCount;
            }
            else if (mode === SortMode.kPrice) {
                this.comparer = this.compareAsc;
                this.getter = this.getPrice;
            }
            else if (mode === SortMode.kRating) {
                this.comparer = this.compareDesc;
                this.getter = this.getRating;
            }
            else if (mode === SortMode.kValue) {
                this.comparer = this.compareDesc;
                this.getter = this.getValue;
            }
            else if (mode === SortMode.kSweetness) {
                this.comparer = this.compareDesc;
                this.getter = this.getSweetness;
            }
            else if (mode === SortMode.kAge) {
                this.comparer = this.compareAsc;
                this.getter = this.getAge;
            }
        }
        this.sort_mode = mode;
        this.sortAgain();
    }
    sortAgain() {
        let list = [];
        let total_count = 0;
        let total_price = 0;
        // Hide all edit rows; we'll figure out later which ones are needed.
        for (let edit_row of this.winelist.edit_rows) {
            edit_row.hide();
        }
        for (let row of this.winelist.year_rows) {
            let year = row.year;
            if (this.isShown(year)) {
                list.push({ row: row, value: this.getter(year) });
                total_count += year.data.count;
                total_price += year.data.count * year.data.price;
            }
            else {
                row.hide();
            }
        }
        list.sort(this.comparer);
        let last_vineyard = "";
        let last_wine = "";
        for (let i = 0; i < list.length; i++) {
            let l = list[i];
            let row = l.row;
            this.tbody.appendChild(row.tr);
            if (this.sort_mode === SortMode.kDefault) {
                let value = l.value;
                let show_vineyard = value.vineyard !== last_vineyard;
                let show_wine = show_vineyard || value.wine !== last_wine;
                row.setShowVineyard(show_vineyard);
                row.setShowWine(show_wine);
                last_vineyard = value.vineyard;
                last_wine = value.wine;
                // Edit rows.
                if (!this.edit_mode)
                    continue;
                let show_new_wine;
                let show_new_year;
                if (i === list.length - 1) {
                    show_new_wine = show_new_year = true;
                }
                else {
                    let next_value = list[i + 1].value;
                    show_new_wine = value.vineyard !== next_value.vineyard;
                    show_new_year = show_new_wine || value.wine !== next_value.wine;
                }
                if (show_new_year) {
                    let wine = row.year.wine;
                    let edit_row = this.winelist.wine_edit_rows.get(wine);
                    if (!edit_row)
                        throw "bug: edit_row must exist for wine";
                    this.tbody.appendChild(edit_row.tr);
                }
                if (show_new_wine) {
                    let vineyard = row.year.wine.vineyard;
                    let edit_row = this.winelist.vineyard_edit_rows.get(vineyard);
                    if (!edit_row)
                        throw "bug: edit_row must exist for vineyard!";
                    this.tbody.appendChild(edit_row.tr);
                }
            }
            else {
                row.setShowVineyard(true);
                row.setShowWine(true);
            }
        }
        this.winelist.updateDisplayedTotals(total_count, total_price);
    }
}
class WinelistUI {
    constructor(data) {
        this.data = data;
        this.table = document.createElement('table');
        this.tbody = document.createElement('tbody');
        this.sorter = new TableSorter(this, this.tbody);
        this.year_rows = [];
        this.edit_rows = [];
        this.vineyard_edit_rows = new Map();
        this.wine_edit_rows = new Map();
        this.stock_mode = true;
        this.stock_tds = [];
        this.edit_stock_tds = [];
        let container = AddC(document.body, 'div');
        container.appendChild(this.table);
        container.className = "winelistcontainer";
        this.table.className = "winelist";
        this.sidebar = new Sidebar(this, g_connection);
    }
    addHeaderTD(tr, label, sortMode = null) {
        let td = AddC(tr, kCell);
        AddT(td, label);
        if (sortMode !== null) {
            td.onclick = (event) => { this.sorter.sort(sortMode); };
        }
        return td;
    }
    create() {
        this.data.ui = this; // Ready for update notifications now.
        // Create header row.
        let thead = AddC(this.table, 'thead');
        let tr = AddC(thead, kRow);
        this.addHeaderTD(tr, kLang.vineyard, SortMode.kDefault);
        this.addHeaderTD(tr, kLang.wine, SortMode.kDefault);
        this.addHeaderTD(tr, kLang.year, SortMode.kYear);
        let count_td = this.addHeaderTD(tr, kLang.count, SortMode.kCount);
        count_td.classList.add('centered');
        this.stock_header_td = this.addHeaderTD(tr, kLang.stock);
        let price_td = this.addHeaderTD(tr, kLang.price, SortMode.kPrice);
        price_td.classList.add('centered');
        this.addHeaderTD(tr, kLang.comment);
        this.addHeaderTD(tr, ""); // Buttons.
        this.addHeaderTD(tr, kLang.rating, SortMode.kRating);
        this.addHeaderTD(tr, kLang.value, SortMode.kValue);
        this.addHeaderTD(tr, kLang.sweetness, SortMode.kSweetness);
        this.addHeaderTD(tr, kLang.age, SortMode.kAge);
        // Populate.
        this.table.appendChild(this.tbody);
        this.data.iterateVineyards((vineyard) => {
            let vineyard_first = true;
            vineyard.iterateWines((wine) => {
                let wine_first = true;
                wine.iterateYears((year) => {
                    this.addYearTR(year, vineyard_first, wine_first);
                    wine_first = false;
                    vineyard_first = false;
                });
                // "New year" edit row.
                this.addWineEditRow(vineyard, wine);
            });
            // "New wine" edit row.
            this.addVineyardEditRow(vineyard);
        });
        // Footer.
        let tfoot = AddC(this.table, 'tfoot');
        let add_row = new EditTR(this.data, null, null);
        add_row.stock.hide();
        this.edit_stock_tds.push(add_row.stock);
        tfoot.appendChild(add_row.tr);
        this.totals = new TotalsTR(this.data);
        this.totals.stock.hide();
        this.edit_stock_tds.push(this.totals.stock);
        tfoot.appendChild(this.totals.tr);
        // Sidebar.
        this.sidebar.create();
        this.setStockMode(false);
        // Log.
        this.log = new LogUI(this.data);
        this.log.create();
        // Side effect: populate totals row.
        this.sorter.sortAgain();
    }
    addYear(year) {
        this.addYearTR(year, false, false);
        let wine = year.wine;
        let vineyard = wine.vineyard;
        if (!this.vineyard_edit_rows.has(vineyard)) {
            this.addVineyardEditRow(vineyard);
        }
        if (!this.wine_edit_rows.has(wine)) {
            this.addWineEditRow(vineyard, wine);
        }
        this.sorter.sortAgain();
    }
    reviveYear(year) {
        for (let year_tr of this.year_rows) {
            if (year_tr.year === year) {
                this.sorter.sortAgain();
                return;
            }
        }
        this.addYear(year);
    }
    addLog(log) {
        this.log.addLog(log);
    }
    addYearTR(year, showVineyard, showWine) {
        let year_tr = new YearTR(year, showVineyard, showWine);
        this.year_rows.push(year_tr);
        this.stock_tds.push(year_tr.stock);
        if (this.stock_mode) {
            year_tr.startStockMode();
        }
        else {
            year_tr.stock.hide();
        }
        this.tbody.appendChild(year_tr.tr);
    }
    addVineyardEditRow(vineyard) {
        let edit = new EditTR(this.data, vineyard, null);
        this.edit_rows.push(edit);
        this.vineyard_edit_rows.set(vineyard, edit);
        this.edit_stock_tds.push(edit.stock);
        if (!this.stock_mode)
            edit.stock.hide();
        return edit;
    }
    addWineEditRow(vineyard, wine) {
        let edit = new EditTR(this.data, vineyard, wine);
        this.edit_rows.push(edit);
        this.wine_edit_rows.set(wine, edit);
        this.edit_stock_tds.push(edit.stock);
        if (!this.stock_mode)
            edit.stock.hide();
        return edit;
    }
    setEditMode(edit_mode) {
        this.sorter.setEditMode(edit_mode);
    }
    setStockMode(stock_mode) {
        if (stock_mode === this.stock_mode)
            return;
        this.stock_mode = stock_mode;
        if (stock_mode) {
            this.stock_header_td.style.display = 'table-cell';
            for (let stock of this.stock_tds)
                stock.show();
            for (let stock of this.edit_stock_tds)
                stock.show();
            for (let row of this.year_rows)
                row.startStockMode();
        }
        else {
            this.stock_header_td.style.display = 'none';
            for (let stock of this.stock_tds)
                stock.hide();
            for (let stock of this.edit_stock_tds)
                stock.hide();
            for (let row of this.year_rows)
                row.stopStockMode();
        }
    }
    isStockMode() {
        return this.stock_mode;
    }
    applyAllStock() {
        this.data.applyAllStock();
    }
    resetAllStock() {
        this.data.resetAllStock();
    }
    setOnlyExisting(only_existing) {
        this.sorter.setOnlyExisting(only_existing);
    }
    setColorFilter(color) {
        this.sorter.setColorFilter(color);
    }
    setGrapeFilter(grape) {
        this.sorter.setGrapeFilter(grape);
    }
    setCountryFilter(country) {
        this.sorter.setCountryFilter(country);
    }
    setRegionFilter(region) {
        this.sorter.setRegionFilter(region);
    }
    updateDisplayedTotals(total_count, total_price) {
        this.totals.updateDisplayedTotals(total_count, total_price);
    }
}
//# sourceMappingURL=ui.js.map