const API_URL = "http://127.0.0.1:5000/api";

const state = {
    theme: localStorage.getItem("theme") || "dark",
    isSearching: false,
    language: localStorage.getItem("lang") || "en",
    lastResults: []
};


/* =========================================================
   APP INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
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


/* =========================================================
   ICONS
   ========================================================= */

function initializeIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/* =========================================================
   THEME
   ========================================================= */

function initializeTheme() {

    document.documentElement.setAttribute("data-theme", state.theme);

    document.getElementById("themeToggleBtn")?.addEventListener("click", () => {

        state.theme = state.theme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", state.theme);

        localStorage.setItem("theme", state.theme);

        initializeIcons();
    });
}


/* =========================================================
   LANGUAGE SELECTOR
   ========================================================= */

function initializeLanguageSelector() {

    const langBtn = document.getElementById("langBtn");
    const langMenu = document.getElementById("langMenu");

    if (langBtn && langMenu) {

        langBtn.addEventListener("click", (e) => {

            e.stopPropagation();

            langMenu.classList.toggle("show");
        });


        document.querySelectorAll(".lang-option").forEach(btn => {

            btn.addEventListener("click", () => {

                state.language = btn.dataset.lang;

                localStorage.setItem("lang", state.language);

                langMenu.classList.remove("show");

                applyLanguage(state.language);
            });

        });
    }


    document.addEventListener("click", (e) => {

        if (
            langMenu &&
            !langMenu.contains(e.target) &&
            e.target !== langBtn
        ) {
            langMenu.classList.remove("show");
        }

    });


    // Apply saved language when page loads
    applyLanguage(state.language);
}


/* =========================================================
   SEARCH
   ========================================================= */

function initializeSearch() {

    const form = document.getElementById("searchForm");
    const input = document.getElementById("searchInput");

    if (!form || !input) return;


    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const query = input.value.trim();

        if (query) {
            searchVideos(query);
        }

    });
}


/* =========================================================
   NEW SEARCH
   ========================================================= */

function initializeNewSearch() {

    const newSearchBtn = document.getElementById("newSearchBtn");

    if (!newSearchBtn) return;


    newSearchBtn.addEventListener("click", () => {

        resetSearchUI();

        document.getElementById("sidebar")?.classList.remove("open");

        document.getElementById("sidebarOverlay")?.classList.remove("active");

        document.getElementById("searchInput")?.focus();

    });
}


/* =========================================================
   RESET SEARCH UI
   ========================================================= */

function resetSearchUI() {

    state.isSearching = false;
    state.lastResults = [];

    const input = document.getElementById("searchInput");
    const panel = document.getElementById("searchResultsPanel");
    const body = document.getElementById("resultsBody");
    const scannerLoader = document.getElementById("aiScannerLoader");

    if (input) {
        input.value = "";
    }

    if (panel) {
        panel.hidden = true;
        panel.style.height = "auto";
        panel.style.minHeight = "0";
        panel.style.maxHeight = "none";
    }

    if (body) {
        body.innerHTML = "";
        body.hidden = true;
    }

    if (scannerLoader) {
        scannerLoader.hidden = true;
    }
}


/* =========================================================
   SEARCH VIDEOS
   ========================================================= */

async function searchVideos(query) {

    if (state.isSearching) return;

    state.isSearching = true;

    const panel = document.getElementById("searchResultsPanel");
    const scannerLoader = document.getElementById("aiScannerLoader");
    const body = document.getElementById("resultsBody");

    if (!panel || !body) {
        state.isSearching = false;
        return;
    }

    panel.hidden = false;
    body.hidden = true;

    // Show the scanner loader
    if (scannerLoader) {
        scannerLoader.hidden = false;
        scannerLoader.style.display = "flex";
    }

    const t = translations[state.language] || translations.en;

    const scannerTag = document.getElementById("scannerTag");
    const scannerStatusText = document.getElementById("scannerStatusText");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    try {
        // Use the streaming endpoint for real-time updates
        const response = await fetch(`${API_URL}/search-stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, lang: state.language })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        // Update UI based on status
                        if (scannerTag) {
                            scannerTag.textContent = data.status || 'Processing';
                        }
                        if (scannerStatusText) {
                            scannerStatusText.textContent = data.message || 'Working...';
                        }

                        // Update progress bar based on status
                        if (progressFill) {
                            if (data.status === 'starting') {
                                progressFill.style.width = '10%';
                            } else if (data.status === 'searching') {
                                progressFill.style.width = '25%';
                            } else if (data.status === 'found_videos') {
                                progressFill.style.width = '40%';
                            } else if (data.status === 'processing' && data.current && data.total) {
                                const progress = 40 + ((data.current / data.total) * 50); // 40-90% range
                                progressFill.style.width = `${progress}%`;
                            } else if (data.status === 'saving') {
                                progressFill.style.width = '95%';
                            } else if (data.status === 'complete') {
                                progressFill.style.width = '100%';
                            }
                        }
                        
                        if (progressText && data.message) {
                            progressText.textContent = data.message;
                        }

                        // Handle different statuses
                        if (data.status === 'complete') {
                            // Hide scanner and show results
                            if (scannerLoader) {
                                scannerLoader.style.display = "none";
                            }
                            
                            if (data.results && data.results.length > 0) {
                                state.lastResults = data.results;
                                body.hidden = false;
                                renderResults(data.results);
                                loadHistoryFromDB();
                            } else {
                                body.hidden = false;
                                body.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center;">${t.noResults}</p>`;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }

    } catch (err) {
        if (scannerLoader) {
            scannerLoader.style.display = "none";
        }

        body.hidden = false;
        let errorMessage = err.message;

        body.innerHTML = `<p style="color:#ef4444; padding:20px; text-align:center; border:1px solid #ef4444; border-radius:8px; margin:20px 0;">
                            <strong>${t.processing}</strong><br>
                            ${t.processingMessage}
                            <br><small>${t.errorDetails}: ${escapeHtml(errorMessage)}</small>
                          </p>`;
    } finally {
        state.isSearching = false;
    }
}


/* =========================================================
   RENDER SEARCH RESULTS
   ========================================================= */

function renderResults(results) {
    const body = document.getElementById("resultsBody");
    
    // Clear previous content
    body.innerHTML = "";

    // Add the "Results found" header (optional, but looks professional)
    const header = document.createElement("div");
    header.style.cssText = "width:100%; padding:10px 0; font-size:16px; font-weight:600; color:var(--text-primary);";
    header.textContent = `Found ${results.length} videos`;
    body.appendChild(header);

    // Create horizontal scroll container for the cards
    const scrollContainer = document.createElement("div");
    scrollContainer.style.cssText = "display:flex; flex-direction:row; justify-content:flex-start; align-items:flex-start; gap:16px; overflow-x:auto; padding-bottom:10px; width:100%; margin:0;";
    // Generate the cards
    scrollContainer.innerHTML = results.map(video => `
        <div class="ai-recommendation-card" style="flex:0 0 auto; width:320px; height:500px; border-radius:12px; overflow:hidden; background:var(--bg-surface-elevated); border:1px solid var(--border-color); display:flex; flex-direction:column;">
            
            <img src="${video.thumbnail}" alt="${video.title}" style="width:100%; height:65%; object-fit:cover; border-bottom:1px solid var(--border-color);">
            
            <div style="padding:12px; flex:1; display:flex; flex-direction:column;">
                <h4 style="color:var(--text-primary); font-size:14px; font-weight:600; margin-bottom:4px; display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(video.title)}</h4>
                
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
                    <span style="background:var(--purple-primary); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">${video.platform}</span>
                    <span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 6px; border-radius:4px; font-size:10px;">🌍 ${state.language.toUpperCase()}</span>
                </div>

                <p style="color:var(--text-muted); font-size:11px; margin-bottom:6px;">${video.creator}</p>

                <div style="margin-bottom:8px;">
                    <span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 8px; border-radius:4px; font-size:12px;">🎯 ${video.confidence}% Match</span>
                </div>

                <p style="color:var(--text-secondary); font-size:11px; line-height:1.4; flex:1; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical;">
                    <strong style="color:var(--purple-primary);">Why:</strong> ${video.reason}
                </p>
            </div>

            <div style="padding:10px; border-top:1px solid var(--border-color);">
                <a href="${video.url}" target="_blank" style="display:block; width:100%; padding:10px; background:var(--purple-primary); text-align:center; color:#fff; border-radius:8px; font-weight:600; text-decoration:none;">▶ Watch</a>
            </div>
        </div>
    `).join("");

    // Append the scroll container to the results body
    body.appendChild(scrollContainer);
    
    initializeIcons();
}
/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }


    const div = document.createElement("div");

    div.textContent = String(value);

    return div.innerHTML;
}


/* =========================================================
   LOAD SEARCH HISTORY
   ========================================================= */

async function loadHistoryFromDB() {

    const container =
        document.getElementById("historyList");

    if (!container) return;


    try {

        const response =
            await fetch(`${API_URL}/history`);


        if (!response.ok) {
            throw new Error("History request failed");
        }


        const data =
            await response.json();


        if (
            data.history &&
            data.history.length > 0
        ) {


            container.innerHTML =
                data.history.map(item => `

                    <li
                        class="history-item"
                        data-query="${escapeHtml(item.query)}"
                    >

                        <div
                            class="history-main"
                            data-query="${escapeHtml(item.query)}"
                        >

                            <i
                                data-lucide="clock"
                                class="history-icon"
                            ></i>

                            <span class="history-text">

                                ${escapeHtml(item.query)}

                            </span>

                        </div>


                        <div class="history-meta">

                            <span class="history-time">

                                ${escapeHtml(item.time)}

                            </span>


                            <button
                                class="history-menu-btn delete-btn"
                                data-id="${escapeHtml(item.id)}"
                            >

                                <i
                                    data-lucide="trash-2"
                                    style="
                                        color:#ef4444;
                                        width:16px;
                                        height:16px;
                                    "
                                ></i>

                            </button>

                        </div>

                    </li>

                `).join("");


            /*
               Attach click events to history searches.
            */

            document
                .querySelectorAll(".history-main")
                .forEach(item => {

                    item.addEventListener("click", () => {

                        const query =
                            item.dataset.query;

                        const input =
                            document.getElementById(
                                "searchInput"
                            );

                        if (input) {
                            input.value = query;
                        }

                        searchVideos(query);

                    });

                });

        }

        else {

            const t =
                translations[state.language] ||
                translations.en;


            container.innerHTML = `

                <li style="
                    color:var(--text-subtle);
                    padding:10px;
                    text-align:center;
                ">

                    ${t.noHistory}

                </li>

            `;

        }


    }

    catch (err) {

        const t =
            translations[state.language] ||
            translations.en;


        container.innerHTML = `

            <li style="
                color:#ef4444;
                padding:10px;
                text-align:center;
            ">

                ${t.historyError}

            </li>

        `;

    }

    finally {

        initializeIcons();

        attachDeleteListeners();

    }
}


/* =========================================================
   DELETE HISTORY
   ========================================================= */

function attachDeleteListeners() {

    document
        .querySelectorAll(".delete-btn")
        .forEach(btn => {


            btn.addEventListener("click", async (e) => {

                e.stopPropagation();


                const id =
                    btn.dataset.id;


                const t =
                    translations[state.language] ||
                    translations.en;


                if (!confirm(t.deleteHistory)) {
                    return;
                }


                try {

                    const response =
                        await fetch(
                            `${API_URL}/history/${id}`,
                            {
                                method: "DELETE"
                            }
                        );


                    if (response.ok) {

                        loadHistoryFromDB();

                    }

                }

                catch (err) {

                    alert(t.backendError);

                }

            });

        });

}


/* =========================================================
   CATEGORY TABS
   ========================================================= */

function initializeTabs() {

    document
        .querySelectorAll(".tab-btn")
        .forEach(tab => {

            tab.addEventListener("click", () => {

                document
                    .querySelectorAll(".tab-btn")
                    .forEach(t =>
                        t.classList.remove("active")
                    );

                tab.classList.add("active");

            });

        });

}


/* =========================================================
   CAROUSEL
   ========================================================= */

function initializeCarousel() {
    const container = document.getElementById('reelsContainer');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');

    if (!container) return;

    // Always start the carousel from the first card
    container.scrollLeft = 0;

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            container.scrollBy({
                left: -300,
                behavior: 'smooth'
            });
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            container.scrollBy({
                left: 300,
                behavior: 'smooth'
            });
        });
    }
}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function initializeMobileNavigation() {

    const menuBtn =
        document.getElementById("mobileMenuBtn");

    const closeBtn =
        document.getElementById("sidebarCloseBtn");

    const sidebar =
        document.getElementById("sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");


    if (menuBtn) {

        menuBtn.addEventListener("click", () => {

            sidebar?.classList.add("open");

            overlay?.classList.add("active");

        });

    }


    if (closeBtn) {

        closeBtn.addEventListener("click", () => {

            sidebar?.classList.remove("open");

            overlay?.classList.remove("active");

        });

    }


    if (overlay) {

        overlay.addEventListener("click", () => {

            sidebar?.classList.remove("open");

            overlay?.classList.remove("active");

        });

    }

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function initializeShortcuts() {

    document.addEventListener("keydown", (e) => {

        if (
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "k"
        ) {

            e.preventDefault();

            document
                .getElementById("searchInput")
                ?.focus();

        }

    });

}


/* =========================================================
   MULTILINGUAL TRANSLATIONS
   ========================================================= */

const translations = {


    /* =====================================================
       ENGLISH
       ===================================================== */

    en: {

        brandTagline: "Search & Discovery",
        newSearch: "New Search",
        history: "HISTORY",
        bookmarks: "Bookmarks",
        collections: "Collections",
        settings: "Settings",

        searchReady: "Search Ready",

        subtitle:
            "Search, discover, and analyze information instantly.",

        searchPlaceholder:
            "Search anything...",

        all: "All",
        images: "Images",
        videos: "Videos",
        discovery: "Discovery",
        trending: "Trending",
        educational: "Educational",

        discoverContent:
            "Discover Relevant Content",

        searchingYoutube:
            "Searching YouTube",

        findingVideos:
            "Finding relevant videos...",

        aiAnalysis:
            "AI Analysis",

        analyzing:
            "Analyzing audio & OCR text (up to 60s)...",

        semanticMatch:
            "Semantic Match",

        calculating:
            "Calculating confidence scores...",

        results:
            "Results",

        preparing:
            "Preparing recommendations...",

        whyRecommended:
            "Why Recommended:",

        watchVideo:
            "Watch Video",

        match:
            "Match",

        noResults:
            "No results found.",

        processing:
            "Processing...",

        processingMessage:
            "The AI is extracting the transcript. Please wait a moment and try again.",

        errorDetails:
            "Error details",

        requestTimeout:
            "The request took too long. Please try again.",

        noHistory:
            "No search history found.",

        historyError:
            "Error loading history.",

        deleteHistory:
            "Delete this history item?",

        backendError:
            "Could not connect to backend."

    },


    /* =====================================================
       HINDI
       ===================================================== */

    hi: {

        brandTagline: "खोज और खोजबीन",
        newSearch: "नई खोज",
        history: "इतिहास",
        bookmarks: "बुकमार्क",
        collections: "संग्रह",
        settings: "सेटिंग्स",

        searchReady:
            "खोज के लिए तैयार",

        subtitle:
            "जानकारी खोजें, खोजबीन करें और तुरंत विश्लेषण करें।",

        searchPlaceholder:
            "कुछ भी खोजें...",

        all: "सभी",
        images: "चित्र",
        videos: "वीडियो",
        discovery: "खोजबीन",
        trending: "ट्रेंडिंग",
        educational: "शैक्षिक",

        discoverContent:
            "प्रासंगिक सामग्री खोजें",

        searchingYoutube:
            "YouTube पर खोज रहा है",

        findingVideos:
            "प्रासंगिक वीडियो खोजे जा रहे हैं...",

        aiAnalysis:
            "AI विश्लेषण",

        analyzing:
            "ऑडियो और OCR टेक्स्ट का विश्लेषण हो रहा है...",

        semanticMatch:
            "सिमेंटिक मिलान",

        calculating:
            "विश्वसनीयता स्कोर की गणना हो रही है...",

        results:
            "परिणाम",

        preparing:
            "सिफारिशें तैयार हो रही हैं...",

        whyRecommended:
            "क्यों सुझाया गया:",

        watchVideo:
            "वीडियो देखें",

        match:
            "मिलान",

        noResults:
            "कोई परिणाम नहीं मिला।",

        processing:
            "प्रोसेसिंग...",

        processingMessage:
            "AI ट्रांसक्रिप्ट निकाल रहा है। कृपया कुछ क्षण प्रतीक्षा करें और फिर प्रयास करें।",

        errorDetails:
            "त्रुटि विवरण",

        requestTimeout:
            "अनुरोध में बहुत समय लग रहा है। कृपया फिर से प्रयास करें।",

        noHistory:
            "कोई खोज इतिहास नहीं मिला।",

        historyError:
            "इतिहास लोड करने में त्रुटि।",

        deleteHistory:
            "क्या आप इस इतिहास को हटाना चाहते हैं?",

        backendError:
            "बैकएंड से कनेक्ट नहीं हो सका।"

    },


    /* =====================================================
       SPANISH
       ===================================================== */

    es: {

        brandTagline:
            "Búsqueda y descubrimiento",

        newSearch:
            "Nueva búsqueda",

        history:
            "HISTORIAL",

        bookmarks:
            "Marcadores",

        collections:
            "Colecciones",

        settings:
            "Configuración",

        searchReady:
            "Búsqueda lista",

        subtitle:
            "Busca, descubre y analiza información al instante.",

        searchPlaceholder:
            "Buscar cualquier cosa...",

        all:
            "Todo",

        images:
            "Imágenes",

        videos:
            "Vídeos",

        discovery:
            "Descubrir",

        trending:
            "Tendencias",

        educational:
            "Educativo",

        discoverContent:
            "Descubrir contenido relevante",

        searchingYoutube:
            "Buscando en YouTube",

        findingVideos:
            "Buscando vídeos relevantes...",

        aiAnalysis:
            "Análisis de IA",

        analyzing:
            "Analizando audio y texto OCR...",

        semanticMatch:
            "Coincidencia semántica",

        calculating:
            "Calculando puntuaciones de confianza...",

        results:
            "Resultados",

        preparing:
            "Preparando recomendaciones...",

        whyRecommended:
            "Por qué se recomienda:",

        watchVideo:
            "Ver vídeo",

        match:
            "Coincidencia",

        noResults:
            "No se encontraron resultados.",

        processing:
            "Procesando...",

        processingMessage:
            "La IA está extrayendo la transcripción. Espera un momento e inténtalo de nuevo.",

        errorDetails:
            "Detalles del error",

        requestTimeout:
            "La solicitud tardó demasiado. Inténtalo de nuevo.",

        noHistory:
            "No se encontró historial de búsqueda.",

        historyError:
            "Error al cargar el historial.",

        deleteHistory:
            "¿Eliminar este elemento del historial?",

        backendError:
            "No se pudo conectar con el backend."

    },


    /* =====================================================
       FRENCH
       ===================================================== */

    fr: {

        brandTagline:
            "Recherche et découverte",

        newSearch:
            "Nouvelle recherche",

        history:
            "HISTORIQUE",

        bookmarks:
            "Favoris",

        collections:
            "Collections",

        settings:
            "Paramètres",

        searchReady:
            "Recherche prête",

        subtitle:
            "Recherchez, découvrez et analysez des informations instantanément.",

        searchPlaceholder:
            "Rechercher quelque chose...",

        all:
            "Tous",

        images:
            "Images",

        videos:
            "Vidéos",

        discovery:
            "Découverte",

        trending:
            "Tendances",

        educational:
            "Éducatif",

        discoverContent:
            "Découvrir du contenu pertinent",

        searchingYoutube:
            "Recherche sur YouTube",

        findingVideos:
            "Recherche de vidéos pertinentes...",

        aiAnalysis:
            "Analyse IA",

        analyzing:
            "Analyse de l'audio et du texte OCR...",

        semanticMatch:
            "Correspondance sémantique",

        calculating:
            "Calcul des scores de pertinence...",

        results:
            "Résultats",

        preparing:
            "Préparation des recommandations...",

        whyRecommended:
            "Pourquoi recommandé :",

        watchVideo:
            "Regarder la vidéo",

        match:
            "Correspondance",

        noResults:
            "Aucun résultat trouvé.",

        processing:
            "Traitement...",

        processingMessage:
            "L'IA extrait la transcription. Attendez un instant puis réessayez.",

        errorDetails:
            "Détails de l'erreur",

        requestTimeout:
            "La requête a pris trop de temps. Veuillez réessayer.",

        noHistory:
            "Aucun historique de recherche trouvé.",

        historyError:
            "Erreur lors du chargement de l'historique.",

        deleteHistory:
            "Supprimer cet élément de l'historique ?",

        backendError:
            "Impossible de se connecter au backend."

    },


    /* =====================================================
       TAMIL
       ===================================================== */

    ta: {

        brandTagline:
            "தேடல் மற்றும் கண்டுபிடிப்பு",

        newSearch:
            "புதிய தேடல்",

        history:
            "வரலாறு",

        bookmarks:
            "புக்மார்க்குகள்",

        collections:
            "தொகுப்புகள்",

        settings:
            "அமைப்புகள்",

        searchReady:
            "தேடல் தயார்",

        subtitle:
            "தகவல்களை உடனடியாக தேடி, கண்டறிந்து, பகுப்பாய்வு செய்யுங்கள்.",

        searchPlaceholder:
            "எதையும் தேடுங்கள்...",

        all:
            "அனைத்தும்",

        images:
            "படங்கள்",

        videos:
            "வீடியோக்கள்",

        discovery:
            "கண்டுபிடிப்பு",

        trending:
            "பிரபலமானவை",

        educational:
            "கல்வி",

        discoverContent:
            "தொடர்புடைய உள்ளடக்கத்தைக் கண்டறியவும்",

        searchingYoutube:
            "YouTube-ல் தேடுகிறது",

        findingVideos:
            "தொடர்புடைய வீடியோக்களைத் தேடுகிறது...",

        aiAnalysis:
            "AI பகுப்பாய்வு",

        analyzing:
            "ஆடியோ மற்றும் OCR உரையைப் பகுப்பாய்வு செய்கிறது...",

        semanticMatch:
            "சொற்பொருள் பொருத்தம்",

        calculating:
            "நம்பகத்தன்மை மதிப்பெண்களை கணக்கிடுகிறது...",

        results:
            "முடிவுகள்",

        preparing:
            "பரிந்துரைகளைத் தயாரிக்கிறது...",

        whyRecommended:
            "ஏன் பரிந்துரைக்கப்பட்டது:",

        watchVideo:
            "வீடியோவைப் பார்க்கவும்",

        match:
            "பொருத்தம்",

        noResults:
            "தேடல் முடிவுகள் எதுவும் கிடைக்கவில்லை.",

        processing:
            "செயலாக்குகிறது...",

        processingMessage:
            "AI டிரான்ஸ்கிரிப்ட்டை பிரித்தெடுக்கிறது. சிறிது நேரம் காத்திருந்து மீண்டும் முயற்சிக்கவும்.",

        errorDetails:
            "பிழை விவரங்கள்",

        requestTimeout:
            "கோரிக்கை அதிக நேரம் எடுத்துக்கொண்டது. மீண்டும் முயற்சிக்கவும்.",

        noHistory:
            "தேடல் வரலாறு எதுவும் இல்லை.",

        historyError:
            "வரலாற்றை ஏற்றுவதில் பிழை.",

        deleteHistory:
            "இந்த வரலாற்றை நீக்கவா?",

        backendError:
            "Backend-ஐ இணைக்க முடியவில்லை."

    },


    /* =====================================================
       TELUGU
       ===================================================== */

    te: {

        brandTagline:
            "శోధన మరియు అన్వేషణ",

        newSearch:
            "కొత్త శోధన",

        history:
            "చరిత్ర",

        bookmarks:
            "బుక్‌మార్క్‌లు",

        collections:
            "సేకరణలు",

        settings:
            "సెట్టింగ్‌లు",

        searchReady:
            "శోధన సిద్ధంగా ఉంది",

        subtitle:
            "సమాచారాన్ని వెంటనే శోధించండి, కనుగొనండి మరియు విశ్లేషించండి.",

        searchPlaceholder:
            "ఏదైనా శోధించండి...",

        all:
            "అన్నీ",

        images:
            "చిత్రాలు",

        videos:
            "వీడియోలు",

        discovery:
            "అన్వేషణ",

        trending:
            "ట్రెండింగ్",

        educational:
            "విద్యా",

        discoverContent:
            "సంబంధిత కంటెంట్‌ను కనుగొనండి",

        searchingYoutube:
            "YouTubeలో శోధిస్తోంది",

        findingVideos:
            "సంబంధిత వీడియోలను కనుగొంటోంది...",

        aiAnalysis:
            "AI విశ్లేషణ",

        analyzing:
            "ఆడియో మరియు OCR టెక్స్ట్‌ను విశ్లేషిస్తోంది...",

        semanticMatch:
            "సెమాంటిక్ మ్యాచ్",

        calculating:
            "నమ్మక స్కోర్‌లను లెక్కిస్తోంది...",

        results:
            "ఫలితాలు",

        preparing:
            "సిఫార్సులను సిద్ధం చేస్తోంది...",

        whyRecommended:
            "ఎందుకు సిఫార్సు చేయబడింది:",

        watchVideo:
            "వీడియో చూడండి",

        match:
            "మ్యాచ్",

        noResults:
            "ఫలితాలు ఏవీ కనుగొనబడలేదు.",

        processing:
            "ప్రాసెస్ చేస్తోంది...",

        processingMessage:
            "AI ట్రాన్స్‌క్రిప్ట్‌ను తీస్తోంది. కొద్దిసేపు వేచి ఉండి మళ్లీ ప్రయత్నించండి.",

        errorDetails:
            "లోపం వివరాలు",

        requestTimeout:
            "అభ్యర్థనకు చాలా సమయం పట్టింది. మళ్లీ ప్రయత్నించండి.",

        noHistory:
            "శోధన చరిత్ర ఏదీ కనుగొనబడలేదు.",

        historyError:
            "చరిత్రను లోడ్ చేయడంలో లోపం.",

        deleteHistory:
            "ఈ చరిత్ర అంశాన్ని తొలగించాలా?",

        backendError:
            "Backendకు కనెక్ట్ కాలేకపోయింది."

    }

};


/* =========================================================
   APPLY SELECTED LANGUAGE
   ========================================================= */

function applyLanguage(lang) {

    const t =
        translations[lang] || translations.en;


    /* -------------------------------------------------------
       SIDEBAR
       ------------------------------------------------------- */

    const brandTagline =
        document.querySelector(".brand-tagline");

    if (brandTagline) {
        brandTagline.textContent =
            t.brandTagline;
    }


    const newSearchText =
        document.querySelector("#newSearchBtn span");

    if (newSearchText) {
        newSearchText.textContent =
            t.newSearch;
    }


    const historyTitle =
        document.querySelector(
            ".history-section .section-title span"
        );

    if (historyTitle) {
        historyTitle.textContent =
            t.history;
    }


    const footerItems =
        document.querySelectorAll(
            ".footer-nav .nav-item span"
        );


    if (footerItems.length >= 3) {

        footerItems[0].textContent =
            t.bookmarks;

        footerItems[1].textContent =
            t.collections;

        footerItems[2].textContent =
            t.settings;

    }


    /* -------------------------------------------------------
       TOP STATUS
       ------------------------------------------------------- */

    const statusText =
        document.querySelector(".status-text");

    if (statusText) {
        statusText.textContent =
            t.searchReady;
    }


    /* -------------------------------------------------------
       HERO
       ------------------------------------------------------- */

    const subtitle =
        document.querySelector(".hero-subtitle");

    if (subtitle) {
        subtitle.textContent =
            t.subtitle;
    }


    const searchInput =
        document.querySelector("#searchInput");

    if (searchInput) {
        searchInput.placeholder =
            t.searchPlaceholder;
    }


    /* -------------------------------------------------------
       CATEGORY TABS
       ------------------------------------------------------- */

    const tabs =
        document.querySelectorAll(".tab-btn");


    tabs.forEach(tab => {

        const category =
            tab.dataset.category;


        const icon =
            tab.querySelector("i");


        let text = "";


        if (category === "all") {
            text = t.all;
        }

        else if (category === "images") {
            text = t.images;
        }

        else if (category === "videos") {
            text = t.videos;
        }

        else if (category === "for-you") {
            text = t.discovery;
        }

        else if (category === "trending") {
            text = t.trending;
        }

        else if (category === "educational") {
            text = t.educational;
        }


        /*
           Keep the Lucide icon.
        */

        tab.innerHTML = "";


        if (icon) {
            tab.appendChild(icon);
        }


        tab.appendChild(
            document.createTextNode(" " + text)
        );

    });


    /* -------------------------------------------------------
       DISCOVERY HEADING
       ------------------------------------------------------- */

    const discoveryHeading =
        document.querySelector(
            ".section-title-heading"
        );


    if (discoveryHeading) {

        discoveryHeading.textContent =
            t.discoverContent;

    }


    /* -------------------------------------------------------
       HTML LANGUAGE
       ------------------------------------------------------- */

    document.documentElement.lang =
        lang;


    /*
       IMPORTANT:

       If results are already visible,
       render them again using the new language.

       The user does NOT have to search again.
    */

    if (
        state.lastResults &&
        state.lastResults.length > 0
    ) {

        renderResults(state.lastResults);

    }


    /*
       Also refresh history text.
    */

    loadHistoryFromDB();
}