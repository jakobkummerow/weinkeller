"use strict";

function FormatPrice(double) {
  if (double === 0) return "";
  return double.toLocaleString(
      "de", {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

function ParsePrice(string) {
  return string.replace(",", ".");
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
  td.replaceChild(document.createTextNode(update.count + " "), td.firstChild);
  PopulateLog();
}

function ClickEdit(event) {
  event.target.replaceChild(document.createTextNode("Speichern"),
                            event.target.firstChild);
  event.target.onclick = ClickSave;
  var td_comment = event.target.parentElement.previousSibling;
  ReplaceTextWithInput(td_comment);
  var td_price = td_comment.previousSibling;
  ReplaceTextWithInput(td_price);
}

function ClickSave(event) {
  event.target.replaceChild(document.createTextNode("Bearbeiten"),
                            event.target.firstChild);
  event.target.onclick = ClickEdit;
  var wineid = event.target.parentElement.parentElement.wineid;
  var td_comment = event.target.parentElement.previousSibling;
  var comment = ReplaceInputWithText(td_comment);
  var td_price = td_comment.previousSibling;
  var price = ParsePrice(ReplaceInputWithText(td_price));
  SendPost("update", null, {wineid, price, comment});
}

function PopulateList() {
  SendGet("get_all", PopulateList_Callback);
}

function PopulateList_Callback() {
  var winelist = document.getElementById("winelist");
  DropAllChildren(winelist);
  var response = decodeURIComponent(this.responseText);
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
      }
    }
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
  var reason_input = document.getElementById("default_reason_add");
  var data = {
    vineyard: vineyard_input.value,
    wine: wine_input.value,
    year: year_input.value,
    count: count_input.value,
    price: ParsePrice(price_input.value),
    comment: comment_input.value,
    reason: reason_input.value
  };
  SendPost("add_wine", PopulateList_Callback, data);
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
