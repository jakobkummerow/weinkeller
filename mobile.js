function MClickPlus(event) {
  var yearid = event.target.parentElement.parentElement.yearid;
  var reason = 1;  // "Gekauft"
  SendPost("add_bottle", MClickPlus_Callback, {yearid, reason});
}

function MClickMinus(event) {
  var yearid = event.target.parentElement.parentElement.yearid;
  var reason = 11;  // "Getrunken"
  SendPost("remove_bottle", MClickPlus_Callback, {yearid, reason});
}

function MClickPlus_Callback() {
  var update = GetResponse(this);
  var year_span = document.getElementById("wine_" + update.yearid);
  var count_span = year_span.firstChild.nextSibling;
  SetInnerText(count_span, update.count);
  var minus_button = count_span.firstChild.nextSibling.nextSibling;
  MUpdateMinusButton(minus_button, update.count);
}

function MUpdateMinusButton(minus_button, count) {
  if (count == 0) {
    minus_button.disabled = true;
  } else {
    minus_button.disabled = false;
  }
}

function MPopulateList() {
  var only_existing = 1;
  SendGet("get_all", MPopulateList_Callback, {only_existing});
}

function MPopulateList_Callback() {
  var winelist = document.getElementById("winelist");
  DropAllChildren(winelist);
  var all_wines = GetResponse(this);
  for (var vineyard in all_wines) {
    var vineyard_node = document.createElement("div");
    vineyard_node.setAttribute("class", "vineyard");
    vineyard_node.appendChild(document.createTextNode(vineyard))
    winelist.appendChild(vineyard_node);
    var vineyard_data = all_wines[vineyard];
    var wines = vineyard_data.wines;
    for (var wine in wines) {
      var wine_node = document.createElement("span");
      wine_node.setAttribute("class", "wine");
      wine_node.appendChild(document.createTextNode(wine));
      vineyard_node.appendChild(wine_node);
      var wine_data = wines[wine];
      var years = wine_data.years;
      for (var year in years) {
        var data = years[year];
        var year_node = document.createElement("span");
        year_node.setAttribute("class", "year");
        year_node.appendChild(document.createTextNode(year));
        year_node.yearid = data.wineid;
        year_node.id = "wine_" + data.wineid;
        wine_node.appendChild(year_node);
        // Count.
        var count_span = document.createElement("span");
        count_span.appendChild(document.createTextNode(data.count));
        var plus_button = document.createElement("button");
        plus_button.appendChild(document.createTextNode("+"));
        plus_button.onclick = MClickPlus;
        plus_button.setAttribute("class", "plus");
        count_span.appendChild(plus_button);
        var minus_button = document.createElement("button");
        minus_button.appendChild(document.createTextNode("−"));
        minus_button.onclick = MClickMinus;
        minus_button.setAttribute("class", "minus");
        count_span.appendChild(minus_button);
        MUpdateMinusButton(minus_button);
        year_node.appendChild(count_span);
        // Price.
        var price_span = document.createElement("span");
        price_span.appendChild(document.createTextNode(FormatPrice(data.price)));
        year_node.appendChild(price_span);
      }  // for year in years
    }  // for wine in wines
  }
}
