"use strict";

function DropAllChildren(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function AppendTextTd(tr, text) {
  var td = document.createElement("td");
  td.appendChild(document.createTextNode(text));
  tr.appendChild(td);
  return td;
}

function AppendInputTd(tr, placeholder, size) {
  var td = document.createElement("td");
  var input = document.createElement("input");
  input.setAttribute("class", "edit");
  input.setAttribute("placeholder", placeholder);
  if (size) input.setAttribute("size", size);
  td.appendChild(input);
  tr.appendChild(td);
}

function Serialize(obj) {
  var str = [];
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  }
  return str.join("&");
}

function SendPost(endpoint, callback, data) {
  var xhr = new XMLHttpRequest();
  xhr.onload = callback;
  xhr.open("POST", endpoint, true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.send(Serialize(data));
}

function SendGet(endpoint, callback, data = null) {
  var xhr = new XMLHttpRequest();
  xhr.onload = callback;
  if (data !== null) {
    endpoint += "?" + Serialize(data);
  }
  xhr.open("GET", endpoint, true);
  xhr.send();
}

function ReplaceTextWithInput(parent, size, keyup_handler) {
  var input = document.createElement("input");
  input.value = parent.textContent.trim();
  input.original_value = input.value;
  if (size) input.size = size;
  if (keyup_handler) {
    input.onkeyup = keyup_handler;
  }
  parent.replaceChild(input, parent.firstChild);
  return input;
}

function ReplaceInputWithText(parent, restore_previous = false) {
  var input = parent.firstChild;
  var value = restore_previous ? input.original_value : input.value;
  var text = document.createTextNode(value);
  parent.replaceChild(text, input);
  return value;
}

function FormatPrice(double) {
  if (double === 0) return "";
  return double.toLocaleString(
      "de", {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

function ParsePrice(string) {
  return string.replace(",", ".");
}
