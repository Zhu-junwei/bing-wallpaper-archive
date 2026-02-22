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
const filteredCountEl = document.getElementById("filteredCount");
const latestDateEl = document.getElementById("latestDate");

const viewerEl = document.getElementById("viewer");
const viewerBackdropEl = document.getElementById("viewerBackdrop");
const viewerImageEl = document.getElementById("viewerImage");

let allItems = [];
let filteredItems = [];
let renderedCount = 0;
let searchTimer = null;
let monthStartIndexMap = new Map();
let heroItem = null;
let viewerOriginImage = null;
let viewerCloseTimer = null;

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

function closeViewer() {
  if (viewerEl.hidden) {
    return;
  }
  const origin = viewerOriginImage && document.body.contains(viewerOriginImage)
    ? viewerOriginImage.getBoundingClientRect()
    : null;
  viewerEl.classList.remove("open");
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

function openViewer(item, sourceImage) {
  if (!item || !sourceImage) {
    return;
  }
  clearTimeout(viewerCloseTimer);
  viewerOriginImage = sourceImage;
  const startRect = sourceImage.getBoundingClientRect();
  viewerImageEl.src = item.hdUrl;
  viewerImageEl.alt = `${item.title} ${item.dateLabel}`;
  viewerEl.hidden = false;
  viewerEl.classList.remove("open");
  document.body.style.overflow = "hidden";
  applyViewerRect(startRect);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      applyViewerRect(getZoomTargetRect());
      viewerEl.classList.add("open");
    });
  });
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

function cardFromItem(item, idx) {
  const fragment = templateEl.content.cloneNode(true);
  const card = fragment.querySelector(".card");
  const img = fragment.querySelector("img");
  const date = fragment.querySelector(".card-date");
  const title = fragment.querySelector(".card-title");
  const copyright = fragment.querySelector(".card-copyright");
  const uhd = fragment.querySelector(".card-uhd");
  const hd = fragment.querySelector(".card-hd");
  const link = fragment.querySelector(".card-link");

  card.dataset.index = String(idx);
  card.dataset.month = item.month;
  card.style.setProperty("--index", String(idx));
  img.src = item.thumbUrl;
  img.alt = `${item.title} ${item.dateLabel}`;
  img.addEventListener("click", () => openViewer(item, img));
  date.textContent = item.dateLabel;
  title.textContent = item.title;
  copyright.textContent = item.copyright;
  uhd.href = item.uhdUrl || "#";
  hd.href = item.hdUrl || "#";
  link.href = item.copyrightlink || "https://www.bing.com";

  return fragment;
}

function updateStats() {
  totalCountEl.textContent = `总数(2020+): ${allItems.length}`;
  filteredCountEl.textContent = `当前筛选: ${filteredItems.length}`;
  latestDateEl.textContent = `最近更新: ${allItems[0] ? allItems[0].dateLabel : "--"}`;
}

function renderChunk(reset = false) {
  if (reset) {
    galleryEl.innerHTML = "";
    renderedCount = 0;
  }

  const nextItems = filteredItems.slice(renderedCount, renderedCount + PAGE_SIZE);
  if (reset && nextItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的壁纸。";
    galleryEl.appendChild(empty);
    loadMoreBtn.hidden = true;
    return;
  }

  const start = renderedCount;
  for (let i = 0; i < nextItems.length; i += 1) {
    galleryEl.appendChild(cardFromItem(nextItems[i], start + i));
  }
  renderedCount += nextItems.length;
  loadMoreBtn.hidden = renderedCount >= filteredItems.length;
}

function ensureRenderedTo(targetIndex) {
  while (renderedCount <= targetIndex && renderedCount < filteredItems.length) {
    renderChunk(false);
  }
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
  const year = yearFilter.value;
  const sort = sortOrder.value;

  filteredItems = allItems.filter((item) => {
    if (year !== "all" && item.year !== year) {
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
  renderHero(filteredItems[0]);
  renderChunk(true);
  updateStats();
}

function initYearFilter() {
  const years = new Set(allItems.map((item) => item.year).filter(Boolean));
  const sorted = [...years].sort((a, b) => b.localeCompare(a));
  for (const y of sorted) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearFilter.appendChild(option);
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
    if (heroItem) {
      openViewer(heroItem, heroImage);
    }
  });

  viewerBackdropEl.addEventListener("click", closeViewer);
  viewerImageEl.addEventListener("click", closeViewer);
  viewerImageEl.addEventListener("load", () => {
    if (!viewerEl.hidden) {
      applyViewerRect(getZoomTargetRect());
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeViewer();
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
