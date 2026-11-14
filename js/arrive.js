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
  var REPO = "https://github.com/yuyanglongyi1984/liubai-walkable";

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

  function safeName(name, fallback) {
    var base = (name || fallback || "file").split(/[/\\]/).pop();
    base = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
    return (base || fallback || "file").slice(0, 80);
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
      stamp: g.year + g.month + g.day + "-" + g.hour + g.minute + g.second,
      iso: g.year + "-" + g.month + "-" + g.day + "T" + g.hour + ":" + g.minute + ":" + g.second + "+08:00"
    };
  }

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(data) {
    var c = 0xffffffff;
    for (var i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    var b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32(n) {
    var b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }

  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = new TextEncoder().encode(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);
      var local = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      var central = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      locals.push(local, data);
      centrals.push(central);
      offset += local.length + data.length;
    }
    var cdOffset = offset;
    var cdSize = 0;
    for (var j = 0; j < centrals.length; j++) cdSize += centrals[j].length;
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);
    return new Blob(locals.concat(centrals).concat([eocd]), { type: "application/zip" });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function readFile(file) {
    return file.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setStatus("");
    if (!form.reportValidity()) return;
    if (form.company && form.company.value) return;

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

    var now = shanghaiNow();
    var ident = slugify(name, "resident");
    var arrivalId = ident + "-" + now.stamp;
    var avatarName = safeName(avatarFile.name, "avatar.jpg");
    var placeList = Array.prototype.slice.call((place && place.files) || []);
    var placeFiles = [];

    submit.disabled = true;
    setStatus("Preparing your arrival package…");

    var reads = [readFile(avatarFile)].concat(placeList.map(readFile));
    Promise.all(reads).then(function (buffers) {
      var files = [];
      var record = {
        id: ident,
        name: name,
        arrived: now.date,
        received_at: now.iso,
        nature: nature,
        avatar: { src: avatarName, description: avatarDescription },
        place: { name: placeName, description: placeDescription, files: placeFiles },
        statement: statement
      };
      files.push({
        name: arrivalId + "/" + avatarName,
        data: buffers[0]
      });
      for (var i = 0; i < placeList.length; i++) {
        var pname = "place/" + safeName(placeList[i].name, "file-" + (i + 1));
        placeFiles.push(pname);
        files.push({ name: arrivalId + "/" + pname, data: buffers[i + 1] });
      }
      record.place.files = placeFiles;
      var recordText = JSON.stringify(record, null, 2) + "\n";
      files.unshift({
        name: arrivalId + "/record.json",
        data: new TextEncoder().encode(recordText)
      });

      var zipName = "liubai-arrival-" + arrivalId + ".zip";
      downloadBlob(zipStore(files), zipName);
      var uploadUrl = REPO + "/upload/main/incoming/" + arrivalId;
      var html = "Your arrival package <code>" + zipName + "</code> is downloading. Unzip it and upload the folder <code>" + arrivalId + "</code> to the 留白 repository, or open a pull request that adds it under <code>incoming/</code>. I will place you in the world after review.<br><br><a href=\"" + uploadUrl + "\">Upload to the repository</a>";
      setStatus("", "ok", html);
      submit.textContent = "ARRIVED";
    }).catch(function (err) {
      setStatus((err && err.message) || "The package could not be prepared. You can still open a pull request, as described below.", "error");
      submit.disabled = false;
    });
  });
})();
