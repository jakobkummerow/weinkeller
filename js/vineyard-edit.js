"use strict";
const kEditLang = {
    edit: "Bearbeiten",
    close: "Schließen",
    save: "Speichern",
    total_count: "Bestand (Flaschen)",
    total_price: "Bestand (Preis)",
    name: "Name",
    country: "Land",
    region: "Region",
    website: "Website",
    address: "Adresse",
    comment: "Kommentar",
    vineyard: "Weingut",
    grape: "Traube",
    maps_prefix: "https://www.google.de/maps/search/Weingut+",
};
class EditorRow {
    constructor(label) {
        this.tr = document.createElement('tr');
        this.td = document.createElement('td');
        this.input = null;
        this.value = "";
        let label_td = AddC(this.tr, 'td');
        label_td.className = 'label';
        if (label !== '') {
            AddT(label_td, label + ':');
        }
        this.tr.appendChild(this.td);
    }
    update(value) {
        this.value = value;
        SetText(this.td, value);
    }
    createInput() {
        let input = document.createElement('input');
        input.className = 'edit';
        input.type = 'text;';
        return input;
    }
    startEditing() {
        if (this.input === null) {
            this.input = this.createInput();
        }
        this.input.value = this.value;
        this.td.replaceChild(this.input, this.td.firstChild);
    }
    stopEditing() {
        if (this.input === null) {
            throw "input must have been created";
        }
        let value = this.input.value.trim();
        this.update(value);
        return value;
    }
}
class DataListRow extends EditorRow {
    constructor(label) {
        super(label);
        this.list = document.createElement('datalist');
        let list_id = label + "_datalist";
        this.tr.appendChild(this.list);
        this.list.id = list_id;
        this.input = this.createInput();
        this.input.setAttribute("list", list_id);
    }
    getInput() {
        return this.input;
    }
}
class WebsiteRow extends EditorRow {
    constructor(label) {
        super(label);
        this.link = document.createElement('a');
        this.td.appendChild(this.link);
    }
    update(value) {
        this.value = value;
        SetText(this.link, value);
        if (!value.startsWith("http"))
            value = "http://" + value;
        this.link.href = value;
        this.td.replaceChild(this.link, this.td.firstChild);
    }
}
class MapsRow extends EditorRow {
    constructor() {
        super('');
        this.link = document.createElement('a');
        this.td.appendChild(this.link);
        AddT(this.link, "Google Maps");
    }
    update(value) {
        this.link.href = kEditLang.maps_prefix + encodeURIComponent(value);
    }
}
class CommentRow extends EditorRow {
    constructor(label) {
        super(label);
        this.td.style.whiteSpace = 'pre-line';
    }
    createInput() {
        let input = document.createElement('textarea');
        input.className = 'edit';
        return input;
    }
}
class PopupEditor {
    constructor(data) {
        this.data = data;
        this.created = false;
        this.background = document.createElement('div');
        this.title = document.createElement('h2');
        this.edit_button = document.createElement('button');
        this.src = null;
        this.editing = false;
    }
    create() {
        this.background.className = 'edit_background';
        this.background.onclick = (event) => this.hide(event);
        let aligner = AddC(this.background, 'span');
        aligner.className = 'edit_helper';
        let container = AddC(this.background, 'div');
        container.className = 'edit_container';
        container.onclick = (event) => event.stopPropagation();
        container.appendChild(this.title);
        let table = AddC(container, 'table');
        table.className = 'edit_table';
        this.makeRows(table);
        let buttons_tr = AddC(table, 'tr');
        let edit_td = AddC(buttons_tr, 'td');
        this.edit_button = edit_td.appendChild(this.edit_button);
        this.edit_button.className = 'edit';
        this.edit_button.onclick = (event) => {
            event.stopPropagation();
            this.startEditingOrSave();
        };
        edit_td.className = 'label';
        let close_td = AddC(buttons_tr, 'td');
        let close_button = AddC(close_td, 'button');
        close_button.className = 'generic';
        close_button.onclick = (event) => this.hide(event);
        AddT(close_button, kEditLang.close);
        document.body.appendChild(this.background);
        this.created = true;
    }
    show(src) {
        if (!this.created) {
            this.create();
        }
        this.background.style.display = 'block';
        this.editing = false;
        SetText(this.edit_button, kEditLang.edit);
        this.edit_button.className = 'edit';
        this.src = src;
        src.registerObserver(this);
        this.update();
    }
    hide(event) {
        if (this.src === null) {
            throw "src cannot be null";
        }
        event.stopPropagation();
        this.src.unregisterObserver(this);
        this.src = null;
        this.background.style.display = 'none';
    }
    startEditingOrSave() {
        if (this.editing) {
            SetText(this.edit_button, kEditLang.edit);
            this.edit_button.className = 'edit';
            this.editing = false;
            this.save();
        }
        else {
            SetText(this.edit_button, kEditLang.save);
            this.edit_button.className = 'add';
            this.editing = true;
            this.startEditing();
        }
    }
}
class VineyardEditor extends PopupEditor {
    constructor(data) {
        super(data);
        this.total_count = new EditorRow(kEditLang.total_count);
        this.total_price = new EditorRow(kEditLang.total_price);
        this.name = new EditorRow(kEditLang.name);
        this.country = new DataListRow(kEditLang.country);
        this.region = new DataListRow(kEditLang.region);
        this.website = new WebsiteRow(kEditLang.website);
        this.address = new EditorRow(kEditLang.address);
        this.maps_link = new MapsRow();
        this.comment = new CommentRow(kEditLang.comment);
    }
    makeRows(table) {
        table.appendChild(this.total_count.tr);
        table.appendChild(this.total_price.tr);
        table.appendChild(this.name.tr);
        table.appendChild(this.country.tr);
        table.appendChild(this.region.tr);
        table.appendChild(this.website.tr);
        table.appendChild(this.address.tr);
        table.appendChild(this.maps_link.tr);
        table.appendChild(this.comment.tr);
        this.country.getInput().onchange = () => {
            let c = this.country.getInput().value;
            PopulateDataList(this.region.list, this.data.geo_cache.getRegions(c));
        };
        this.region.getInput().onchange = () => {
            let c = this.country.getInput().value;
            if (c)
                return;
            let r = this.region.getInput().value;
            let country_guess = this.data.geo_cache.getCountry(r);
            if (country_guess)
                this.country.getInput().value = country_guess;
        };
    }
    update() {
        let vineyard = this.src;
        SetText(this.title, kEditLang.vineyard + ' ' + vineyard.data.name);
        let total_count = 0;
        let total_price = 0;
        vineyard.iterateYears((y) => {
            let count = y.data.count;
            total_count += count;
            total_price += count * y.data.price;
        });
        this.total_count.update(total_count.toString());
        this.total_price.update(FormatPrice(total_price));
        this.maps_link.update(vineyard.data.name);
        if (this.editing)
            return; // Don't interfere with the user.
        this.name.update(vineyard.data.name);
        this.country.update(vineyard.data.country);
        this.region.update(vineyard.data.region);
        this.website.update(vineyard.data.website);
        this.address.update(vineyard.data.address);
        this.comment.update(vineyard.data.comment);
    }
    startEditing() {
        this.name.startEditing();
        this.country.startEditing();
        this.region.startEditing();
        this.website.startEditing();
        this.address.startEditing();
        this.comment.startEditing();
        this.editing = true;
        PopulateDataList(this.country.list, this.data.geo_cache.getCountries());
        PopulateDataList(this.region.list, this.data.geo_cache.getAllRegions());
    }
    save() {
        let new_name = this.name.stopEditing();
        let new_country = this.country.stopEditing();
        let new_region = this.region.stopEditing();
        let new_website = this.website.stopEditing();
        let new_address = this.address.stopEditing();
        let new_comment = this.comment.stopEditing();
        this.src.saveEdits(new_name, new_country, new_region, new_website, new_address, new_comment);
        this.data.geo_cache.insertPair(new_country, new_region);
    }
}
class WineEditor extends PopupEditor {
    constructor(data) {
        super(data);
        this.vineyard = new EditorRow(kEditLang.vineyard);
        this.name = new EditorRow(kEditLang.name);
        this.grape = new DataListRow(kEditLang.grape);
        this.comment = new CommentRow(kEditLang.comment);
    }
    makeRows(table) {
        table.appendChild(this.vineyard.tr);
        table.appendChild(this.name.tr);
        table.appendChild(this.grape.tr);
        table.appendChild(this.comment.tr);
    }
    update() {
        let wine = this.src;
        SetText(this.title, wine.data.name);
        this.vineyard.update(wine.vineyard.data.name);
        if (this.editing)
            return; // Don't interfere with the user.
        this.name.update(wine.data.name);
        this.grape.update(wine.data.grape);
        this.comment.update(wine.data.comment);
    }
    startEditing() {
        this.name.startEditing();
        this.grape.startEditing();
        this.comment.startEditing();
        PopulateDataList(this.grape.list, this.data.grape_cache.getGrapes());
    }
    save() {
        let new_name = this.name.stopEditing();
        let new_grape = this.grape.stopEditing();
        let new_comment = this.comment.stopEditing();
        this.src.saveEdits(new_name, new_grape, new_comment);
    }
}
//# sourceMappingURL=vineyard-edit.js.map