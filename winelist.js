"use strict";

// Allowed: default, count_{asc,desc}, price_{asc,desc}, rating_{asc,desc},
// year_{asc,desc}, value_{asc,desc}, sweetness_{asc,desc}, age_{asc,desc}
var g_viewmode = "default";

var kAges = {
  0: "unbekannt",
  1: "zu jung",
  2: "wird noch besser",
  3: "genau richtig",
  4: "muss weg",
  5: "zu alt",
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
  return document.getElementById("edit_mode").checked;
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
  var wineid = event.target.parentElement.parentElement.wineid;
  var reason = document.getElementById("default_reason_add").value;
  SendPost("add_bottle", ClickPlus_Callback, {wineid, reason});
}

function ClickMinus(event) {
  var wineid = event.target.parentElement.parentElement.wineid;
  var reason = document.getElementById("default_reason_delete").value;
  SendPost("remove_bottle", ClickPlus_Callback, {wineid, reason});
}

function ClickDelete(event) {
  var wineid = event.target.parentElement.parentElement.wineid;
  if (!confirm("Diesen Wein (samt Preis, Kommentar, Bewertung) löschen?")) {
    return;
  }
  SendPost("delete_year", PopulateList, {wineid});
}

function ClickPlus_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var update = JSON.parse(response);
  var tr = document.getElementById("wine_" + update.wineid);
  // vineyard -> wine -> year -> count
  var td = tr.firstChild.nextSibling.nextSibling.nextSibling;
  td.replaceChild(document.createTextNode(update.count), td.firstChild);
  PopulateLog();
  UpdateTotals();
}

function ClickEdit(event) {
  event.target.replaceChild(document.createTextNode("Speichern"),
                            event.target.firstChild);
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
  button.replaceChild(document.createTextNode("Bearbeiten"), button.firstChild);
  button.onclick = ClickEdit;
  var wineid = button.parentElement.parentElement.wineid;
  var td_comment = button.parentElement.previousSibling;
  var td_price = td_comment.previousSibling;
  if (actually_save) {
    var comment = ReplaceInputWithText(td_comment);
    var price = ParsePrice(ReplaceInputWithText(td_price));
    SendPost("update", null, {wineid, price, comment});
  } else {
    ReplaceInputWithText(td_comment, true);
    ReplaceInputWithText(td_price, true);
  }
}

function ToggleShowExisting() {
  PopulateList();
}

function ToggleEditMode() {
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
  var wine_id = tr.wineid;
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
  var wineid = tr.wineid;
  SendPost("update_rating", null, {wineid, what, val});
}

function ClickAge(event) {
  var select = event.target;
  var td = select.parentElement;
  var tr = td.parentElement;
  if (td !== tr.lastChild) console.log("Error: age must be last child of tr");
  var wineid = tr.wineid;
  var val = select.value;
  var what = "age";
  SendPost("update_rating", AgeChange_Callback, {wineid, what, val});
}

function AgeChange_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  var tr = document.getElementById("wine_" + data.yearid);
  var td = tr.lastChild;
  td.replaceChild(document.createTextNode(FormatAge(data.age)), td.firstChild);
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

function MakeVineyardTd(name, vineyard_id, region) {
  var td = document.createElement("td");
  if (name) {
    td.appendChild(document.createTextNode(name));
    td.onclick = ShowVineyardEdit;
    td.vineyard_id = vineyard_id;
    td.setAttribute("class", "vineyard");
    td.setAttribute("title", region);
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
  }
  return td;
}

function MakeCountTd(count) {
  var td = document.createElement("td");
  td.appendChild(document.createTextNode(count));
  var plus_button = document.createElement("button");
  plus_button.appendChild(document.createTextNode("+"));
  plus_button.onclick = ClickPlus;
  plus_button.setAttribute("class", "plus");
  td.appendChild(plus_button);
  var minus_button = document.createElement("button");
  var label;
  if (count > 0) {
    label = "–";
    minus_button.onclick = ClickMinus;
  } else {
    label = "Lö";
    minus_button.onclick = ClickDelete;
  }
  minus_button.appendChild(document.createTextNode(label));
  minus_button.setAttribute("class", "minus");
  td.appendChild(minus_button);
  return td;
}

function MakeButtonsTd() {
  var td = document.createElement("td");
  var button_edit = document.createElement("button");
  button_edit.onclick = ClickEdit;
  button_edit.appendChild(document.createTextNode("\u270E"));
  button_edit.setAttribute("class", "edit");
  td.appendChild(button_edit);
  return td;
}

function MakeRatingTd(wineid, current) {
  var labels = ["Herausragend", "Sehr gut", "Solide", "Mäßig", "Schlecht"];
  return MakeGenericRatingTd(labels, "rating", ClickRating, wineid, current);
}

function MakeValueTd(wineid, current) {
  var labels = ["Herausragend", "Sehr gut", "Solide", "Mäßig", "Schlecht"];
  return MakeGenericRatingTd(labels, "value", ClickValue, wineid, current);
}

function MakeSweetnessTd(wineid, current) {
  var labels = ["Dessertwein", "feinherb", "fruchtig", "trocken", "sauer"];
  return MakeGenericRatingTd(labels, "sweetness", ClickSweetness, wineid,
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
    tr.wineid = parent_id;
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
  button_add.appendChild(document.createTextNode("\u2713"));
  button_add.setAttribute("class", "add");
  button_add.onclick = callback;
  button_td.appendChild(button_add);
  tr.appendChild(button_td);
  winelist.appendChild(tr);
}

function PopulateList_Callback() {
  var winelist = document.getElementById("winelist");
  DropAllChildren(winelist);
  var response = decodeURIComponent(this.responseText);
  var edit_mode = IsEditMode();
  document.getElementById("output").innerHTML = response;
  var all_wines = JSON.parse(response);
  for (var vineyard in all_wines) {
    var first_wine = true;
    var vineyard_data = all_wines[vineyard];
    var wines = vineyard_data.wines;
    for (var wine in wines) {
      var first_year = true;
      var wine_data = wines[wine];
      var years = wine_data.years;
      var have_at_least_one_year = false;
      for (var year in years) {
        have_at_least_one_year = true;
        var data = years[year];
        var tr = document.createElement("tr");
        tr.id = "wine_" + data.wineid;
        tr.wineid = data.wineid;
        // Vineyard.
        if (first_wine) {
          tr.appendChild(MakeVineyardTd(vineyard, vineyard_data.id, vineyard_data.region));
        } else {
          tr.appendChild(MakeVineyardTd(null, null, null));
        }
        // Wine.
        var td_wine = document.createElement("td");
        if (first_year) {
          tr.appendChild(MakeWineTd(wine, wine_data.id, wine_data.grape));
        } else {
          tr.appendChild(MakeWineTd(null, null, null));
        }
        // Year.
        AppendTextTd(tr, year);
        // Count.
        tr.appendChild(MakeCountTd(data.count));
        // Price, comment.
        AppendTextTd(tr, FormatPrice(data.price));
        AppendTextTd(tr, data.comment);
        // Buttons.
        tr.appendChild(MakeButtonsTd());
        // Ratings.
        tr.appendChild(MakeRatingTd(data.wineid, data.rating));
        tr.appendChild(MakeValueTd(data.wineid, data.value));
        tr.appendChild(MakeSweetnessTd(data.wineid, data.sweetness));
        tr.appendChild(MakeAgeTd(data.age));

        winelist.appendChild(tr);
        first_wine = false;
        first_year = false;
      }  // for year in years
      if (have_at_least_one_year) {
        AppendEditModeRow(edit_mode, winelist, "year", wine_data.id);
      }
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
  var response = JSON.parse(decodeURIComponent(this.responseText));
  for (var wine of response) {
    var tr = document.createElement("tr");
    tr.id = "wine_" + wine.wineid;
    tr.wineid = wine.wineid;
    // Vineyard.
    tr.appendChild(MakeVineyardTd(wine.vineyard_name, wine.vineyard_id,
                                  wine.region));
    // Wine.
    tr.appendChild(MakeWineTd(wine.wine_name, wine.wine_id, wine.grape));
    // Year.
    AppendTextTd(tr, wine.year);
    // Count, price, comment.
    tr.appendChild(MakeCountTd(wine.count));
    AppendTextTd(tr, FormatPrice(wine.price));
    AppendTextTd(tr, wine.comment);
    // Buttons.
    tr.appendChild(MakeButtonsTd());
    // Ratings.
    tr.appendChild(MakeRatingTd(wine.wineid, wine.rating));
    tr.appendChild(MakeValueTd(wine.wineid, wine.value));
    tr.appendChild(MakeSweetnessTd(wine.wineid, wine.sweetness));
    tr.appendChild(MakeAgeTd(wine.age));
    winelist.append(tr);
  }
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
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  PopulateDataList(vineyards_list, JSON.parse(response));
}

function PopulateWines() {
  var vineyard = document.getElementById("add_vineyard").value;
  if (!vineyard) return;
  DropAllChildren(document.getElementById("wines_completions"));
  SendGet("get_wines", PopulateWines_Callback, {vineyard: vineyard});
}

function PopulateWines_Callback() {
  var wines_list = document.getElementById("wines_completions");
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  PopulateDataList(wines_list, JSON.parse(response));
}

function UpdateTotals() {
  SendGet("get_totals", UpdateTotals_Callback);
}

function UpdateTotals_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  var count = document.getElementById("total_count");
  count.replaceChild(document.createTextNode(data.count), count.firstChild);
  var price = document.getElementById("total_price");
  price.replaceChild(document.createTextNode(FormatPrice(data.price)),
                     price.firstChild);
}
