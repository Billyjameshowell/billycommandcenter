/**
 * Client-side filter + sort for the inventory index.
 * Operates on both the desktop table rows and the mobile cards via shared
 * data-* attributes. No rebuild required.
 */
(function () {
  var STORAGE_KEY = "bcc-inventory";
  var panel = document.querySelector("[data-inventory]");
  if (!panel) return;

  var filterButtons = panel.querySelectorAll("[data-filter]");
  var sortButtons = panel.querySelectorAll("[data-sort]");
  var clearSortBtn = panel.querySelector("[data-sort-clear]");
  var countEl = panel.querySelector("[data-count]");
  var tbody = panel.querySelector("[data-rows]");
  var cards = panel.querySelector("[data-cards]");
  var items = Array.prototype.slice.call(panel.querySelectorAll("[data-item]"));

  var state = { filter: "all", sort: "", dir: "" };

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      if (typeof saved.filter === "string") state.filter = saved.filter;
      if (typeof saved.sort === "string") state.sort = saved.sort;
      if (typeof saved.dir === "string") state.dir = saved.dir;
    } catch (err) {
      /* ignore bad storage */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* ignore quota / private mode */
    }
  }

  function attr(el, key) {
    return (el.getAttribute("data-" + key) || "").toLowerCase();
  }

  function compare(a, b) {
    if (!state.sort) {
      return Number(a.getAttribute("data-index") || 0) - Number(b.getAttribute("data-index") || 0);
    }
    var av = attr(a, state.sort);
    var bv = attr(b, state.sort);
    var cmp;
    if (state.sort === "title") {
      cmp = av.localeCompare(bv);
    } else if (!av && !bv) {
      cmp = 0;
    } else if (!av) {
      cmp = 1;
    } else if (!bv) {
      cmp = -1;
    } else {
      cmp = av.localeCompare(bv);
    }
    return state.dir === "desc" ? -cmp : cmp;
  }

  function applyFilter() {
    var seen = Object.create(null);
    var visible = 0;
    items.forEach(function (el) {
      var match = state.filter === "all" || el.getAttribute("data-status") === state.filter;
      el.classList.toggle("is-out", !match);
      if (!match) return;
      var slug = el.getAttribute("data-slug") || "";
      if (seen[slug]) return;
      seen[slug] = true;
      visible += 1;
    });
    if (countEl) countEl.textContent = String(visible);
    filterButtons.forEach(function (btn) {
      var on = btn.getAttribute("data-filter") === state.filter;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function sortParent(parent) {
    if (!parent) return;
    var kids = Array.prototype.slice.call(parent.children);
    kids.sort(compare);
    kids.forEach(function (el) {
      parent.appendChild(el);
    });
  }

  function applySort() {
    sortButtons.forEach(function (btn) {
      var key = btn.getAttribute("data-sort");
      var on = Boolean(state.sort) && key === state.sort;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      var dirEl = btn.querySelector("[data-sort-dir]");
      if (!dirEl) return;
      if (!on) {
        dirEl.textContent = "";
      } else if (key === "title") {
        dirEl.textContent = state.dir === "asc" ? "A–Z" : "Z–A";
      } else {
        dirEl.textContent = state.dir === "desc" ? "newest" : "oldest";
      }
    });
    if (clearSortBtn) clearSortBtn.hidden = !state.sort;
    sortParent(tbody);
    sortParent(cards);
  }

  function apply() {
    applySort();
    applyFilter();
    save();
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.filter = btn.getAttribute("data-filter") || "all";
      apply();
    });
  });

  sortButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-sort");
      var defaultDir = key === "title" ? "asc" : "desc";
      if (state.sort === key) {
        state.dir = state.dir === "asc" ? "desc" : "asc";
      } else {
        state.sort = key;
        state.dir = defaultDir;
      }
      apply();
    });
  });

  if (clearSortBtn) {
    clearSortBtn.addEventListener("click", function () {
      state.sort = "";
      state.dir = "";
      apply();
    });
  }

  load();
  apply();
})();
