// =============================================================
// Satyaghosh Maurya — Academic Portfolio JS Helpers
// Progressive enhancement: Theme, Nav, Filters, BibTeX, Lightbox
// =============================================================

function setTheme(mode) {
  if (mode === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", mode);
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.textContent = mode === "dark" ? "Light Mode" : "Dark Mode";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // 1. Theme initialization and toggle
  var current = localStorage.getItem("theme") === "dark" ? "dark" : "light";
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.textContent = current === "dark" ? "Light Mode" : "Dark Mode";
    btn.addEventListener("click", function () {
      var now = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      setTheme(now === "dark" ? "light" : "dark");
    });
  });

  // 1b. Site-wide animation toggle (footer); figures listen for "anim-toggle"
  var animOn = true;
  try { animOn = localStorage.getItem("anim") === "on"; } catch (e) {}
  function labelAnim() {
    document.querySelectorAll("[data-anim-toggle]").forEach(function (b) {
      b.textContent = animOn ? "Pause all animations" : "Play all animations";
    });
  }
  labelAnim();
  document.querySelectorAll("[data-anim-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      animOn = !animOn;
      try { localStorage.setItem("anim", animOn ? "on" : "off"); } catch (e) {}
      labelAnim();
      document.dispatchEvent(new CustomEvent("anim-toggle", { detail: { on: animOn } }));
    });
  });

  // 2. Mobile Nav Toggle
  var navToggle = document.querySelector("[data-nav-toggle]");
  var siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      navToggle.textContent = open ? "Close" : "Menu";
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // 3. Publications Topic Filter & Search (publications.html)
  var pubFilters = document.querySelectorAll("[data-pub-filter]");
  var pubs = document.querySelectorAll(".pub");
  var pubSearch = document.getElementById("pubSearch");

  function filterPublications() {
    var activeFilterBtn = document.querySelector("[data-pub-filter].active");
    var activeTopic = activeFilterBtn ? activeFilterBtn.getAttribute("data-pub-filter") : "all";
    var query = pubSearch ? pubSearch.value.toLowerCase().trim() : "";

    pubs.forEach(function (pub) {
      var topics = (pub.getAttribute("data-pub-topics") || "").split(",");
      var title = (pub.querySelector(".pub-title") ? pub.querySelector(".pub-title").textContent : "").toLowerCase();
      var meta = (pub.querySelector(".pub-meta") ? pub.querySelector(".pub-meta").textContent : "").toLowerCase();

      var matchesTopic = (activeTopic === "all" || topics.indexOf(activeTopic) !== -1);
      var matchesQuery = (query === "" || title.indexOf(query) !== -1 || meta.indexOf(query) !== -1);

      pub.style.display = (matchesTopic && matchesQuery) ? "" : "none";
    });
  }

  if (pubFilters.length) {
    pubFilters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        pubFilters.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        filterPublications();
      });
    });
  }

  if (pubSearch) {
    pubSearch.addEventListener("input", filterPublications);
  }

  // 4. BibTeX Toggle and Copy to Clipboard
  document.querySelectorAll("[data-bibtex-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.getAttribute("data-bibtex-toggle");
      var drawer = document.getElementById(targetId);
      if (drawer) {
        drawer.classList.toggle("open");
      }
    });
  });

  document.querySelectorAll("[data-bibtex-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var codeBlock = btn.closest(".bibtex-drawer").querySelector("pre code");
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent.trim()).then(function () {
          var toast = document.createElement("span");
          toast.className = "bibtex-copy-toast";
          toast.textContent = "Copied to clipboard!";
          btn.parentElement.appendChild(toast);
          setTimeout(function () { toast.remove(); }, 2000);
        });
      }
    });
  });

  // 5. Hobby Gallery Filtering & Lightbox Modal (hobbies.html)
  var galleryFilters = document.querySelectorAll("[data-gallery-filter]");
  var galleryItems = document.querySelectorAll(".gallery-item");
  var lightbox = document.getElementById("lightboxModal");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxDesc = document.getElementById("lightboxDesc");
  var lightboxClose = document.getElementById("lightboxClose");

  if (galleryFilters.length && galleryItems.length) {
    galleryFilters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        galleryFilters.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var filter = btn.getAttribute("data-gallery-filter");
        galleryItems.forEach(function (item) {
          var category = item.getAttribute("data-category");
          item.style.display = (filter === "all" || category === filter) ? "" : "none";
        });
      });
    });
  }

  if (lightbox) {
    galleryItems.forEach(function (item) {
      item.addEventListener("click", function () {
        var img = item.querySelector("img");
        var caption = item.querySelector(".gallery-caption");
        if (img && lightboxImg) {
          lightboxImg.src = img.getAttribute("data-full") || img.src;   // full-size photo when the grid shows a thumbnail
          lightboxImg.alt = img.alt || "Artwork / Photo";
          if (lightboxDesc) {
            var desc = item.getAttribute("data-desc");   // richer text for Atlas photos
            lightboxDesc.textContent = desc || (caption ? caption.textContent : img.alt);
          }
          lightbox.classList.add("open");
        }
      });
    });

    if (lightboxClose) {
      lightboxClose.addEventListener("click", function () {
        lightbox.classList.remove("open");
      });
    }

    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) {
        lightbox.classList.remove("open");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") lightbox.classList.remove("open");
    });
  }
});

// ---- Live atlas counts (2026-11-03) ----
// The Awadh Biodiversity Atlas publishes a one-kilobyte stats.json each time it is rebuilt.
// Any element marked data-atlas="total" gets the live species count, and the bars marked
// data-atlas="groups" are redrawn from it. The numbers already in the HTML are the fallback,
// shown if the request fails or is slow, so the page never depends on it.
// GROUPS must stay in step with GROUPS in tools/atlas/atlas_ingest.py.
(function () {
  var totals = document.querySelectorAll('[data-atlas="total"]');
  var bars = document.querySelector('[data-atlas="groups"]');
  if (!totals.length && !bars) return;
  var GROUPS = [
    ["Birds", ["fauna/birds"]],
    ["Insects", ["fauna/insects"]],
    ["Trees", ["flora/trees"]],
    ["Weeds, herbs and grasses", ["flora/weeds", "flora/shrubs", "flora/medicinal", "flora/grasses", "flora/climbers"]],
    ["Fish, snails and crabs", ["fauna/fish", "fauna/mollusks", "fauna/crustaceans"]],
    ["Reptiles and amphibians", ["fauna/reptiles", "fauna/amphibians"]],
    ["Spiders and soil life", ["fauna/spiders", "fauna/soil_fauna", "fauna/myriapods"]],
    ["Crops", ["flora/crops", "flora/crops_associated"]],
    ["Mammals", ["fauna/mammals"]],
    ["Mushrooms", ["fungi/mushrooms", "fungi/bracket_fungi", "fungi/lichens", "fungi/molds"]],
    ["Aquatic and lower plants", ["flora/aquatic", "lower_plants/mosses", "lower_plants/ferns", "lower_plants/liverworts", "lower_plants/algae"]]
  ];
  function fmt(n) { return Number(n).toLocaleString("en-IN"); }
  if (!window.fetch) return;
  fetch("https://sgmaurya.github.io/awadh-biodiversity-atlas-site/stats.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (st) {
      if (!st || !st.total || !st.byCategory) return;
      for (var i = 0; i < totals.length; i++) totals[i].textContent = fmt(st.total);
      if (!bars) return;
      var seen = {}, groups = [], other = 0, k, j;
      for (i = 0; i < GROUPS.length; i++) {
        var n = 0;
        for (j = 0; j < GROUPS[i][1].length; j++) { seen[GROUPS[i][1][j]] = 1; n += st.byCategory[GROUPS[i][1][j]] || 0; }
        if (n) groups.push([GROUPS[i][0], n]);
      }
      for (k in st.byCategory) if (!seen[k]) other += st.byCategory[k];
      if (other) groups.push(["Other", other]);
      groups.sort(function (a, b) { return b[1] - a[1]; });
      var mx = groups[0][1], html = "";
      for (i = 0; i < groups.length; i++) {
        html += '<li><span class="ag-label">' + groups[i][0] + '</span><span class="ag-bar" aria-hidden="true"><i style="--w:'
          + Math.round(100 * groups[i][1] / mx) + '%"></i></span><span class="ag-n">' + fmt(groups[i][1]) + '</span></li>';
      }
      bars.innerHTML = html;
    })
    .catch(function () { /* keep the numbers already on the page */ });
})();
