const DATA_FILE = "./Bing_zh-CN_all.json";
const BING_HOST = "https://www.bing.com";
const PAGE_SIZE = 36;
const MIN_DATE = "20200101";
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;

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
const viewerImageEl = document.getElementById("viewerImage");
const viewerHdBtn = document.getElementById("viewerHdBtn");
const viewerUhdBtn = document.getElementById("viewerUhdBtn");
const viewerPrevBtn = document.getElementById("viewerPrevBtn");
const viewerNextBtn = document.getElementById("viewerNextBtn");

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

function getZoomTargetRect() {
  const ratio = viewerImageEl.naturalWidth && viewerImageEl.naturalHeight
    ? viewerImageEl.naturalWidth / viewerImageEl.naturalHeight
    : 16 / 9;
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
  viewerImageEl.style.top = `${rect.top}px`;
  viewerImageEl.style.left = `${rect.left}px`;
  viewerImageEl.style.width = `${rect.width}px`;
  viewerImageEl.style.height = `${rect.height}px`;
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
  }, 220);
}

function getViewerSrc(item) {
  return viewerResolution === "uhd" ? item.uhdUrl : item.hdUrl;
}

function showViewerItem(index, direction) {
  if (!filteredItems.length) {
    return;
  }
  viewerIndex = clamp(index, 0, filteredItems.length - 1);
  const item = filteredItems[viewerIndex];
  runViewerSlide(direction);
  viewerImageEl.src = getViewerSrc(item);
  viewerImageEl.alt = `${item.title} ${item.dateLabel}`;
  updateViewerResButtons();
  updateViewerNavButtons();

  const currentCardImage = getItemImageElement(viewerIndex);
  if (currentCardImage) {
    viewerOriginImage = currentCardImage;
  }
}

function closeViewer() {
  if (viewerEl.hidden) {
    return;
  }
  const origin = viewerOriginImage && document.body.contains(viewerOriginImage)
    ? viewerOriginImage.getBoundingClientRect()
    : null;
  viewerEl.classList.remove("open", "slide-next", "slide-prev");
  if (origin) {
    applyViewerRect(origin);
  }
  clearTimeout(viewerCloseTimer);
  viewerCloseTimer = setTimeout(() => {
    viewerEl.hidden = true;
    document.body.style.overflow = "";
    viewerImageEl.removeAttribute("src");
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
  viewerEl.classList.remove("open", "slide-next", "slide-prev");
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
  showViewerItem(viewerIndex, null);
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
  totalCountEl.textContent = `总数: ${filteredItems.length}`;
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
    return;
  }
  const targetEnd = Math.min(filteredItems.length, targetIndex + 1);
  appendRange(renderedCount, targetEnd);
  renderedCount = targetEnd;
  refreshLoadMoreVisibility();
}

function setActiveMonth(monthKey) {
  const buttons = monthNavEl.querySelectorAll(".month-btn");
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.month === monthKey);
  }
}

function jumpToMonth(monthKey) {
  const targetIndex = monthStartIndexMap.get(monthKey);
  if (targetIndex == null) {
    return;
  }
  ensureRenderedTo(targetIndex);
  const card = galleryEl.querySelector(`.card[data-index="${targetIndex}"]`);
  if (!card) {
    return;
  }
  setActiveMonth(monthKey);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
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
    button.addEventListener("click", () => jumpToMonth(monthKey));
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
  const year = yearFilter.value;

  filteredItems = allItems.filter((item) => {
    if (item.year !== year) {
      return false;
    }
    if (!keyword) {
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
  yearFilter.innerHTML = "";
  for (const y of sorted) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearFilter.appendChild(option);
  }
  if (sorted.length) {
    yearFilter.value = sorted[0];
  }
}

function bindEvents() {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 180);
  });
  yearFilter.addEventListener("change", applyFilters);
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
  viewerImageEl.addEventListener("click", closeViewer);
  viewerHdBtn.addEventListener("click", () => switchViewerResolution("hd"));
  viewerUhdBtn.addEventListener("click", () => switchViewerResolution("uhd"));
  viewerPrevBtn.addEventListener("click", goViewerPrev);
  viewerNextBtn.addEventListener("click", goViewerNext);

  viewerImageEl.addEventListener("load", () => {
    if (!viewerEl.hidden) {
      applyViewerRect(getZoomTargetRect());
    }
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
