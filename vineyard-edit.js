"use strict";

var g_VineyardEdit = (function() {
  function Background() {
    return document.getElementById("vineyard_edit_background");
  }
  function Container() {
    return document.getElementById("vineyard_edit_container");
  }
  function Button_close() {
    return document.getElementById("vineyard_edit_button_close");
  }
  function Button_edit() {
    return document.getElementById("vineyard_edit_button_edit");
  }
  function Title() {
    return document.getElementById("vineyard_edit_title");
  }
  function Country() {
    return document.getElementById("vineyard_edit_country");
  }
  function Region() {
    return document.getElementById("vineyard_edit_region");
  }
  function Address() {
    return document.getElementById("vineyard_edit_address");
  }
  function Maps() {
    return document.getElementById("vineyard_edit_maps").firstChild;
  }
  function Website() {
    return document.getElementById("vineyard_edit_website");
  }
  function Comment() {
    return document.getElementById("vineyard_edit_comment");
  }

  function set_text(node, text) {
    node.replaceChild(document.createTextNode(text), node.firstChild);
  }
  function set_button_edit() {
    var button = Button_edit();
    set_text(button, "Bearbeiten");
    button.onclick = Edit;
  }
  function set_button_save() {
    var button = Button_edit();
    set_text(button, "Speichern");
    button.onclick = Save;
  }

  function Hide(event) {
    event.stopPropagation();
    Background().style.display = "none";
  }

  function CountryListCallback() {
    var response = decodeURIComponent(this.responseText);
    document.getElementById("output").innerHTML = response;
    var country_list = document.getElementById("country_list");
    PopulateDataList(country_list, JSON.parse(response));
  }

  function PopulateRegions() {
    var country = document.getElementById("vineyard_edit_countryinput").value;
    if (country === "") return;
    SendGet("regions", PopulateRegions_Callback, {country});
  }

  function PopulateRegions_Callback() {
    var response = decodeURIComponent(this.responseText);
    document.getElementById("output").innerHTML = response;
    var region_list = document.getElementById("region_list");
    PopulateDataList(region_list, JSON.parse(response));
  }

  function Edit(event) {
    event.stopPropagation();
    set_button_save();
    var country_input = ReplaceTextWithInput(Country());
    country_input.id = "vineyard_edit_countryinput";
    country_input.setAttribute("list", "country_list");
    country_input.onchange = PopulateRegions;
    var region_input = ReplaceTextWithInput(Region());
    region_input.setAttribute("list", "region_list")
    ReplaceTextWithInput(Website());
    ReplaceTextWithInput(Address());
    var comment_td = Comment();
    var comment_content = comment_td.innerHTML.replace("<br>", "\n");
    comment_td.innerHTML = "<textarea>" + comment_content + "</textarea>";
    SendGet("countries", CountryListCallback);
    PopulateRegions();
  }

  function PrependHttp(website) {
    if (website.startsWith("http")) return website;
    return "http://" + website;
  }

  function Save(event) {
    event.stopPropagation();
    set_button_edit();
    var vineyard_id = Background().vineyard_id;
    var country = ReplaceInputWithText(Country());
    var region = ReplaceInputWithText(Region());

    var td_website = Website();
    var input_website = td_website.firstChild;
    var website = input_website.value;
    var link = document.createElement("a");
    link.appendChild(document.createTextNode(website));
    link.href = PrependHttp(website);
    td_website.replaceChild(link, input_website);

    var address = ReplaceInputWithText(Address());
    var comment_td = Comment();
    var comment = comment_td.firstChild.innerHTML.replace("\n", "<br>");
    comment_td.innerHTML = comment;
    SendPost("set_vineyard", null,
             {vineyard_id, country, region, address, website, comment})
  }

  return {
    Init: function() {
      Background().onclick = Hide;
      Button_close().onclick = Hide;
      Container().onclick = function(event) {
        event.stopPropagation();
      }
    },
    Populate: function(data) {
      var box = Background();
      box.style.display = "block";
      box.vineyard_id = data.id;
      set_button_edit();
      set_text(Title(), "Weingut " + data.vineyard);
      set_text(Country(), data.country);
      set_text(Region(), data.region);
      set_text(Address(), data.address);
      var link = Website();
      link.href = PrependHttp(data.website);
      set_text(link, data.website);
      Comment().innerHTML = data.comment.replace("\n", "<br>");
      var mapslink = Maps();
      mapslink.href = "https://www.google.de/maps/search/Weingut+" +
                      encodeURIComponent(data.vineyard);
    },
  };
})();

var g_WineEdit = (function() {
  function Background() {
    return document.getElementById("wine_edit_background");
  }
  function Container() {
    return document.getElementById("wine_edit_container");
  }
  function Button_close() {
    return document.getElementById("wine_edit_button_close");
  }
  function Button_edit() {
    return document.getElementById("wine_edit_button_edit");
  }
  function Title() {
    return document.getElementById("wine_edit_title");
  }
  function Vineyard() {
    return document.getElementById("wine_edit_vineyard");
  }
  function Grape() {
    return document.getElementById("wine_edit_grape");
  }
  function Comment() {
    return document.getElementById("wine_edit_comment");
  }

  function set_text(node, text) {
    node.replaceChild(document.createTextNode(text), node.firstChild);
  }
  function set_button_edit() {
    var button = Button_edit();
    set_text(button, "Bearbeiten");
    button.onclick = Edit;
  }
  function set_button_save() {
    var button = Button_edit();
    set_text(button, "Speichern");
    button.onclick = Save;
  }

  function Hide(event) {
    event.stopPropagation();
    Background().style.display = "none";
  }

  function GrapeListCallback() {
    var response = decodeURIComponent(this.responseText);
    document.getElementById("output").innerHTML = response;
    var grape_list = document.getElementById("grape_list");
    PopulateDataList(grape_list, JSON.parse(response));
  }

  function Edit(event) {
    event.stopPropagation();
    set_button_save();
    var grape_input = ReplaceTextWithInput(Grape());
    grape_input.id = "wine_edit_countryinput";
    grape_input.setAttribute("list", "grape_list");
    var comment_td = Comment();
    var textarea = document.createElement("textarea");
    textarea.value = comment_td.innerHTML.replace("<br>", "\n");
    DropAllChildren(comment_td);
    comment_td.appendChild(textarea);
    SendGet("grapes", GrapeListCallback);
  }

  function Save(event) {
    event.stopPropagation();
    set_button_edit();
    var wine_id = Background().wine_id;
    var grape = ReplaceInputWithText(Grape());
    var comment_td = Comment();
    var comment = comment_td.firstChild.value.replace("\n", "<br>");
    comment_td.innerHTML = comment;
    SendPost("set_wine", null, {wine_id, grape, comment})
  }

  return {
    Init: function() {
      Background().onclick = Hide;
      Button_close().onclick = Hide;
      Container().onclick = function(event) {
        event.stopPropagation();
      }
    },
    Populate: function(data) {
      var box = Background();
      box.style.display = "block";
      box.wine_id = data.id;
      set_button_edit();
      set_text(Title(), data.wine);
      set_text(Vineyard(), data.vineyard);
      set_text(Grape(), data.grape);
      Comment().innerHTML = data.comment.replace("\n", "<br>");
    },
  };
})();

function ShowVineyardEdit(event) {
  var vineyard = event.target.vineyard_id;
  SendGet("vineyard_data", ShowVineyardEdit_Callback, {vineyard})
}

function ShowVineyardEdit_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  g_VineyardEdit.Populate(data);
}

function ShowWineEdit(event) {
  var wine = event.target.wine_id;
  SendGet("wine_data", ShowWineEdit_Callback, {wine});
}

function ShowWineEdit_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  g_WineEdit.Populate(data);
}

