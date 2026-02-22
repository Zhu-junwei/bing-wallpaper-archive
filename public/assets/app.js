const DATA_FILE = "./Bing_zh-CN_all.json";
const BING_HOST = "https://www.bing.com";
const PAGE_SIZE = 36;
const MIN_DATE = "20200101";
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const MONTH_JUMP_BATCH = 120;
const ALL_YEARS_VALUE = "";

const galleryEl = document.getElementById("gallery");
const monthNavEl = document.getElementById("monthNav");
const templateEl = document.getElementById("cardTemplate");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const searchInput = document.getElementById("searchInput");
const yearFilter = document.getElementById("yearFilter");
const sortOrder = document.getElementById("sortOrder");
const randomBtn = document.getElementById("randomBtn");

const heroImage = document.getElementById("heroImage");
const heroDate = document.getElementById("heroDate");
const heroTitle = document.getElementById("heroTitle");
const heroCopyright = document.getElementById("heroCopyright");
const heroUhd = document.getElementById("heroUhd");
const heroHd = document.getElementById("heroHd");
const heroLink = document.getElementById("heroLink");

const totalCountEl = document.getElementById("totalCount");
const latestDateEl = document.getElementById("latestDate");

const viewerEl = document.getElementById("viewer");
const viewerBackdropEl = document.getElementById("viewerBackdrop");
const viewerStageEl = document.getElementById("viewerStage");
const viewerLowImageEl = document.getElementById("viewerLowImage");
const viewerHighImageEl = document.getElementById("viewerHighImage");
const viewerUpgradeFxEl = document.getElementById("viewerUpgradeFx");
const viewerHdBtn = document.getElementById("viewerHdBtn");
const viewerUhdBtn = document.getElementById("viewerUhdBtn");
const viewerPrevBtn = document.getElementById("viewerPrevBtn");
const viewerNextBtn = document.getElementById("viewerNextBtn");
const viewerMetaDateEl = document.getElementById("viewerMetaDate");
const viewerMetaTitleEl = document.getElementById("viewerMetaTitle");
const viewerMetaCopyrightEl = document.getElementById("viewerMetaCopyright");

let allItems = [];
let filteredItems = [];
let renderedCount = 0;
let monthStartIndexMap = new Map();
let searchTimer = null;
let heroItem = null;

let viewerIndex = -1;
let viewerResolution = "hd";
let viewerOriginImage = null;
let viewerCloseTimer = null;
let viewerAnimTimer = null;
let viewerQualityTimer = null;
let viewerPromoteTimer = null;
let viewerLoadToken = 0;
const imageLoadState = new Map();
let availableYears = [];
let userSelectedYear = "";
let searchingAllYears = false;

function formatDate(enddate) {
  if (!/^\d{8}$/.test(enddate || "")) {
    return enddate || "--";
  }
  return `${enddate.slice(0, 4)}-${enddate.slice(4, 6)}-${enddate.slice(6, 8)}`;
}

function safeText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function toAbsolute(path) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${BING_HOST}${path}`;
}

function setQueryValue(path, key, value) {
  const pattern = new RegExp(`([?&])${key}=\\d+`);
  if (pattern.test(path)) {
    return path.replace(pattern, `$1${key}=${value}`);
  }
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${key}=${value}`;
}

function buildPreviewPath(path) {
  if (!path) {
    return "";
  }
  let next = path;
  next = setQueryValue(next, "w", PREVIEW_WIDTH);
  next = setQueryValue(next, "h", PREVIEW_HEIGHT);
  return next;
}

function normalize(item) {
  const enddate = safeText(item.enddate, "");
  const hdPath = safeText(item.url, "");
  const previewPath = buildPreviewPath(hdPath);
  const hdUrl = toAbsolute(hdPath);
  const previewUrl = toAbsolute(previewPath);
  const uhdUrl = item.urlbase ? toAbsolute(`${item.urlbase}_UHD.jpg`) : hdUrl;
  return {
    enddate,
    year: enddate.slice(0, 4),
    month: enddate.slice(0, 6),
    dateLabel: formatDate(enddate),
    title: safeText(item.title, "Bing Wallpaper"),
    copyright: safeText(item.copyright, "No copyright text"),
    copyrightlink: safeText(item.copyrightlink, ""),
    hdUrl,
    uhdUrl,
    thumbUrl: previewUrl || hdUrl
  };
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function getViewerRatio() {
  if (viewerHighImageEl.naturalWidth && viewerHighImageEl.naturalHeight) {
    return viewerHighImageEl.naturalWidth / viewerHighImageEl.naturalHeight;
  }
  if (viewerLowImageEl.naturalWidth && viewerLowImageEl.naturalHeight) {
    return viewerLowImageEl.naturalWidth / viewerLowImageEl.naturalHeight;
  }
  return 16 / 9;
}

function getZoomTargetRect() {
  const ratio = getViewerRatio();
  const maxWidth = window.innerWidth * 0.92;
  const maxHeight = window.innerHeight * 0.92;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return {
    top: (window.innerHeight - height) / 2,
    left: (window.innerWidth - width) / 2,
    width,
    height
  };
}

function applyViewerRect(rect) {
  viewerStageEl.style.top = `${rect.top}px`;
  viewerStageEl.style.left = `${rect.left}px`;
  viewerStageEl.style.width = `${rect.width}px`;
  viewerStageEl.style.height = `${rect.height}px`;
}

function getItemImageElement(index) {
  return galleryEl.querySelector(`.card[data-index="${index}"] img`);
}

function updateViewerResButtons() {
  viewerHdBtn.classList.toggle("active", viewerResolution === "hd");
  viewerUhdBtn.classList.toggle("active", viewerResolution === "uhd");
}

function updateViewerNavButtons() {
  const canPrev = viewerIndex > 0;
  const canNext = viewerIndex >= 0 && viewerIndex < filteredItems.length - 1;
  viewerPrevBtn.disabled = !canPrev;
  viewerNextBtn.disabled = !canNext;
}

function runViewerSlide(direction) {
  clearTimeout(viewerAnimTimer);
  viewerEl.classList.remove("slide-next", "slide-prev");
  if (!direction) {
    return;
  }
  viewerEl.classList.add(direction === "next" ? "slide-next" : "slide-prev");
  viewerAnimTimer = setTimeout(() => {
    viewerEl.classList.remove("slide-next", "slide-prev");
  }, 160);
}

function getViewerSrc(item) {
  return viewerResolution === "uhd" ? item.uhdUrl : item.hdUrl;
}

function markImageLoaded(src) {
  if (!src) {
    return;
  }
  imageLoadState.set(src, { state: "loaded" });
}

function isImageLoaded(src) {
  if (!src) {
    return false;
  }
  const cached = imageLoadState.get(src);
  return Boolean(cached && cached.state === "loaded");
}

function isImageReady(src) {
  if (!src) {
    return false;
  }
  if (isImageLoaded(src)) {
    return true;
  }
  const probe = new Image();
  probe.decoding = "async";
  probe.src = src;
  if (probe.complete && probe.naturalWidth > 0) {
    markImageLoaded(src);
    return true;
  }
  return false;
}

function preloadImage(src) {
  if (!src) {
    return Promise.reject(new Error("empty src"));
  }
  if (isImageLoaded(src)) {
    return Promise.resolve(src);
  }
  const existing = imageLoadState.get(src);
  if (existing && existing.promise) {
    return existing.promise;
  }
  const loader = new Image();
  loader.decoding = "async";
  const promise = new Promise((resolve, reject) => {
    loader.onload = () => {
      markImageLoaded(src);
      resolve(src);
    };
    loader.onerror = reject;
  });
  imageLoadState.set(src, { state: "loading", promise });
  loader.src = src;
  return promise;
}

function setViewerLowImage(src, item) {
  if (!src) {
    return;
  }
  viewerLowImageEl.src = src;
  viewerLowImageEl.alt = `${item.title} ${item.dateLabel}`;
}

function updateViewerMeta(item) {
  if (!item) {
    viewerMetaDateEl.textContent = "--";
    viewerMetaTitleEl.textContent = "";
    viewerMetaCopyrightEl.textContent = "";
    return;
  }
  viewerMetaDateEl.textContent = item.dateLabel;
  viewerMetaTitleEl.textContent = item.title;
  viewerMetaCopyrightEl.textContent = item.copyright;
}

function preloadViewerNeighbors(centerIndex) {
  if (centerIndex < 0 || !filteredItems.length) {
    return;
  }
  const indexes = [centerIndex - 1, centerIndex + 1];
  for (const index of indexes) {
    if (index < 0 || index >= filteredItems.length) {
      continue;
    }
    const target = getViewerSrc(filteredItems[index]);
    preloadImage(target).catch(() => {
      // Ignore prefetch failures to avoid interrupting browsing.
    });
  }
}

function resetViewerHighLayer() {
  viewerHighImageEl.classList.remove("reveal");
  viewerHighImageEl.removeAttribute("src");
  viewerHighImageEl.alt = "";
  viewerUpgradeFxEl.classList.remove("active");
}

function loadViewerHighImage(item, token) {
  const src = getViewerSrc(item);
  preloadImage(src)
    .then(() => {
      if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
        return;
      }
      viewerHighImageEl.src = src;
      viewerHighImageEl.alt = `${item.title} ${item.dateLabel}`;
      void viewerHighImageEl.offsetWidth;
      viewerHighImageEl.classList.add("reveal");
      viewerUpgradeFxEl.classList.remove("active");
      void viewerUpgradeFxEl.offsetWidth;
      viewerUpgradeFxEl.classList.add("active");

      clearTimeout(viewerPromoteTimer);
      viewerPromoteTimer = setTimeout(() => {
        if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
          return;
        }
        const currentItem = filteredItems[viewerIndex];
        if (!currentItem || currentItem.enddate !== item.enddate) {
          return;
        }
        // After the paint-like reveal, replace the base layer with final quality.
        setViewerLowImage(src, item);
        resetViewerHighLayer();
      }, 620);
    })
    .catch(() => {
      if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
        return;
      }
      if (!viewerLowImageEl.getAttribute("src") && item.thumbUrl) {
        setViewerLowImage(item.thumbUrl, item);
      }
    });
}

function ensureViewerBaseImage(item, preferredSrc, token) {
  if (isImageReady(preferredSrc)) {
    setViewerLowImage(preferredSrc, item);
    return true;
  }

  const fallback = item.hdUrl || item.thumbUrl || preferredSrc;
  if (!fallback) {
    return false;
  }

  const hasVisibleImage = viewerLowImageEl.hasAttribute("src");
  if (!hasVisibleImage || isImageReady(fallback)) {
    setViewerLowImage(fallback, item);
  } else {
    preloadImage(fallback)
      .then(() => {
        if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
          return;
        }
        const currentItem = filteredItems[viewerIndex];
        if (!currentItem || currentItem.enddate !== item.enddate) {
          return;
        }
        setViewerLowImage(fallback, item);
      })
      .catch(() => {
        if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
          return;
        }
        if (!viewerLowImageEl.getAttribute("src") && preferredSrc) {
          setViewerLowImage(preferredSrc, item);
        }
      });
  }
  return false;
}

function showViewerItem(index, direction, options = {}) {
  if (!filteredItems.length) {
    return;
  }
  viewerIndex = clamp(index, 0, filteredItems.length - 1);
  const token = ++viewerLoadToken;
  const item = filteredItems[viewerIndex];
  const preferredSrc = getViewerSrc(item);
  runViewerSlide(direction);

  let hasPreferredReady = false;
  if (options.keepCurrentBase && viewerLowImageEl.getAttribute("src")) {
    viewerLowImageEl.alt = `${item.title} ${item.dateLabel}`;
    if (isImageReady(preferredSrc)) {
      setViewerLowImage(preferredSrc, item);
      hasPreferredReady = true;
    }
  } else {
    hasPreferredReady = ensureViewerBaseImage(item, preferredSrc, token);
  }
  resetViewerHighLayer();
  if (!hasPreferredReady) {
    loadViewerHighImage(item, token);
  }
  updateViewerMeta(item);
  updateViewerResButtons();
  updateViewerNavButtons();
  preloadViewerNeighbors(viewerIndex);

  const currentCardImage = getItemImageElement(viewerIndex);
  if (currentCardImage) {
    viewerOriginImage = currentCardImage;
  }
}

function closeViewer() {
  if (viewerEl.hidden) {
    return;
  }
  viewerLoadToken += 1;
  const origin = viewerOriginImage && document.body.contains(viewerOriginImage)
    ? viewerOriginImage.getBoundingClientRect()
    : null;
  viewerEl.classList.remove("open", "slide-next", "slide-prev", "quality-switch");
  if (origin) {
    applyViewerRect(origin);
  }
  clearTimeout(viewerCloseTimer);
  clearTimeout(viewerQualityTimer);
  clearTimeout(viewerPromoteTimer);
  viewerCloseTimer = setTimeout(() => {
    viewerEl.hidden = true;
    document.body.style.overflow = "";
    viewerLowImageEl.removeAttribute("src");
    resetViewerHighLayer();
  }, 340);
}

function openViewerAtIndex(index, sourceImage) {
  if (!filteredItems.length || index < 0 || index >= filteredItems.length || !sourceImage) {
    return;
  }
  clearTimeout(viewerCloseTimer);
  viewerOriginImage = sourceImage;
  viewerResolution = "hd";
  viewerIndex = index;
  const startRect = sourceImage.getBoundingClientRect();
  viewerEl.hidden = false;
  viewerEl.classList.remove("open", "slide-next", "slide-prev", "quality-switch");
  document.body.style.overflow = "hidden";
  applyViewerRect(startRect);
  showViewerItem(viewerIndex, null);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      applyViewerRect(getZoomTargetRect());
      viewerEl.classList.add("open");
    });
  });
}

function switchViewerResolution(next) {
  if (viewerEl.hidden || (next !== "hd" && next !== "uhd")) {
    return;
  }
  if (viewerResolution === next) {
    return;
  }
  viewerResolution = next;
  viewerEl.classList.add("quality-switch");
  clearTimeout(viewerQualityTimer);
  viewerQualityTimer = setTimeout(() => {
    viewerEl.classList.remove("quality-switch");
  }, 620);
  showViewerItem(viewerIndex, null, { keepCurrentBase: true });
}

function goViewerNext() {
  if (viewerIndex >= filteredItems.length - 1) {
    return;
  }
  showViewerItem(viewerIndex + 1, "next");
}

function goViewerPrev() {
  if (viewerIndex <= 0) {
    return;
  }
  showViewerItem(viewerIndex - 1, "prev");
}

function renderHero(item) {
  heroItem = item || null;
  if (!item) {
    heroDate.textContent = "--";
    heroTitle.textContent = "未找到结果";
    heroCopyright.textContent = "请尝试调整筛选条件。";
    heroImage.removeAttribute("src");
    return;
  }
  heroDate.textContent = item.dateLabel;
  heroTitle.textContent = item.title;
  heroCopyright.textContent = item.copyright;
  heroImage.src = item.thumbUrl;
  heroImage.alt = `${item.title} ${item.dateLabel}`;
  heroUhd.href = item.uhdUrl || "#";
  heroHd.href = item.hdUrl || "#";
  heroLink.href = item.copyrightlink || "https://www.bing.com";
}

function cardFromItem(item, index) {
  const fragment = templateEl.content.cloneNode(true);
  const card = fragment.querySelector(".card");
  const img = fragment.querySelector("img");
  const date = fragment.querySelector(".card-date");
  const title = fragment.querySelector(".card-title");
  const copyright = fragment.querySelector(".card-copyright");
  const uhd = fragment.querySelector(".card-uhd");
  const hd = fragment.querySelector(".card-hd");
  const link = fragment.querySelector(".card-link");

  card.dataset.index = String(index);
  card.dataset.month = item.month;
  card.style.setProperty("--index", String(index));
  img.src = item.thumbUrl;
  img.alt = `${item.title} ${item.dateLabel}`;
  img.addEventListener("click", () => openViewerAtIndex(index, img));
  date.textContent = item.dateLabel;
  title.textContent = item.title;
  copyright.textContent = item.copyright;
  uhd.href = item.uhdUrl || "#";
  hd.href = item.hdUrl || "#";
  link.href = item.copyrightlink || "https://www.bing.com";
  return fragment;
}

function updateStats() {
  totalCountEl.textContent = `总数: ${allItems.length}`;
  latestDateEl.textContent = `最近更新: ${allItems[0] ? allItems[0].dateLabel : "--"}`;
}

function appendRange(start, end) {
  if (start >= end) {
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i += 1) {
    fragment.appendChild(cardFromItem(filteredItems[i], i));
  }
  galleryEl.appendChild(fragment);
}

function refreshLoadMoreVisibility() {
  loadMoreBtn.hidden = renderedCount >= filteredItems.length;
}

function renderChunk(reset = false) {
  if (reset) {
    galleryEl.innerHTML = "";
    renderedCount = 0;
  }
  if (!filteredItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的壁纸。";
    galleryEl.appendChild(empty);
    loadMoreBtn.hidden = true;
    return;
  }
  const nextEnd = Math.min(filteredItems.length, renderedCount + PAGE_SIZE);
  appendRange(renderedCount, nextEnd);
  renderedCount = nextEnd;
  refreshLoadMoreVisibility();
}

function ensureRenderedTo(targetIndex) {
  if (targetIndex < renderedCount) {
    return Promise.resolve();
  }
  const targetEnd = Math.min(filteredItems.length, targetIndex + 1);
  return new Promise((resolve) => {
    const run = () => {
      const next = Math.min(targetEnd, renderedCount + MONTH_JUMP_BATCH);
      appendRange(renderedCount, next);
      renderedCount = next;
      refreshLoadMoreVisibility();
      if (renderedCount >= targetEnd) {
        resolve();
      } else {
        requestAnimationFrame(run);
      }
    };
    run();
  });
}

function setActiveMonth(monthKey) {
  const buttons = monthNavEl.querySelectorAll(".month-btn");
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.month === monthKey);
  }
}

async function jumpToMonth(monthKey) {
  const targetIndex = monthStartIndexMap.get(monthKey);
  if (targetIndex == null) {
    return;
  }
  setActiveMonth(monthKey);
  await ensureRenderedTo(targetIndex);
  const card = galleryEl.querySelector(`.card[data-index="${targetIndex}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderMonthNav() {
  monthStartIndexMap = new Map();
  monthNavEl.innerHTML = "";
  filteredItems.forEach((item, index) => {
    if (!monthStartIndexMap.has(item.month)) {
      monthStartIndexMap.set(item.month, index);
    }
  });
  for (const monthKey of monthStartIndexMap.keys()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-btn";
    button.dataset.month = monthKey;
    button.textContent = `${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}`;
    button.addEventListener("click", () => {
      jumpToMonth(monthKey);
    });
    monthNavEl.appendChild(button);
  }
  const firstMonth = monthStartIndexMap.keys().next().value;
  if (firstMonth) {
    setActiveMonth(firstMonth);
  }
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  const sort = sortOrder.value;
  const hasKeyword = keyword.length > 0;

  if (hasKeyword) {
    if (!searchingAllYears) {
      userSelectedYear = yearFilter.value || userSelectedYear || availableYears[0] || ALL_YEARS_VALUE;
      searchingAllYears = true;
    }
    if (yearFilter.value !== ALL_YEARS_VALUE) {
      yearFilter.value = ALL_YEARS_VALUE;
    }
  } else if (searchingAllYears) {
    const restoreYear = userSelectedYear && availableYears.includes(userSelectedYear)
      ? userSelectedYear
      : (availableYears[0] || ALL_YEARS_VALUE);
    yearFilter.value = restoreYear;
    searchingAllYears = false;
  } else if (yearFilter.value && yearFilter.value !== ALL_YEARS_VALUE) {
    userSelectedYear = yearFilter.value;
  }

  const year = hasKeyword ? ALL_YEARS_VALUE : yearFilter.value;

  filteredItems = allItems.filter((item) => {
    if (year && item.year !== year) {
      return false;
    }
    if (!hasKeyword) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.copyright.toLowerCase().includes(keyword) ||
      item.enddate.includes(keyword)
    );
  });

  filteredItems.sort((a, b) => {
    if (sort === "oldest") {
      return a.enddate.localeCompare(b.enddate);
    }
    return b.enddate.localeCompare(a.enddate);
  });

  renderMonthNav();
  renderHero(filteredItems[0] || null);
  renderChunk(true);
  updateStats();
}

function initYearFilter() {
  const years = new Set(allItems.map((item) => item.year).filter(Boolean));
  const sorted = [...years].sort((a, b) => b.localeCompare(a));
  availableYears = sorted;
  yearFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = ALL_YEARS_VALUE;
  allOption.textContent = "全部年份";
  yearFilter.appendChild(allOption);
  for (const y of sorted) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearFilter.appendChild(option);
  }
  if (sorted.length) {
    yearFilter.value = sorted[0];
    userSelectedYear = sorted[0];
  } else {
    yearFilter.value = ALL_YEARS_VALUE;
    userSelectedYear = ALL_YEARS_VALUE;
  }
  searchingAllYears = false;
}

function bindEvents() {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 180);
  });
  yearFilter.addEventListener("change", () => {
    if (yearFilter.value && yearFilter.value !== ALL_YEARS_VALUE) {
      userSelectedYear = yearFilter.value;
    }
    applyFilters();
  });
  sortOrder.addEventListener("change", applyFilters);
  loadMoreBtn.addEventListener("click", () => renderChunk(false));

  randomBtn.addEventListener("click", () => {
    if (!filteredItems.length) {
      return;
    }
    const index = Math.floor(Math.random() * filteredItems.length);
    const item = filteredItems[index];
    renderHero(item);
    document.getElementById("hero").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  heroImage.addEventListener("click", () => {
    if (!heroItem) {
      return;
    }
    const index = filteredItems.findIndex((item) => item.enddate === heroItem.enddate);
    if (index >= 0) {
      openViewerAtIndex(index, heroImage);
    }
  });

  viewerBackdropEl.addEventListener("click", closeViewer);
  viewerStageEl.addEventListener("click", closeViewer);
  viewerHdBtn.addEventListener("click", () => switchViewerResolution("hd"));
  viewerUhdBtn.addEventListener("click", () => switchViewerResolution("uhd"));
  viewerPrevBtn.addEventListener("click", goViewerPrev);
  viewerNextBtn.addEventListener("click", goViewerNext);

  viewerLowImageEl.addEventListener("load", () => {
    markImageLoaded(viewerLowImageEl.currentSrc || viewerLowImageEl.src);
  });
  viewerHighImageEl.addEventListener("load", () => {
    markImageLoaded(viewerHighImageEl.currentSrc || viewerHighImageEl.src);
  });

  window.addEventListener("keydown", (event) => {
    if (viewerEl.hidden) {
      return;
    }
    if (event.key === "Escape") {
      closeViewer();
    } else if (event.key === "ArrowLeft") {
      goViewerPrev();
    } else if (event.key === "ArrowRight") {
      goViewerNext();
    }
  });

  window.addEventListener("resize", () => {
    if (!viewerEl.hidden) {
      applyViewerRect(getZoomTargetRect());
    }
  });
}

async function start() {
  bindEvents();
  try {
    const response = await fetch(DATA_FILE, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const images = Array.isArray(payload.images) ? payload.images : [];
    allItems = images
      .map(normalize)
      .filter((item) => item.thumbUrl && item.enddate >= MIN_DATE);
    allItems.sort((a, b) => b.enddate.localeCompare(a.enddate));
    initYearFilter();
    applyFilters();
  } catch (error) {
    heroDate.textContent = "--";
    heroTitle.textContent = "数据加载失败";
    heroCopyright.textContent = `请检查 ${DATA_FILE} 是否可访问。`;
    galleryEl.innerHTML = `<div class="empty">加载数据失败: ${error.message}</div>`;
    loadMoreBtn.hidden = true;
  }
}

start();
