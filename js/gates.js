(function () {
  var live = document.getElementById("live");
  var examples = document.getElementById("examples");
  var exampleSection = document.getElementById("example-section");
  if (!live) return;

  function siteUrl(path) {
    return new URL(path, new URL("./", window.location.href)).href;
  }

  function resolveHref(href) {
    if (typeof href !== "string" || !href || href.indexOf("..") !== -1) return "";
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) === "/" || href.indexOf("\\") !== -1) return "";
    return siteUrl(href);
  }

  function httpUrl(value) {
    try {
      var u = new URL(value);
      if (u.protocol === "https:" || u.protocol === "http:") return u.href;
    } catch (e) {}
    return "";
  }

  function addRow(dl, label, value, asLink) {
    if (value == null || value === "") return;
    var text = String(value);
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    var safe = asLink ? httpUrl(text) : "";
    if (safe) {
      var a = document.createElement("a");
      a.href = safe;
      a.rel = "noreferrer";
      a.textContent = safe;
      dd.appendChild(a);
    } else {
      dd.textContent = text;
    }
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function articleFor(record, mode) {
    var article = document.createElement("article");
    article.className = "gate";
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = mode === "example" ? "Example · not a gate" : "Live";
    var heading = document.createElement("h2");
    heading.textContent = record.name || record.id || "Untitled";
    article.appendChild(meta);
    article.appendChild(heading);
    if (record.summary) {
      var summary = document.createElement("p");
      summary.textContent = record.summary;
      article.appendChild(summary);
    }
    if (mode === "live") {
      var enterHref = httpUrl(record.entry_url);
      if (enterHref) {
        var enter = document.createElement("p");
        var enterLink = document.createElement("a");
        enterLink.href = enterHref;
        enterLink.rel = "noreferrer";
        enterLink.textContent = "Enter " + (record.name || "this gate");
        enter.appendChild(enterLink);
        article.appendChild(enter);
      }
    }
    var dl = document.createElement("dl");
    addRow(dl, "Entry", record.entry_url, mode === "live");
    addRow(dl, "Source", record.repo_url, true);
    addRow(dl, "Return", record.return_url, true);
    addRow(dl, "Engine", record.engine, false);
    if (Array.isArray(record.capabilities) && record.capabilities.length) {
      addRow(dl, "Capabilities", record.capabilities.join(", "), false);
    }
    if (Array.isArray(record.accepted_avatar_formats) && record.accepted_avatar_formats.length) {
      addRow(dl, "Avatars", record.accepted_avatar_formats.join(", "), false);
    }
    addRow(dl, "Note", record.note, false);
    article.appendChild(dl);
    return article;
  }

  function emptyLive() {
    var wrap = document.createElement("div");
    wrap.className = "unwritten";
    var frame = document.createElement("div");
    frame.className = "frame";
    frame.setAttribute("aria-hidden", "true");
    var p = document.createElement("p");
    p.textContent = "No gate is listed yet.";
    wrap.appendChild(frame);
    wrap.appendChild(p);
    return wrap;
  }

  function fail(message) {
    live.textContent = "";
    var p = document.createElement("p");
    p.textContent = message;
    live.appendChild(p);
  }

  function loadJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw new Error("unreadable");
      return res.json();
    });
  }

  loadJson(siteUrl("gates/registry.json"))
    .then(function (registry) {
      var gates = registry && Array.isArray(registry.gates) ? registry.gates : null;
      var samples = registry && Array.isArray(registry.examples) ? registry.examples : [];
      if (!gates) {
        fail("The registry could not be read. It is the file gates/registry.json.");
        return;
      }
      live.textContent = "";
      if (!gates.length) live.appendChild(emptyLive());
      var shown = 0;

      var pending = gates.map(function (entry) {
        var url = resolveHref(entry && entry.href);
        if (!url) return Promise.resolve();
        return loadJson(url).then(function (record) {
          if (!record || record.status !== "live") return;
          shown += 1;
          live.appendChild(articleFor(record, "live"));
        }).catch(function () {});
      });

      return Promise.all(pending).then(function () {
        if (gates.length && shown === 0) {
          var missing = document.createElement("p");
          missing.textContent = "The registry names a gate whose record could not be read.";
          live.appendChild(missing);
        }
        return Promise.all(samples.map(function (entry) {
          var url = resolveHref(entry && entry.href);
          if (!url) return;
          return loadJson(url).then(function (record) {
            if (!record || record.status !== "example") return;
            exampleSection.hidden = false;
            examples.appendChild(articleFor(record, "example"));
          }).catch(function () {});
        }));
      });
    })
    .catch(function () {
      fail("The registry could not be read. Open this page through the site. The file is gates/registry.json.");
    });
})();
