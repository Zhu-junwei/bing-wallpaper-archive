const DATA_FILE = "./Bing_zh-CN_all.json";
const BING_HOST = "https://www.bing.com";
const PAGE_SIZE = 36;
const UHD_CUTOFF_DATE = "20190510";
const PREVIEW_WIDTH = 1024;
const PREVIEW_HEIGHT = 576;
const MONTH_JUMP_BATCH = 120;
const ALL_YEARS_VALUE = "";
const THUMB_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const UHD_SUFFIX = "_UHD.jpg";
const HD_SUFFIX = "_UHD.jpg&rf=LaDigue_UHD.jpg&pid=hp&w=1920&h=1080&rs=1&c=4";

const galleryEl = document.getElementById("gallery");
const monthNavEl = document.getElementById("monthNav");
const templateEl = document.getElementById("cardTemplate");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const searchInput = document.getElementById("searchInput");
const yearFilter = document.getElementById("yearFilter");
const sortOrder = document.getElementById("sortOrder");
const randomBtn = document.getElementById("randomBtn");
const backToTopBtn = document.getElementById("backToTopBtn");
const topbarEl = document.querySelector(".topbar");
const stickyFiltersEl = document.querySelector(".sticky-filters");

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
let viewerResolutionLoading = false;
const imageLoadState = new Map();
let thumbObserver = null;
let autoLoadObserver = null;
let availableYears = [];
let userSelectedYear = "";
let searchingAllYears = false;
let activeMonthKey = "";
let monthSyncRaf = 0;
let autoLoadCheckRaf = 0;
let chunkRenderInProgress = false;

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
  const urlPath = safeText(item.url, "");
  const urlbase = safeText(item.urlbase, "");
  const beforeUhdCutoff = enddate && enddate < UHD_CUTOFF_DATE;
  const hasUrlbase = Boolean(urlbase);
  const hasUhdInUrl = /_UHD\.jpg/i.test(urlPath);
  const hasHdParamsInUrl = /_UHD\.jpg&/i.test(urlPath);

  // Before 2019-05-10, keep legacy 1080 URL exactly as provided in JSON.
  if (beforeUhdCutoff) {
    const legacyHdUrl = toAbsolute(urlPath);
    return {
      enddate,
      year: enddate.slice(0, 4),
      month: enddate.slice(0, 6),
      dateLabel: formatDate(enddate),
      title: safeText(item.title, "Bing Wallpaper"),
      copyright: safeText(item.copyright, "No copyright text"),
      copyrightlink: safeText(item.copyrightlink, ""),
      hdUrl: legacyHdUrl,
      uhdUrl: "",
      hasUhd: false,
      thumbUrl: legacyHdUrl
    };
  }

  const uhdPath = hasUrlbase
    ? `${urlbase}${UHD_SUFFIX}`
    : (hasUhdInUrl ? urlPath.replace(/_UHD\.jpg(?:&.*)?$/i, "_UHD.jpg") : "");

  const hdPath = hasHdParamsInUrl
    ? urlPath
    : (uhdPath ? `${uhdPath}&rf=LaDigue_UHD.jpg&pid=hp&w=1920&h=1080&rs=1&c=4` : urlPath);

  const hdUrl = toAbsolute(hdPath);
  const uhdUrl = uhdPath ? toAbsolute(uhdPath) : "";
  const hasUhd = Boolean(uhdUrl);
  const thumbUrl = buildPreviewPath(hdUrl);

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
    hasUhd,
    thumbUrl
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
  const currentItem = viewerIndex >= 0 ? filteredItems[viewerIndex] : null;
  const canUhd = Boolean(currentItem && currentItem.hasUhd);
  viewerHdBtn.classList.toggle("active", viewerResolution === "hd");
  viewerUhdBtn.classList.toggle("active", viewerResolution === "uhd");
  viewerHdBtn.classList.toggle("loading", viewerResolutionLoading && viewerResolution === "hd");
  viewerUhdBtn.classList.toggle("loading", viewerResolutionLoading && viewerResolution === "uhd");
  viewerUhdBtn.disabled = !canUhd;
  viewerUhdBtn.title = canUhd ? "UHD" : "该图片仅支持1080P";
}

function setViewerResolutionLoading(isLoading) {
  viewerResolutionLoading = Boolean(isLoading);
  updateViewerResButtons();
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

function hydrateCardImage(img) {
  if (!img || !img.dataset || !img.dataset.src) {
    return;
  }
  img.src = img.dataset.src;
  img.removeAttribute("data-src");
  if (thumbObserver) {
    thumbObserver.unobserve(img);
  }
}

function observeCardImage(img) {
  if (!img || !img.dataset || !img.dataset.src) {
    return;
  }
  if (!thumbObserver) {
    hydrateCardImage(img);
    return;
  }
  thumbObserver.observe(img);
}

function initThumbObserver() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    thumbObserver = null;
    return;
  }
  thumbObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        hydrateCardImage(entry.target);
      }
    }
  }, {
    root: null,
    rootMargin: "320px 0px",
    threshold: 0.01
  });
}

function initAutoLoadObserver() {
  if (!loadMoreBtn || typeof window === "undefined" || !("IntersectionObserver" in window)) {
    autoLoadObserver = null;
    return;
  }
  autoLoadObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        scheduleAutoLoadCheck();
      }
    }
  }, {
    root: null,
    rootMargin: "420px 0px",
    threshold: 0.01
  });
  autoLoadObserver.observe(loadMoreBtn);
}

function getMonthAnchorTop() {
  const topbarBottom = topbarEl ? topbarEl.getBoundingClientRect().bottom : 0;
  const stickyBottom = stickyFiltersEl ? stickyFiltersEl.getBoundingClientRect().bottom : topbarBottom;
  return Math.max(topbarBottom, stickyBottom) + 8;
}

function getActiveMonthByScroll() {
  const monthEntries = [...monthStartIndexMap.entries()];
  if (!monthEntries.length) {
    return "";
  }

  const anchorTop = getMonthAnchorTop();
  let candidate = "";

  for (const [monthKey, startIndex] of monthEntries) {
    const card = galleryEl.querySelector(`.card[data-index="${startIndex}"]`);
    if (!card) {
      break;
    }
    const rect = card.getBoundingClientRect();
    if (rect.top <= anchorTop) {
      candidate = monthKey;
      continue;
    }
    if (!candidate) {
      candidate = monthKey;
    }
    break;
  }

  if (candidate) {
    return candidate;
  }

  const cards = galleryEl.querySelectorAll(".card[data-month]");
  if (!cards.length) {
    return "";
  }
  const lastCard = cards[cards.length - 1];
  return lastCard.dataset.month || "";
}

function syncMonthByScroll() {
  const monthKey = getActiveMonthByScroll();
  if (!monthKey) {
    return;
  }
  setActiveMonth(monthKey);
}

function scheduleMonthSync() {
  if (monthSyncRaf) {
    return;
  }
  monthSyncRaf = requestAnimationFrame(() => {
    monthSyncRaf = 0;
    syncMonthByScroll();
  });
}

function maybeAutoLoadMore() {
  if (chunkRenderInProgress || !loadMoreBtn || loadMoreBtn.hidden || renderedCount >= filteredItems.length) {
    return;
  }
  const rect = loadMoreBtn.getBoundingClientRect();
  if (rect.top <= window.innerHeight + 260) {
    renderChunk(false);
  }
}

function scheduleAutoLoadCheck() {
  if (autoLoadCheckRaf) {
    return;
  }
  autoLoadCheckRaf = requestAnimationFrame(() => {
    autoLoadCheckRaf = 0;
    maybeAutoLoadMore();
  });
}

function prioritizeMonthThumbs(monthKey, limit = 16) {
  if (!monthKey) {
    return;
  }
  const images = galleryEl.querySelectorAll(`.card[data-month="${monthKey}"] img[data-src]`);
  let loaded = 0;
  for (const img of images) {
    hydrateCardImage(img);
    loaded += 1;
    if (loaded >= limit) {
      break;
    }
  }
}

function hasAllYearsOption() {
  return Boolean(yearFilter.querySelector(`option[value="${ALL_YEARS_VALUE}"]`));
}

function renderYearFilterOptions(includeAll, selectedValue) {
  yearFilter.innerHTML = "";
  if (includeAll) {
    const allOption = document.createElement("option");
    allOption.value = ALL_YEARS_VALUE;
    allOption.textContent = "全部年份";
    yearFilter.appendChild(allOption);
  }
  for (const y of availableYears) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearFilter.appendChild(option);
  }
  if (selectedValue && [...yearFilter.options].some((option) => option.value === selectedValue)) {
    yearFilter.value = selectedValue;
  } else if (availableYears.length) {
    yearFilter.value = availableYears[0];
  } else {
    yearFilter.value = ALL_YEARS_VALUE;
  }
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

function loadViewerHighImage(item, token, options = {}) {
  const src = getViewerSrc(item);
  const showResolutionLoading = Boolean(options.showResolutionLoading);
  if (showResolutionLoading) {
    setViewerResolutionLoading(true);
  }
  preloadImage(src)
    .then(() => {
      if (token !== viewerLoadToken || viewerEl.hidden || viewerIndex < 0) {
        return;
      }
      setViewerResolutionLoading(false);
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
      setViewerResolutionLoading(false);
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

  const fallback = item.thumbUrl || item.hdUrl || preferredSrc;
  if (!fallback) {
    return false;
  }

  // Always switch to the next item's preview first, then upgrade to target resolution.
  setViewerLowImage(fallback, item);
  return false;
}

function showViewerItem(index, direction, options = {}) {
  if (!filteredItems.length) {
    return;
  }
  const prevItem = viewerIndex >= 0 ? filteredItems[viewerIndex] : null;
  const prevLowSrc = viewerLowImageEl.currentSrc || viewerLowImageEl.getAttribute("src") || "";
  viewerIndex = clamp(index, 0, filteredItems.length - 1);
  const token = ++viewerLoadToken;
  const item = filteredItems[viewerIndex];
  if (!item.hasUhd && viewerResolution === "uhd") {
    viewerResolution = "hd";
  }
  const preferredSrc = getViewerSrc(item);
  const forcePreviewFirst = Boolean(options.forcePreviewFirst);
  const keepCurrentBase = Boolean(options.keepCurrentBase);
  const forceUpgradeAnimation = Boolean(options.forceUpgradeAnimation);
  const showResolutionLoading = Boolean(options.showResolutionLoading);

  let baseSrc = "";
  if (keepCurrentBase && prevItem && prevItem.enddate === item.enddate && prevLowSrc) {
    baseSrc = prevLowSrc;
  } else if (forcePreviewFirst && item.thumbUrl) {
    // For next/prev navigation, show preview first to keep transitions responsive.
    baseSrc = item.thumbUrl;
  } else {
    baseSrc = preferredSrc || item.thumbUrl || item.hdUrl;
  }
  if (baseSrc) {
    setViewerLowImage(baseSrc, item);
  }

  const shouldAnimateTransition = Boolean(direction);
  runViewerSlide(shouldAnimateTransition ? direction : null);

  resetViewerHighLayer();
  updateViewerMeta(item);
  updateViewerResButtons();
  updateViewerNavButtons();
  preloadViewerNeighbors(viewerIndex);

  const shouldUpgrade = Boolean(preferredSrc) && (forceUpgradeAnimation || !baseSrc || preferredSrc !== baseSrc);
  if (shouldUpgrade) {
    loadViewerHighImage(item, token, {
      showResolutionLoading: showResolutionLoading || !isImageReady(preferredSrc)
    });
  } else {
    setViewerResolutionLoading(false);
  }

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
  setViewerResolutionLoading(false);
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
  const item = filteredItems[index];
  const sourceSrc = sourceImage.dataset.src || sourceImage.currentSrc || sourceImage.src;
  const startRect = sourceImage.getBoundingClientRect();
  viewerEl.hidden = false;
  viewerEl.classList.remove("open", "slide-next", "slide-prev", "quality-switch");
  document.body.style.overflow = "hidden";
  applyViewerRect(startRect);
  if (item && sourceSrc) {
    setViewerLowImage(sourceSrc, item);
    markImageLoaded(sourceSrc);
  }
  showViewerItem(viewerIndex, null, { keepCurrentBase: true });
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
  const currentItem = viewerIndex >= 0 ? filteredItems[viewerIndex] : null;
  if (next === "uhd" && (!currentItem || !currentItem.hasUhd)) {
    return;
  }
  if (viewerResolution === next) {
    return;
  }
  viewerResolution = next;
  const targetSrc = currentItem ? getViewerSrc(currentItem) : "";
  setViewerResolutionLoading(Boolean(targetSrc && !isImageReady(targetSrc)));
  viewerEl.classList.add("quality-switch");
  clearTimeout(viewerQualityTimer);
  viewerQualityTimer = setTimeout(() => {
    viewerEl.classList.remove("quality-switch");
  }, 620);
  showViewerItem(viewerIndex, null, {
    keepCurrentBase: true,
    forceUpgradeAnimation: true,
    showResolutionLoading: Boolean(targetSrc && !isImageReady(targetSrc))
  });
}

function goViewerNext() {
  if (viewerIndex >= filteredItems.length - 1) {
    return;
  }
  showViewerItem(viewerIndex + 1, "next", { forcePreviewFirst: true });
}

function goViewerPrev() {
  if (viewerIndex <= 0) {
    return;
  }
  showViewerItem(viewerIndex - 1, "prev", { forcePreviewFirst: true });
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
  heroUhd.classList.toggle("disabled", !item.hasUhd);
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
  img.src = THUMB_PLACEHOLDER;
  img.dataset.src = item.thumbUrl;
  img.alt = `${item.title} ${item.dateLabel}`;
  observeCardImage(img);
  img.addEventListener("click", () => openViewerAtIndex(index, img));
  date.textContent = item.dateLabel;
  title.textContent = item.title;
  copyright.textContent = item.copyright;
  uhd.href = item.uhdUrl || "#";
  uhd.classList.toggle("disabled", !item.hasUhd);
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
  scheduleMonthSync();
}

function refreshLoadMoreVisibility() {
  loadMoreBtn.hidden = renderedCount >= filteredItems.length;
}

function renderChunk(reset = false) {
  if (chunkRenderInProgress) {
    return;
  }
  chunkRenderInProgress = true;
  if (reset) {
    if (thumbObserver) {
      thumbObserver.disconnect();
    }
    galleryEl.innerHTML = "";
    renderedCount = 0;
  }
  if (!filteredItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的壁纸。";
    galleryEl.appendChild(empty);
    loadMoreBtn.hidden = true;
    chunkRenderInProgress = false;
    return;
  }
  const nextEnd = Math.min(filteredItems.length, renderedCount + PAGE_SIZE);
  appendRange(renderedCount, nextEnd);
  renderedCount = nextEnd;
  refreshLoadMoreVisibility();
  chunkRenderInProgress = false;
  scheduleAutoLoadCheck();
}

function ensureRenderedTo(targetIndex, options = {}) {
  const immediate = Boolean(options.immediate);
  if (targetIndex < renderedCount) {
    return Promise.resolve();
  }
  const targetEnd = Math.min(filteredItems.length, targetIndex + 1);
  if (immediate) {
    appendRange(renderedCount, targetEnd);
    renderedCount = targetEnd;
    refreshLoadMoreVisibility();
    return Promise.resolve();
  }
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
  const normalizedMonthKey = monthKey || "";
  if (normalizedMonthKey === activeMonthKey) {
    return;
  }
  activeMonthKey = normalizedMonthKey;
  const buttons = monthNavEl.querySelectorAll(".month-btn");
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.month === normalizedMonthKey);
  }
}

async function jumpToMonth(monthKey) {
  const targetIndex = monthStartIndexMap.get(monthKey);
  if (targetIndex == null) {
    return;
  }
  setActiveMonth(monthKey);
  await ensureRenderedTo(targetIndex, { immediate: true });
  const card = galleryEl.querySelector(`.card[data-index="${targetIndex}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      prioritizeMonthThumbs(monthKey);
    });
  }
}

function renderMonthNav() {
  monthStartIndexMap = new Map();
  activeMonthKey = "";
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
    if (!hasAllYearsOption()) {
      renderYearFilterOptions(true, ALL_YEARS_VALUE);
    }
    if (yearFilter.value !== ALL_YEARS_VALUE) {
      yearFilter.value = ALL_YEARS_VALUE;
    }
  } else if (searchingAllYears) {
    const restoreYear = userSelectedYear && availableYears.includes(userSelectedYear)
      ? userSelectedYear
      : (availableYears[0] || ALL_YEARS_VALUE);
    renderYearFilterOptions(false, restoreYear);
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
  requestAnimationFrame(updateLayoutMetrics);
  scheduleMonthSync();
  scheduleAutoLoadCheck();
}

function initYearFilter() {
  const years = new Set(allItems.map((item) => item.year).filter(Boolean));
  const sorted = [...years].sort((a, b) => b.localeCompare(a));
  availableYears = sorted;
  renderYearFilterOptions(false, sorted[0] || ALL_YEARS_VALUE);
  if (sorted.length) {
    userSelectedYear = sorted[0];
  } else {
    userSelectedYear = ALL_YEARS_VALUE;
  }
  searchingAllYears = false;
}

function updateLayoutMetrics() {
  const topbarHeight = topbarEl ? topbarEl.offsetHeight : 54;
  const stickyFiltersHeight = stickyFiltersEl ? stickyFiltersEl.offsetHeight : 120;
  const monthStickyTop = topbarHeight + stickyFiltersHeight + 12;
  const heroScrollTop = topbarHeight + 12;
  document.documentElement.style.setProperty("--topbar-height", `${topbarHeight}px`);
  document.documentElement.style.setProperty("--month-sticky-top", `${monthStickyTop}px`);
  document.documentElement.style.setProperty("--hero-scroll-top", `${heroScrollTop}px`);
}

function updateBackToTopVisibility() {
  if (!backToTopBtn) {
    return;
  }
  const offset = window.scrollY || document.documentElement.scrollTop || 0;
  backToTopBtn.classList.toggle("show", offset > 680);
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
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  randomBtn.addEventListener("click", () => {
    if (!filteredItems.length) {
      return;
    }
    const index = Math.floor(Math.random() * filteredItems.length);
    const item = filteredItems[index];
    renderHero(item);
    updateLayoutMetrics();
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
    updateLayoutMetrics();
    updateBackToTopVisibility();
    scheduleMonthSync();
    scheduleAutoLoadCheck();
  });
  window.addEventListener("load", updateLayoutMetrics);
  window.addEventListener("scroll", () => {
    updateBackToTopVisibility();
    scheduleMonthSync();
    scheduleAutoLoadCheck();
  }, { passive: true });
  updateLayoutMetrics();
  updateBackToTopVisibility();
  scheduleMonthSync();
  scheduleAutoLoadCheck();
}

async function start() {
  initThumbObserver();
  initAutoLoadObserver();
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
      .filter((item) => item.thumbUrl);
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
