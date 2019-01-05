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

function ReplaceTextWithInput(parent) {
  var input = document.createElement("input");
  input.value = parent.textContent.trim();
  parent.replaceChild(input, parent.firstChild);
  return input;
}

function ReplaceInputWithText(parent) {
  var input = parent.firstChild;
  var value = input.value;
  var text = document.createTextNode(value);
  parent.replaceChild(text, input);
  return value;
}
