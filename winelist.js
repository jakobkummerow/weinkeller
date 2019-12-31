"use strict";

// Allowed: default, count_{asc,desc}, price_{asc,desc}, rating_{asc,desc},
// year_{asc,desc}, value_{asc,desc}, sweetness_{asc,desc}, age_{asc,desc}
var g_viewmode = "default";
var g_edit_mode = false;
var g_stock_mode = false;

var kAges = {
  0: "unbekannt",
  1: "zu jung",
  2: "wird noch besser",
  3: "genau richtig",
  4: "muss weg",
  5: "zu alt",
}

var kLang = {
  checkmark: "\u2713",
  save_button_text: "\u270E",
  save_string: "Speichern",
  plus_button_text: "+",
  minus_button_text: "−",
  delete_button_text: "Lö",
}

function FormatAge(int) {
  return kAges[int];
}

function ShowOnlyExisting() {
  return document.getElementById("show_only_existing").checked ? 1 : 0;
}

function ReasonAdd() {
  return document.getElementById("default_reason_add").value;
}

function IsEditMode() {
  return g_edit_mode;
}

function IsStockMode() {
  return g_stock_mode;
}

function ClickVineyardHeader() {
  g_viewmode = "default";
  PopulateList();
}

function SetViewMode(primary, secondary) {
  if (g_viewmode === primary) {
    g_viewmode = secondary;
  } else {
    g_viewmode = primary;
  }
  PopulateList();
}

function ClickYearHeader() {
  SetViewMode("year_asc", "year_desc");
}
function ClickCountHeader() {
  SetViewMode("count_desc", "count_asc");
}
function ClickPriceHeader() {
  SetViewMode("price_asc", "price_desc");
}
function ClickRatingHeader() {
  SetViewMode("rating_desc", "rating_asc");
}
function ClickValueHeader() {
  SetViewMode("value_desc", "value_asc");
}
function ClickSweetnessHeader() {
  SetViewMode("sweetness_desc", "sweetness_asc");
}
function ClickAgeHeader() {
  SetViewMode("age_asc", "age_desc");
}

function ClickPlus(event) {
  var yearid = event.target.parentElement.parentElement.year_id;
  if (IsStockMode()) {
    SendPost("add_stock", ClickPlus_Callback, {yearid});
  } else {
    var reason = document.getElementById("default_reason_add").value;
    SendPost("add_bottle", ClickPlus_Callback, {yearid, reason});
  }
}

function ClickMinus(event) {
  var yearid = event.target.parentElement.parentElement.year_id;
  if (IsStockMode()) {
    SendPost("remove_stock", ClickPlus_Callback, {yearid})
  } else {
    var reason = document.getElementById("default_reason_delete").value;
    SendPost("remove_bottle", ClickPlus_Callback, {yearid, reason});
  }
}

function ClickDelete(event) {
  var year_id = event.target.parentElement.parentElement.year_id;
  if (!confirm("Diesen Wein (samt Preis, Kommentar, Bewertung) löschen?")) {
    return;
  }
  SendPost("delete_year", PopulateList, {year_id});
}

function UpdateMinusButton(minus_button, count, opt_real_count) {
  if (IsStockMode()) {
    SetInnerText(minus_button, kLang.minus_button_text);
    if (count === 0) {
      minus_button.disabled = true;
    } else {
      minus_button.disabled = false;
      minus_button.onclick = ClickMinus;
    }
    var td = minus_button.parentNode;
    if (opt_real_count !== undefined) {
      minus_button.real_count = opt_real_count;
      var real_count = document.createTextNode(" (" + opt_real_count + ")");
      if (minus_button.nextSibling === null) {
        td.appendChild(real_count);
      } else {
        td.replaceChild(real_count, minus_button.nextSibling);
      }
    }
    if (minus_button.real_count === count) {
      td.setAttribute("class", "");
    } else {
      td.setAttribute("class", "highlight");
    }
  } else {
    minus_button.disabled = false;
    if (count === 0) {
      minus_button.onclick = ClickDelete;
      SetInnerText(minus_button, kLang.delete_button_text)
    } else {
      minus_button.onclick = ClickMinus;
      SetInnerText(minus_button, kLang.minus_button_text);
    }
  }
}

function ClickPlus_Callback() {
  var update = GetResponse(this);
  var tr = document.getElementById("year_" + update.yearid);
  // vineyard -> wine -> year -> count
  var td = tr.firstChild.nextSibling.nextSibling.nextSibling;
  var minus_button = td.firstChild.nextSibling.nextSibling;
  var count = IsStockMode() ? update.stock : update.count;
  SetInnerText(td, count);
  UpdateMinusButton(minus_button, count);
  if (!IsStockMode()) {
    PopulateLog();
    UpdateTotals();
  }
}

function ClickEdit(event) {
  SetInnerText(event.target, kLang.save_string);
  event.target.onclick = ClickSave;
  var td_comment = event.target.parentElement.previousSibling;
  ReplaceTextWithInput(td_comment, 0, KeyUp);
  var td_price = td_comment.previousSibling;
  ReplaceTextWithInput(td_price, 4, KeyUp);
}

function KeyUp(event) {
  if (event.key === "Enter") {
    var e = event.target.parentElement.nextSibling;
    while (e.firstChild.nodeName !== "BUTTON") e = e.nextSibling;
    ClickSaveButton(e.firstChild, true);
    event.preventDefault();
  } else if (event.key === "Escape") {
    var e = event.target.parentElement.nextSibling;
    while (e.firstChild.nodeName !== "BUTTON") e = e.nextSibling;
    ClickSaveButton(e.firstChild, false);
    event.preventDefault();
  }
}

function ClickSave(event) {
  ClickSaveButton(event.target, true);
}

function ClickSaveButton(button, actually_save) {
  SetInnerText(button, kLang.save_button_text);
  button.onclick = ClickEdit;
  var year_id = button.parentElement.parentElement.year_id;
  var td_comment = button.parentElement.previousSibling;
  var td_price = td_comment.previousSibling;
  if (actually_save) {
    var comment = ReplaceInputWithText(td_comment);
    var price = ParsePrice(ReplaceInputWithText(td_price));
    SendPost("update", null, {year_id, price, comment});
  } else {
    ReplaceInputWithText(td_comment, true);
    ReplaceInputWithText(td_price, true);
  }
}

function ClickApplyYear(event) {
  var yearid = event.target.parentNode.parentNode.year_id;
  SendPost("apply_stock", ApplyStock_Callback, {yearid});
}

function ClickApplyWine(event) {
  event.stopPropagation();
  var wineid = event.target.parentNode.wine_id;
  SendPost("apply_stock_wine", ApplyStockWine_Callback, {wineid});
}

function ClickApplyVineyard(event) {
  event.stopPropagation();
  var vineyard_id = event.target.parentNode.vineyard_id;
  SendPost("apply_stock_vineyard", ApplyStockWine_Callback, {vineyard_id});
}

function ClickApplyAll(event) {
  if (!confirm("Dies überschreibt den Bestand aller Weine mit den " +
               "Inventur-Daten. Sicher?")) {
    return;
  }
  SendPost("apply_stock_all", ApplyStockWine_Callback);
}

function ClickResetAllStock(event) {
  if (!confirm("Dies setzt alle Inventur-Daten auf 0 zurück. Sicher?")) {
    return;
  }
  SendPost("reset_stock_all", ResetAllStock_Callback)
}

function ApplyStock(year_id, count) {
  var tr = document.getElementById("year_" + year_id);
  var count_td = tr.firstChild.nextSibling.nextSibling.nextSibling;
  SetInnerText(count_td, count);
  var minus_button = count_td.firstChild.nextSibling.nextSibling;
  UpdateMinusButton(minus_button, count, count);
}

function ApplyStock_Callback() {
  var data = GetResponse(this);
  ApplyStock(data.yearid, data.count);
}

function ApplyStockWine_Callback() {
  var data = GetResponse(this);
  for (var year_id in data) {
    var count = data[year_id].count;
    ApplyStock(year_id, count);
  }
}

function ResetAllStock_Callback() {
  var winelist = document.getElementById("winelist");
  for (var tr = winelist.firstChild; tr !== null; tr = tr.nextSibling) {
    var count_td = tr.firstChild.nextSibling.nextSibling.nextSibling;
    SetInnerText(count_td, 0)
    var minus_button = count_td.firstChild.nextSibling.nextSibling;
    UpdateMinusButton(minus_button, 0);
  }
}

function ToggleShowExisting() {
  PopulateList();
}

function ToggleEditMode() {
  let checkbox = document.getElementById("edit_mode");
  g_edit_mode = checkbox.checked;
  let container = checkbox.parentNode.parentNode;
  if (IsEditMode()) {
    container.setAttribute("class", "setting checked");
  } else {
    container.setAttribute("class", "setting");
  }
  PopulateList();
}

function ToggleStockMode() {
  let checkbox = document.getElementById("stock_mode");
  g_stock_mode = checkbox.checked;
  let container = checkbox.parentNode.parentNode;
  let controls = document.getElementById("stock_mode_controls");
  if (IsStockMode()) {
    container.setAttribute("class", "setting checked");
    controls.style.display = "block";
  } else {
    container.setAttribute("class", "setting");
    controls.style.display = "none";
  }
  PopulateList();
}

function CollectFields(wine_td, obj) {
  var year_td = wine_td.nextSibling;
  var count_td = year_td.nextSibling;
  var price_td = count_td.nextSibling;
  var comment_td = price_td.nextSibling;
  obj.year = year_td.firstChild.value;
  obj.count = count_td.firstChild.value;
  obj.price = ParsePrice(price_td.firstChild.value);
  obj.comment = comment_td.firstChild.value;
  obj.reason = ReasonAdd();
  obj.only_existing = ShowOnlyExisting();
}

function ClickAddYear(event) {
  var tr = event.target.parentNode.parentNode;
  var wine_id = tr.wine_id;
  var vineyard_td = tr.firstChild;
  var wine_td = vineyard_td.nextSibling;
  var options = {wine_id};
  CollectFields(wine_td, options);
  SendPost("add_year", PopulateList_Callback, options);
}

function ClickAddWine(event) {
  var tr = event.target.parentNode.parentNode;
  var vineyard_id = tr.vineyard_id;
  var vineyard_td = tr.firstChild;
  var wine_td = vineyard_td.nextSibling;
  var wine = wine_td.firstChild.value;
  var options = {vineyard_id, wine};
  CollectFields(wine_td, options);
  SendPost("add_wine", PopulateList_Callback, options);
}

function ClickRating(event) {
  return ClickRatingGeneric(event, "rating");
}
function ClickValue(event) {
  return ClickRatingGeneric(event, "value");
}
function ClickSweetness(event) {
  return ClickRatingGeneric(event, "sweetness");
}
function ClickRatingGeneric(event, what) {
  var input = event.target.previousSibling;
  input.checked = true;
  var val = input.value;
  // label -> fieldset -> td -> tr
  var tr = event.target.parentNode.parentNode.parentNode;
  var year_id = tr.year_id;
  SendPost("update_rating", null, {year_id, what, val});
}

function ClickAge(event) {
  var select = event.target;
  var td = select.parentElement;
  var tr = td.parentElement;
  if (td !== tr.lastChild) console.log("Error: age must be last child of tr");
  var year_id = tr.year_id;
  var val = select.value;
  var what = "age";
  SendPost("update_rating", AgeChange_Callback, {year_id, what, val});
}

function AgeChange_Callback() {
  var data = GetResponse(this);
  var tr = document.getElementById("year_" + data.yearid);
  var td = tr.lastChild;
  SetInnerText(td, FormatAge(data.age));
}

function PopulateList() {
  var only_existing = ShowOnlyExisting();
  if (g_viewmode === "default") {
    SendGet("get_all", PopulateList_Callback, {only_existing});
  } else {
    var sortby = g_viewmode;
    SendGet("get_sorted", PopulateList_Sorted, {only_existing, sortby});
  }
}

function MaybeAddApplyButton(td, callback) {
  if (!IsStockMode()) return;
  var apply_button = document.createElement("button");
  apply_button.appendChild(document.createTextNode(kLang.checkmark));
  apply_button.onclick = callback;
  apply_button.setAttribute("class", "apply");
  td.appendChild(apply_button);
}

function MakeVineyardTd(name, vineyard_id, region) {
  var td = document.createElement("td");
  if (name) {
    td.appendChild(document.createTextNode(name));
    td.onclick = ShowVineyardEdit;
    td.vineyard_id = vineyard_id;
    td.setAttribute("class", "vineyard");
    td.setAttribute("title", region);
    td.id = "vineyard_" + vineyard_id;
    MaybeAddApplyButton(td, ClickApplyVineyard);
  }
  return td;
}

function MakeWineTd(name, wine_id, grape) {
  var td = document.createElement("td");
  if (name) {
    td.appendChild(document.createTextNode(name));
    td.onclick = ShowWineEdit;
    td.wine_id = wine_id;
    td.setAttribute("class", "wine");
    td.setAttribute("title", grape);
    td.id = "wine_" + wine_id;
    MaybeAddApplyButton(td, ClickApplyWine);
  }
  return td;
}

function MakeYearTd(year) {
  var td = document.createElement("td");
  td.appendChild(document.createTextNode(year));
  MaybeAddApplyButton(td, ClickApplyYear);
  return td;
}

function MakeCountTd(count, real_count) {
  var td = document.createElement("td");
  td.appendChild(document.createTextNode(count));
  var plus_button = document.createElement("button");
  plus_button.appendChild(document.createTextNode(kLang.plus_button_text));
  plus_button.onclick = ClickPlus;
  plus_button.setAttribute("class", "plus");
  td.appendChild(plus_button);
  var minus_button = document.createElement("button");
  td.appendChild(minus_button);
  minus_button.appendChild(document.createTextNode(""));  // For replacing.
  UpdateMinusButton(minus_button, count, real_count);
  minus_button.setAttribute("class", "minus");
  return td;
}

function MakeButtonsTd() {
  var td = document.createElement("td");
  var button_edit = document.createElement("button");
  button_edit.onclick = ClickEdit;
  button_edit.appendChild(document.createTextNode(kLang.save_button_text));
  button_edit.setAttribute("class", "edit");
  td.appendChild(button_edit);
  return td;
}

function MakeRatingTd(year_id, current) {
  var labels = ["Herausragend", "Sehr gut", "Solide", "Mäßig", "Schlecht"];
  return MakeGenericRatingTd(labels, "rating", ClickRating, year_id, current);
}

function MakeValueTd(year_id, current) {
  var labels = ["Herausragend", "Sehr gut", "Solide", "Mäßig", "Schlecht"];
  return MakeGenericRatingTd(labels, "value", ClickValue, year_id, current);
}

function MakeSweetnessTd(year_id, current) {
  var labels = ["Dessertwein", "feinherb", "fruchtig", "trocken", "sauer"];
  return MakeGenericRatingTd(labels, "sweetness", ClickSweetness, year_id,
                             current);
}

function MakeGenericRatingTd(labels, radioname, callback, id, current) {
  var td = document.createElement("td");
  var fieldset = document.createElement("fieldset");
  fieldset.setAttribute("class", "rating");
  var count = labels.length;
  for (var i = 0; i < count; i++) {
    var input = document.createElement("input");
    var name = radioname + id;
    var input_id = name + i;
    input.id = input_id;
    input.type = "radio";
    input.name = name;
    input.value = (count - i);
    if (current === (count - i)) input.checked = true;
    if (i === 0) input.setAttribute("class", "fivestar");
    var label = document.createElement("label");
    label.for = input_id;
    label.title = labels[i];
    label.onclick = callback;
    fieldset.appendChild(input);
    fieldset.appendChild(label);
  }
  td.appendChild(fieldset);
  return td;
}

function MakeAgeTd(current) {
  var td = document.createElement("td");
  td.appendChild(document.createTextNode(FormatAge(current)));
  var age_select = document.createElement("select");
  age_select.setAttribute("class", "reason");
  age_select.onchange = ClickAge;
  for (var i in kAges) {
    var option = document.createElement("option");
    option.value = i;
    option.appendChild(document.createTextNode(FormatAge(i)));
    if (i == current) option.setAttribute("selected", true);
    age_select.appendChild(option);
  }
  td.appendChild(age_select);
  return td;
}

function AppendEditModeRow(edit_mode, winelist, what, parent_id) {
  if (!edit_mode) return;
  var tr = document.createElement("tr");
  AppendTextTd(tr, "");  // Vineyard.
  var callback;
  if (what === "year") {
    tr.wine_id = parent_id;
    callback = ClickAddYear;
    AppendTextTd(tr, "");  // Wine.
  } else {
    tr.vineyard_id = parent_id;
    callback = ClickAddWine;
    AppendInputTd(tr, "neuer Wein");
  }
  AppendInputTd(tr, "Jahr", 4);
  AppendInputTd(tr, "Anzahl", 8);
  AppendInputTd(tr, "Preis", 4);
  AppendInputTd(tr, "Kommentar");
  var button_td = document.createElement("td");
  var button_add = document.createElement("button");
  button_add.appendChild(document.createTextNode(kLang.checkmark));
  button_add.setAttribute("class", "add");
  button_add.onclick = callback;
  button_td.appendChild(button_add);
  tr.appendChild(button_td);
  winelist.appendChild(tr);
}

function PopulateList_Callback() {
  var winelist = document.getElementById("winelist");
  DropAllChildren(winelist);
  var edit_mode = IsEditMode();
  var all_wines = GetResponse(this);
  for (var vineyard in all_wines) {
    var first_wine = true;
    var vineyard_data = all_wines[vineyard];
    var wines = vineyard_data.wines;
    for (var wine in wines) {
      var first_year = true;
      var wine_data = wines[wine];
      var years = wine_data.years;
      for (var year in years) {
        var data = years[year];
        var tr = document.createElement("tr");
        tr.id = "year_" + data.year_id;
        tr.year_id = data.year_id;
        // Vineyard.
        if (first_wine) {
          tr.appendChild(
              MakeVineyardTd(vineyard, vineyard_data.id, vineyard_data.region));
        } else {
          tr.appendChild(MakeVineyardTd(null, null, null));
        }
        // Wine.
        if (first_year) {
          tr.appendChild(MakeWineTd(wine, wine_data.id, wine_data.grape));
        } else {
          tr.appendChild(MakeWineTd(null, null, null));
        }
        // Year.
        tr.appendChild(MakeYearTd(year));
        // Count.
        let count = IsStockMode() ? data.stock : data.count;
        tr.appendChild(MakeCountTd(count, data.count));
        // Price, comment.
        AppendTextTd(tr, FormatPrice(data.price));
        AppendTextTd(tr, data.comment);
        // Buttons.
        tr.appendChild(MakeButtonsTd());
        // Ratings.
        tr.appendChild(MakeRatingTd(data.year_id, data.rating));
        tr.appendChild(MakeValueTd(data.year_id, data.value));
        tr.appendChild(MakeSweetnessTd(data.year_id, data.sweetness));
        tr.appendChild(MakeAgeTd(data.age));

        winelist.appendChild(tr);
        first_wine = false;
        first_year = false;
      }  // for year in years
      AppendEditModeRow(edit_mode, winelist, "year", wine_data.id);
    }  // for wine in wines
    AppendEditModeRow(edit_mode, winelist, "wine", vineyard_data.id);
  }
  PopulateVineyards();
  PopulateLog();
  UpdateTotals();
}

function PopulateList_Sorted() {
  var winelist = document.getElementById("winelist");
  DropAllChildren(winelist);
  var response = GetResponse(this);
  for (var wine of response) {
    var tr = document.createElement("tr");
    tr.id = "year_" + wine.year_id;
    tr.year_id = wine.year_id;
    // Vineyard.
    tr.appendChild(MakeVineyardTd(wine.vineyard_name, wine.vineyard_id,
                                  wine.region));
    // Wine.
    tr.appendChild(MakeWineTd(wine.wine_name, wine.wine_id, wine.grape));
    // Year.
    tr.appendChild(MakeYearTd(wine.year));
    // Count, price, comment.
    let count = IsStockMode() ? wine.stock : wine.count;
    tr.appendChild(MakeCountTd(count, wine.count));
    AppendTextTd(tr, FormatPrice(wine.price));
    AppendTextTd(tr, wine.comment);
    // Buttons.
    tr.appendChild(MakeButtonsTd());
    // Ratings.
    tr.appendChild(MakeRatingTd(wine.year_id, wine.rating));
    tr.appendChild(MakeValueTd(wine.year_id, wine.value));
    tr.appendChild(MakeSweetnessTd(wine.year_id, wine.sweetness));
    tr.appendChild(MakeAgeTd(wine.age));
    winelist.append(tr);
  }
}

function UpdateVineyard() {
  var update = GetResponse(this);
  var td = document.getElementById("vineyard_" + update.id);
  SetInnerText(td, update.name);
  td.setAttribute("title", update.region);
}

function UpdateWine() {
  var update = GetResponse(this);
  var td = document.getElementById("wine_" + update.id);
  SetInnerText(td, update.name);
  td.setAttribute("title", update.grape);
}

function AddWine() {
  var vineyard_input = document.getElementById("add_vineyard");
  var wine_input = document.getElementById("add_wine");
  var year_input = document.getElementById("add_year");
  var count_input = document.getElementById("add_count");
  var price_input = document.getElementById("add_price");
  var comment_input = document.getElementById("add_comment");
  var data = {
    vineyard: vineyard_input.value,
    wine: wine_input.value,
    year: year_input.value,
    count: count_input.value,
    price: ParsePrice(price_input.value),
    comment: comment_input.value,
    reason: ReasonAdd(),
    only_existing: ShowOnlyExisting()
  };
  SendPost("add_all", PopulateList_Callback, data);
  vineyard_input.value = "";
  wine_input.value = "";
  year_input.value = "";
  count_input.value = "";
  price_input.value = "";
  comment_input.value = "";
}

function PopulateDataList(datalist, options) {
  DropAllChildren(datalist);
  for (var o of options) {
    var option = document.createElement("option");
    option.value = o;
    datalist.appendChild(option);
  }
}

function PopulateVineyards() {
  SendGet("get_vineyards", PopulateVineyards_Callback);
}

function PopulateVineyards_Callback() {
  var vineyards_list = document.getElementById("vineyards_completions");
  PopulateDataList(vineyards_list, GetResponse(this));
}

function PopulateWines() {
  var vineyard = document.getElementById("add_vineyard").value;
  if (!vineyard) return;
  DropAllChildren(document.getElementById("wines_completions"));
  SendGet("get_wines", PopulateWines_Callback, {vineyard: vineyard});
}

function PopulateWines_Callback() {
  var wines_list = document.getElementById("wines_completions");
  PopulateDataList(wines_list, GetResponse(this));
}

function UpdateTotals() {
  SendGet("get_totals", UpdateTotals_Callback);
}

function UpdateTotals_Callback() {
  var data = GetResponse(this);
  var count = document.getElementById("total_count");
  SetInnerText(count, data.count);
  var price = document.getElementById("total_price");
  SetInnerText(price, FormatPrice(data.price));
}
