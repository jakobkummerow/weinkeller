"use strict";

var kReasons = {
  0: "unbekannt",
  1: "Gekauft",
  2: "Bestand",
  3: "Geschenkt bekommen",
  11: "Getrunken",
  12: "Verschenkt",
  13: "Verlust",
}

function FormatReason(int) {
  return kReasons[int];
}

function PopulateLog() {
  SendGet("get_log", PopulateLog_Callback);
}

function IsValidReasonFor(reason, delta) {
  if (delta > 0) return reason > 0 && reason < 10;
  if (delta < 0) return reason > 10;
  return reason === 0;
}

function ReasonChange(event) {
  var reason = event.target.value;
  var td = event.target.parentNode;
  var log_id = td.id.substring("log_reason_".length);
  SendPost("update_log", ReasonChange_Callback, {log_id, reason})
}

function ReasonChange_Callback() {
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  var td = document.getElementById("log_reason_" + data.log_id);
  td.replaceChild(document.createTextNode(FormatReason(data.reason)),
                  td.firstChild);
}

function PopulateLog_Callback() {
  var log = document.getElementById("log");
  DropAllChildren(log);
  var response = decodeURIComponent(this.responseText);
  document.getElementById("output").innerHTML = response;
  var data = JSON.parse(response);
  for (var d of data) {
    var tr = document.createElement("tr");
    AppendTextTd(tr, d.date);
    AppendTextTd(tr, d.wine);
    AppendTextTd(tr, d.delta);
    // pencil: \u270F
    // notepad: \u{1F4DD}
    var td_reason = document.createElement("td");
    td_reason.id = "log_reason_" + d.log_id;
    td_reason.appendChild(document.createTextNode(FormatReason(d.reason)));
    var reason_select = document.createElement("select");
    reason_select.setAttribute("class", "reason");
    reason_select.onchange = ReasonChange;
    for (var i in kReasons) {
      if (i == d.reason || IsValidReasonFor(i, d.delta)) {
        var option = document.createElement("option");
        option.value = i;
        option.appendChild(document.createTextNode(FormatReason(i)));
        if (i == d.reason) option.selected = true;
        reason_select.appendChild(option);
      }
    }
    td_reason.appendChild(reason_select);
    tr.appendChild(td_reason);
    log.appendChild(tr);
  }
}

function PopulateDefaultReasons() {
  var add_list = document.getElementById("default_reason_add");
  var remove_list = document.getElementById("default_reason_delete");
  for (var i in kReasons) {
    var option = document.createElement("option");
    option.value = i;
    option.appendChild(document.createTextNode(FormatReason(i)));
    if (IsValidReasonFor(i, 1)) {
      add_list.appendChild(option);
    } else if (IsValidReasonFor(i, -1)) {
      remove_list.appendChild(option);
    }
  }
}

