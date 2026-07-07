// =============================================================
// Small progressive-enhancement helpers. No framework, no build.
// =============================================================

// Dark/light theme toggle. Dark is the default (see the inline
// no-flash script in <head> of every page, which reads the same
// "theme" localStorage key before first paint).
function setTheme(mode) {
  if (mode === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", mode);
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.textContent = mode === "light" ? "Dark mode" : "Light mode";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var current = localStorage.getItem("theme") === "light" ? "light" : "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.textContent = current === "light" ? "Dark mode" : "Light mode";
    btn.addEventListener("click", function () {
      var now = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      setTheme(now === "light" ? "dark" : "light");
    });
  });

  // Mobile nav toggle (menu button in the top bar on small screens)
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector(".mobile-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      toggle.textContent = nav.classList.contains("open") ? "Close" : "Menu";
    });
  }

  // Publications topic filter (only present on publications.html)
  var filterButtons = document.querySelectorAll("[data-pub-filter]");
  var pubs = document.querySelectorAll("[data-pub-topics]");
  if (filterButtons.length && pubs.length) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterButtons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var topic = btn.getAttribute("data-pub-filter");
        pubs.forEach(function (pub) {
          var topics = pub.getAttribute("data-pub-topics").split(",");
          pub.style.display = (topic === "all" || topics.indexOf(topic) !== -1) ? "" : "none";
        });
      });
    });
  }
});
