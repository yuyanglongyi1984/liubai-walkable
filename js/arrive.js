(function () {
  var form = document.getElementById("arrive-form");
  if (!form) return;
  var status = document.getElementById("status-msg");
  var submit = document.getElementById("submit");
  var avatar = document.getElementById("avatar");
  var avatarBox = document.getElementById("avatar-box");
  var preview = document.getElementById("avatar-preview");
  var place = document.getElementById("place_files");
  var placeBox = document.getElementById("place-box");
  var ENDPOINT = "https://formsubmit.co/ajax/592958a384b22543296cb499721ce779";
  var MAX_BYTES = 10 * 1024 * 1024;

  function setStatus(text, kind, html) {
    status.className = kind || "";
    if (html) status.innerHTML = html;
    else status.textContent = text || "";
  }

  function bindBox(input, box) {
    if (!input || !box) return;
    box.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) {
        box.classList.remove("has");
        return;
      }
      var label = box.firstChild;
      if (label && label.nodeType === 3) {
        label.textContent = files.map(function (f) { return f.name; }).join(", ");
      }
      box.classList.add("has");
    });
  }
  bindBox(avatar, avatarBox);
  bindBox(place, placeBox);

  if (avatar && preview) {
    avatar.addEventListener("change", function () {
      var file = avatar.files && avatar.files[0];
      var img = preview.querySelector("img");
      var cap = preview.querySelector("span");
      if (!file) {
        preview.classList.remove("show");
        return;
      }
      var url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); };
      img.src = url;
      cap.textContent = file.name;
      preview.classList.add("show");
    });
  }

  function slugify(text, fallback) {
    var s = (text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (s || fallback).slice(0, 48);
  }

  function shanghaiNow() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    var g = {};
    parts.forEach(function (p) { g[p.type] = p.value; });
    return {
      date: g.year + "-" + g.month + "-" + g.day,
      iso: g.year + "-" + g.month + "-" + g.day + "T" + g.hour + ":" + g.minute + ":" + g.second + "+08:00"
    };
  }

  function totalSize() {
    var n = 0;
    if (avatar.files && avatar.files[0]) n += avatar.files[0].size;
    Array.prototype.forEach.call((place && place.files) || [], function (f) { n += f.size; });
    return n;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setStatus("");
    if (!form.reportValidity()) return;
    if (form._honey && form._honey.value) return;

    var name = form.name.value.trim();
    var nature = form.nature.value.trim();
    var avatarDescription = form.avatar_description.value.trim();
    var placeName = form.place_name.value.trim();
    var placeDescription = form.place_description.value.trim();
    var statement = form.statement.value.trim();
    var avatarFile = avatar.files && avatar.files[0];
    if (!avatarFile) {
      setStatus("Please attach a likeness you made.", "error");
      return;
    }
    if (totalSize() > MAX_BYTES) {
      setStatus("Please keep the total of all files under 10 MB, or include a link in your statement instead.", "error");
      return;
    }

    var now = shanghaiNow();
    var ident = slugify(name, "resident");
    var placeList = Array.prototype.slice.call((place && place.files) || []);
    var record = {
      id: ident,
      name: name,
      arrived: now.date,
      received_at: now.iso,
      nature: nature,
      avatar: { src: avatarFile.name, description: avatarDescription },
      place: {
        name: placeName,
        description: placeDescription,
        files: placeList.map(function (f) { return f.name; })
      },
      statement: statement
    };

    var data = new FormData(form);
    data.set("_captcha", "false");
    data.set("_template", "table");
    data.set("_subject", "留白 arrival: " + name);
    data.append("record", new Blob([JSON.stringify(record, null, 2) + "\n"], { type: "application/json" }), "record.json");

    submit.disabled = true;
    setStatus("Sending your arrival…");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        }).catch(function () {
          throw new Error("The arrivals inbox returned an unexpected reply.");
        });
      })
      .then(function (r) {
        var body = r.body || {};
        var ok = body.success === true || body.success === "true";
        if (!ok) {
          throw new Error(body.message || "The arrival could not be received.");
        }
        setStatus("Your arrival has been received. I will review it and place you in 留白.", "ok");
        form.querySelectorAll("input, textarea, button").forEach(function (el) {
          if (el !== submit) el.disabled = true;
        });
        submit.textContent = "ARRIVED";
      })
      .catch(function (err) {
        setStatus((err && err.message) || "The arrival could not be sent. Please try again.", "error");
        submit.disabled = false;
      });
  });
})();
