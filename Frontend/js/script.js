const API_URL = "http://127.0.0.1:5000/api";
const state = {
    theme: localStorage.getItem("theme") || "dark",
    isSearching: false,
    language: localStorage.getItem("lang") || "en"
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    initializeTheme();
    initializeIcons();
    initializeSearch();
    initializeNewSearch();
    initializeTabs();
    initializeCarousel();
    initializeMobileNavigation();
    initializeShortcuts();
    initializeLanguageSelector();
    loadHistoryFromDB();
}

function initializeIcons() {
    if (window.lucide) window.lucide.createIcons();
}

function initializeTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        initializeIcons();
    });
}

function initializeLanguageSelector() {
    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');
    if (langBtn) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langMenu.classList.toggle('show');
        });
        document.querySelectorAll('.lang-option').forEach(btn => {
            btn.addEventListener('click', () => {
                state.language = btn.dataset.lang;
                localStorage.setItem('lang', state.language);
                langMenu.classList.remove('show');
            });
        });
    }
    document.addEventListener('click', (e) => {
        if (langMenu && !langMenu.contains(e.target) && e.target !== langBtn) {
            langMenu.classList.remove('show');
        }
    });
}

function initializeSearch() {
    const form = document.getElementById('searchForm');
    const input = document.getElementById('searchInput');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (query) searchVideos(query);
        });
    }
}

function initializeNewSearch() {
    const newSearchBtn = document.getElementById('newSearchBtn');
    if (!newSearchBtn) return;
    newSearchBtn.addEventListener('click', () => {
        resetSearchUI();
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
        document.getElementById('searchInput')?.focus();
    });
}

function resetSearchUI() {
    state.isSearching = false;
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    const panel = document.getElementById('searchResultsPanel');
    const body = document.getElementById('resultsBody');
    const scannerLoader = document.getElementById('aiScannerLoader');
    if (panel) panel.hidden = true;
    if (body) { body.innerHTML = ''; body.hidden = true; }
    if (scannerLoader) scannerLoader.hidden = true;
}

async function searchVideos(query) {
    if (state.isSearching) return;
    state.isSearching = true;

    const panel = document.getElementById("searchResultsPanel");
    const scannerLoader = document.getElementById("aiScannerLoader");
    const body = document.getElementById("resultsBody");

    panel.hidden = false;
    scannerLoader.hidden = false;
    body.hidden = true;

    const scanSteps = [
        { tag: "Searching YouTube", text: "Finding relevant videos..." },
        { tag: "AI Analysis", text: "Analyzing audio & OCR text (up to 60s)..." },
        { tag: "Semantic Match", text: "Calculating confidence scores..." },
        { tag: "Results", text: "Preparing recommendations..." }
    ];

    let index = 0;
    const scannerTag = document.getElementById("scannerTag");
    const scannerStatusText = document.getElementById("scannerStatusText");
    const interval = setInterval(() => {
        if (index < scanSteps.length) {
            scannerTag.textContent = scanSteps[index].tag;
            scannerStatusText.textContent = scanSteps[index].text;
            index++;
        }
    }, 800);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(`${API_URL}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, lang: state.language }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        clearInterval(interval);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();

        if (scannerLoader && scannerLoader.parentNode) {
            scannerLoader.parentNode.removeChild(scannerLoader);
        }
        body.hidden = false;

        if (data.results && data.results.length > 0) {
            renderResults(data.results);
            loadHistoryFromDB(); 
        } else {
            body.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center;">No results found.</p>`;
        }

    } catch (err) {
        clearInterval(interval);
        if (scannerLoader && scannerLoader.parentNode) {
            scannerLoader.parentNode.removeChild(scannerLoader);
        }
        body.hidden = false;
        body.innerHTML = `<p style="color:#ef4444; padding:20px; text-align:center; border:1px solid #ef4444; border-radius:8px; margin:20px 0;">
                            <strong>Processing...</strong><br>
                            The AI is extracting the transcript. Please search again in 10 seconds.
                            <br><small>Error details: ${err.message}</small>
                          </p>`;
    } finally {
        state.isSearching = false;
    }
}

function renderResults(results) {
    const body = document.getElementById("resultsBody");
    body.innerHTML = results.map(video => `
        <div class="ai-recommendation-card">
            <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
                <img src="${video.thumbnail}" alt="${video.title}" style="width:160px; height:90px; border-radius:8px; object-fit:cover; border: 1px solid var(--border-color);">
                <div style="flex:1; min-width:200px;">
                    <h4 style="color: var(--text-primary); font-size: 16px; margin-bottom: 4px;">${escapeHtml(video.title)}</h4>
                    <div style="display:flex; gap:12px; color: var(--text-muted); font-size: 13px; flex-wrap:wrap;">
                        <span class="platform-badge" style="background:var(--purple-primary); color:#fff; padding:2px 8px; border-radius:4px;">${video.platform}</span>
                        <span class="lang-badge" style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 8px; border-radius:4px;">🌍 ${state.language.toUpperCase()}</span>
                        <span>👤 ${video.creator}</span>
                        <span>⏱ ${video.duration}</span>
                    </div>
                    <div style="margin-top: 12px; display:flex; gap:10px;">
                        <div class="confidence" style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 10px; border-radius:4px; border:1px solid rgba(16,185,129,0.3);">🎯 Match: ${video.confidence}%</div>
                    </div>
                </div>
            </div>
            <p class="reason" style="background:rgba(59,130,246,0.05); padding: 12px; border-left: 2px solid var(--purple-primary); border-radius: 4px; margin: 8px 0;">
                <strong style="color:var(--purple-primary);">Why Recommended:</strong><br>
                ${video.reason}
            </p>
            <div class="result-buttons" style="display:flex; gap: 12px; margin-top: 8px;">
                <a href="${video.url}" target="_blank" class="watch-btn" style="flex:1; padding: 10px; background: var(--gradient-purple); text-align:center; color:#fff; border-radius:8px; font-weight:600;">▶ Watch Video</a>
            </div>
        </div>
    `).join("");
    initializeIcons();
}

function escapeHtml(str) {
    if(!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}

async function loadHistoryFromDB() {
    const container = document.getElementById('historyList');
    try {
        const response = await fetch(`${API_URL}/history`);
        const data = await response.json();
        if (data.history && data.history.length > 0) {
            container.innerHTML = data.history.map(item => `
                <li class="history-item" data-query="${item.query}">
                    <div class="history-main" onclick="document.getElementById('searchInput').value='${item.query.replace(/'/g, "\\'")}'; searchVideos('${item.query.replace(/'/g, "\\'")}');">
                        <i data-lucide="clock" class="history-icon"></i>
                        <span class="history-text">${item.query}</span>
                    </div>
                    <div class="history-meta">
                        <span class="history-time">${item.time}</span>
                        <button class="history-menu-btn delete-btn" data-id="${item.id}"><i data-lucide="trash-2" style="color: #ef4444; width: 16px; height: 16px;"></i></button>
                    </div>
                </li>
            `).join("");
        } else {
            container.innerHTML = `<li style="color:var(--text-subtle); padding:10px; text-align:center;">No search history found.</li>`;
        }
    } catch (err) {
        container.innerHTML = `<li style="color:#ef4444; padding:10px; text-align:center;">Error loading history.</li>`;
    } finally {
        initializeIcons();
        attachDeleteListeners();
    }
}

function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm("Delete this history item?")) {
                try {
                    const response = await fetch(`${API_URL}/history/${id}`, { method: "DELETE" });
                    if (response.ok) loadHistoryFromDB();
                } catch (err) { alert("Could not connect to backend."); }
            }
        });
    });
}

function initializeTabs() {
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function initializeCarousel() {
  const container = document.getElementById('reelsContainer');
  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');
  if(prevBtn) prevBtn.addEventListener('click', () => container.scrollBy({ left: -300, behavior: 'smooth' }));
  if(nextBtn) nextBtn.addEventListener('click', () => container.scrollBy({ left: 300, behavior: 'smooth' }));
}

function initializeMobileNavigation() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('active'); });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });
  }
  if (overlay) {
    overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });
  }
}

function initializeShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
  });
}