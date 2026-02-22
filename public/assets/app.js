const DATA_FILE = "./Bing_zh-CN_all.json";
const BING_HOST = "https://www.bing.com";
const PAGE_SIZE = 36;

const galleryEl = document.getElementById("gallery");
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

let allItems = [];
let filteredItems = [];
let renderedCount = 0;
let searchTimer = null;

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
  return `${BING_HOST}${path}`;
}

function normalize(item) {
  const enddate = safeText(item.enddate, "");
  const hdUrl = toAbsolute(item.url);
  const uhdUrl = item.urlbase ? toAbsolute(`${item.urlbase}_UHD.jpg`) : hdUrl;
  return {
    enddate,
    dateLabel: formatDate(enddate),
    year: enddate.slice(0, 4),
    title: safeText(item.title, "Bing Wallpaper"),
    copyright: safeText(item.copyright, "No copyright text"),
    copyrightlink: safeText(item.copyrightlink, ""),
    hdUrl,
    uhdUrl,
    thumbUrl: hdUrl || uhdUrl
  };
}

function renderHero(item) {
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

  card.style.setProperty("--index", String(idx));
  img.src = item.thumbUrl;
  img.alt = `${item.title} ${item.dateLabel}`;
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
    allItems = images.map(normalize).filter((item) => item.thumbUrl);
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
