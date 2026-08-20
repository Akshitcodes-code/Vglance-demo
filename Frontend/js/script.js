/**
 * vGlance - Search Engine Core Logic
 */

const API_URL = "http://127.0.0.1:5000/api";
const state = {
    theme: localStorage.getItem("theme") || "dark",
    history: [],
    isSearching: false
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    initializeTheme();
    initializeIcons();
    initializeSearch();
    initializeTabs();
    initializeCarousel();
    initializeMobileNavigation();
    initializeShortcuts();
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
    });
}

// --- Search Engine ---
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

async function searchVideos(query) {
    if (state.isSearching) return;
    state.isSearching = true;

    const panel = document.getElementById("searchResultsPanel");
    const scannerLoader = document.getElementById("aiScannerLoader");
    const body = document.getElementById("resultsBody");
    const scannerTag = document.getElementById("scannerTag");
    const scannerStatusText = document.getElementById("scannerStatusText");

    panel.hidden = false;
    scannerLoader.hidden = false;
    body.hidden = true;

    // AI Frame Scanner Animation
    const scanSteps = [
        { tag: "Searching YouTube", text: "Querying YouTube Data API v3..." },
        { tag: "Searching Meta", text: "Querying Instagram Graph API..." },
        { tag: "Gemini AI", text: "Analyzing metadata with Google Gemini..." },
        { tag: "Semantic Match", text: "Calculating confidence scores..." },
        { tag: "Results", text: "Preparing recommendations..." }
    ];

    let index = 0;
    const interval = setInterval(() => {
        if (index < scanSteps.length) {
            scannerTag.textContent = scanSteps[index].tag;
            scannerStatusText.textContent = scanSteps[index].text;
            index++;
        }
    }, 600);

    try {
        const response = await fetch(`${API_URL}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error("Backend API connection failed.");
        const data = await response.json();

        clearInterval(interval);
        scannerLoader.hidden = true;
        body.hidden = false;

        if (data.results && data.results.length > 0) {
            renderResults(data.results);
        } else {
            body.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center;">No results found.</p>`;
        }

    } catch (err) {
        clearInterval(interval);
        scannerLoader.hidden = true;
        body.hidden = false;
        body.innerHTML = `<p style="color:#ef4444; padding:20px;">Error: ${err.message}</p>`;
    } finally {
        state.isSearching = false;
    }
}

// --- Render Results ---
function renderResults(results) {
    const body = document.getElementById("resultsBody");

    body.innerHTML = results.map(video => `
        <div class="ai-recommendation-card">
            <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
                <img src="${video.thumbnail}" alt="${video.title}" 
                     style="width:160px; height:90px; border-radius:8px; object-fit:cover; border: 1px solid var(--border-color);">
                
                <div style="flex:1; min-width:200px;">
                    <h4 style="color: var(--text-primary); font-size: 16px; margin-bottom: 4px;">${escapeHtml(video.title)}</h4>
                    <div style="display:flex; gap:12px; color: var(--text-muted); font-size: 13px; flex-wrap:wrap;">
                        <span class="platform-badge" style="background:var(--purple-primary); color:#fff; padding:2px 8px; border-radius:4px;">${video.platform}</span>
                        <span>👤 ${video.creator}</span>
                        <span>⏱ ${video.duration}</span>
                        <span>👁 ${video.views}</span>
                    </div>
                    <div style="margin-top: 12px; display:flex; gap:10px;">
                        <div class="confidence" style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 10px; border-radius:4px; border:1px solid rgba(16,185,129,0.3);">
                            🎯 Match: ${video.confidence}%
                        </div>
                        <div class="timestamp" style="color: var(--text-subtle); font-size: 12px; align-self:center;">
                            ⏱ ${video.timestamp}
                        </div>
                    </div>
                </div>
            </div>

            <p class="reason" style="background:rgba(59,130,246,0.05); padding: 12px; border-left: 2px solid var(--purple-primary); border-radius: 4px; margin: 8px 0;">
                <strong style="color:var(--purple-primary);">Why Recommended:</strong><br>
                ${video.reason}
            </p>

            <div class="result-buttons" style="display:flex; gap: 12px; margin-top: 8px;">
                <a href="${video.url}" target="_blank" class="watch-btn" 
                   style="flex:1; padding: 10px; background: var(--gradient-purple); text-align:center; color:#fff; border-radius:8px; font-weight:600;">
                    ▶ Watch Video
                </a>
                <button class="bookmark-btn" onclick="alert('Saved to Bookmarks!')"
                        style="padding: 10px 20px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:8px; color:var(--text-secondary);">
                    ⭐ Bookmark
                </button>
            </div>
        </div>
    `).join("");
    
    initializeIcons();
}

function escapeHtml(str) {
    if(!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m]);
}

// --- UI Initializations ---
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
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });
}

function initializeShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
  });
}

function loadHistoryFromDB() {
    const container = document.getElementById('historyList');
    const mockHistory = [
        { id: '1', query: 'Motorcycle repair tutorial', time: '2 hours ago' },
        { id: '2', query: 'Air fryer recipes', time: '5 hours ago' }
    ];
    container.innerHTML = mockHistory.map(item => `
        <li class="history-item" data-query="${item.query}" onclick="document.getElementById('searchInput').value='${item.query}'; searchVideos('${item.query}');">
            <div class="history-main">
                <i data-lucide="clock" class="history-icon"></i>
                <span class="history-text">${item.query}</span>
            </div>
            <div class="history-meta">
                <span class="history-time">${item.time}</span>
            </div>
        </li>
    `).join("");
    initializeIcons();
}