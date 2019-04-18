"use strict";

function FormatPrice(double) {
  if (double === 0) return "";
  return double.toLocaleString(
      "de", {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

function ParsePrice(string) {
  return string.replace(",", ".");
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

function ClickPlus_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var update = JSON.parse(response);
  var tr = document.getElementById("wine_" + update.wineid);
  var td = tr.firstChild.nextSibling.nextSibling.nextSibling;
  td.replaceChild(document.createTextNode(update.count), td.firstChild);
  PopulateLog();
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

function ClickAddYear(event) {
  var tr = event.target.parentNode.parentNode;
  var wine_id = tr.wineid;
  var vineyard_td = tr.firstChild;
  var wine_td = vineyard_td.nextSibling;
  var year_td = wine_td.nextSibling;
  var count_td = year_td.nextSibling;
  var price_td = count_td.nextSibling;
  var comment_td = price_td.nextSibling;
  var year = year_td.firstChild.value;
  var count = count_td.firstChild.value;
  var price = ParsePrice(price_td.firstChild.value);
  var comment = comment_td.firstChild.value;
  var reason = ReasonAdd();
  var only_existing = ShowOnlyExisting();
  SendPost("add_year", PopulateList_Callback,
           {wine_id, year, count, price, comment, reason, only_existing});
}

function ClickAddWine(event) {
  var tr = event.target.parentNode.parentNode;
  var vineyard_id = tr.vineyard_id;
  var vineyard_td = tr.firstChild;
  var wine_td = vineyard_td.nextSibling;
  var year_td = wine_td.nextSibling;
  var count_td = year_td.nextSibling;
  var price_td = count_td.nextSibling;
  var comment_td = price_td.nextSibling;
  var wine = wine_td.firstChild.value;
  var year = year_td.firstChild.value;
  var count = count_td.firstChild.value;
  var price = ParsePrice(price_td.firstChild.value);
  var comment = comment_td.firstChild.value;
  var reason = ReasonAdd();
  var only_existing = ShowOnlyExisting();
  SendPost(
      "add_wine", PopulateList_Callback,
      {vineyard_id, wine, year, count, price, comment, reason, only_existing});
}

function PopulateList() {
  var only_existing = ShowOnlyExisting();
  SendGet("get_all", PopulateList_Callback, {only_existing});
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
      for (var year in years) {
        var data = years[year];
        var tr = document.createElement("tr");
        tr.id = "wine_" + data.wineid;
        tr.wineid = data.wineid;
        // Vineyard.
        var td_vineyard = document.createElement("td");
        if (first_wine) {
          td_vineyard.appendChild(document.createTextNode(vineyard));
          td_vineyard.onclick = ShowVineyardEdit;
          td_vineyard.vineyard_id = vineyard_data.id;
          td_vineyard.setAttribute("class", "vineyard");
          td_vineyard.setAttribute("title", vineyard_data.region);
        }
        tr.appendChild(td_vineyard);
        // Wine.
        var td_wine = document.createElement("td");
        if (first_year) {
          td_wine.appendChild(document.createTextNode(wine));
          td_wine.onclick = ShowWineEdit;
          td_wine.wine_id = wine_data.id;
          td_wine.setAttribute("class", "wine");
          td_wine.setAttribute("title", wine_data.grape);
        }
        tr.appendChild(td_wine);
        // Year.
        AppendTextTd(tr, year);
        // Count.
        var td_count = AppendTextTd(tr, data.count);
        var plus_button = document.createElement("button");
        plus_button.appendChild(document.createTextNode("+"));
        plus_button.onclick = ClickPlus;
        plus_button.setAttribute("class", "plus");
        td_count.appendChild(plus_button);
        var minus_button = document.createElement("button");
        minus_button.appendChild(document.createTextNode("–"));
        minus_button.onclick = ClickMinus;
        minus_button.setAttribute("class", "minus");
        td_count.appendChild(minus_button);
        // Price, comment.
        AppendTextTd(tr, FormatPrice(data.price));
        AppendTextTd(tr, data.comment);
        // Buttons.
        var td_buttons = document.createElement("td");
        var button_edit = document.createElement("button");
        button_edit.onclick = ClickEdit;
        button_edit.appendChild(document.createTextNode("Bearbeiten"));
        button_edit.setAttribute("class", "edit");
        td_buttons.appendChild(button_edit);
        tr.appendChild(td_buttons);
        winelist.appendChild(tr);
        first_wine = false;
        first_year = false;
      }  // for year in years
      if (edit_mode) {
        var tr = document.createElement("tr");
        tr.wineid = wine_data.id;
        AppendTextTd(tr, "");  // Vineyard.
        AppendTextTd(tr, "");  // Wine.
        AppendInputTd(tr, "neues Jahr");
        AppendInputTd(tr, "Anzahl");
        AppendInputTd(tr, "Preis");
        AppendInputTd(tr, "Kommentar");
        var button_td = document.createElement("td");
        var button_add = document.createElement("button");
        button_add.appendChild(document.createTextNode("Hinzufügen"));
        button_add.setAttribute("class", "add");
        button_add.onclick = ClickAddYear;
        button_td.appendChild(button_add);
        tr.appendChild(button_td);
        winelist.appendChild(tr);
      }  // edit_mode (years)
    }  // for wine in wines
    if (edit_mode) {
      var tr = document.createElement("tr");
      tr.vineyard_id = vineyard_data.id;
      AppendTextTd(tr, "");  // Vineyard.
      AppendInputTd(tr, "neuer Wein");
      AppendInputTd(tr, "Jahr");
      AppendInputTd(tr, "Anzahl");
      AppendInputTd(tr, "Preis");
      AppendInputTd(tr, "Kommentar");
      var button_td = document.createElement("td");
      var button_add = document.createElement("button");
      button_add.appendChild(document.createTextNode("Hinzufügen"));
      button_add.setAttribute("class", "add");
      button_add.onclick = ClickAddWine;
      button_td.appendChild(button_add);
      tr.appendChild(button_td);
      winelist.appendChild(tr);
    }  // edit_mode (wines)
  }
  PopulateVineyards();
  PopulateLog();
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
