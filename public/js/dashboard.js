// ── Theme Management ───────────────────────────────────────────────────────
function initTheme() {
    const root     = document.documentElement;
    const btn      = document.getElementById('theme-toggle');
    const sunIcon  = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const label    = document.getElementById('theme-label');

    if (!btn) return;

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const isDark = theme === 'dark';
        if (sunIcon)  sunIcon.style.display  = isDark ? 'block' : 'none';
        if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
        if (label)    label.textContent      = isDark ? 'LIGHT' : 'DARK';
    }

    applyTheme(root.getAttribute('data-theme') || 'dark');

    btn.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });
}

// ── Format Selector ────────────────────────────────────────────────────────
function initFormatButtons() {
    const formatButtons = document.querySelectorAll('.fmt-btn');
    formatButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            formatButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-checked', 'true');
        });
    });
}

// ── Status Management ──────────────────────────────────────────────────────
function setStatus(state, message) {
    const box   = document.getElementById('status-box');
    const badge = document.getElementById('status-badge');
    const txt   = document.getElementById('status-text');

    if (!box || !badge || !txt) return;

    box.className = 'status-console' + (state !== 'idle' ? ' ' + state : '');

    const badgeMap = {
        idle:    'READY',
        pending: 'CONVERTING',
        success: 'COMPLETED',
        error:   'ERROR',
    };

    badge.textContent = badgeMap[state] || 'STATUS';
    txt.textContent   = message;
}

// ── Clear Action ───────────────────────────────────────────────────────────
function initClear() {
    const clearBtn = document.getElementById('btn-clear');
    const urlInput = document.getElementById('url-input');

    if (!clearBtn || !urlInput) return;

    clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        urlInput.focus();
        setStatus('idle', 'Workstation idle. Awaiting target stream URL.');
    });
}

// ── Paste Action ───────────────────────────────────────────────────────────
function initPaste() {
    const pasteBtn = document.getElementById('btn-paste');
    const urlInput = document.getElementById('url-input');

    if (!pasteBtn || !urlInput) return;

    pasteBtn.addEventListener('click', async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text) {
                    urlInput.value = text.trim();
                    urlInput.focus();
                    setStatus('idle', 'URL loaded from clipboard. Ready to convert.');
                    return;
                }
            }
        } catch (_) {
            // Clipboard access denied or unsupported; smoothly fall back to manual focus
        }
        urlInput.focus();
    });
}

// ── Download Execution ─────────────────────────────────────────────────────
function initDownload() {
    const btn      = document.getElementById('btn-download');
    const labelEl  = document.getElementById('dl-label');
    const urlInput = document.getElementById('url-input');

    if (!btn || !labelEl || !urlInput) return;

    function triggerDownload() {
        const url  = urlInput.value.trim();
        const mode = document.querySelector('.fmt-btn.active')?.dataset.mode || 'mp4';

        if (!url) {
            setStatus('error', 'Target stream URL is required. Paste a valid media link to proceed.');
            urlInput.focus();
            return;
        }

        // Build hidden form and submit
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/download';

        const fUrl = document.createElement('input');
        fUrl.type  = 'hidden';
        fUrl.name  = 'url';
        fUrl.value = url;

        const fMode = document.createElement('input');
        fMode.type  = 'hidden';
        fMode.name  = 'mode';
        fMode.value = mode;

        const fToken = document.createElement('input');
        fToken.type  = 'hidden';
        fToken.name  = 'token';
        fToken.value = localStorage.getItem('hermes_token') || '';

        form.appendChild(fUrl);
        form.appendChild(fMode);
        form.appendChild(fToken);
        document.body.appendChild(form);

        setStatus('pending', 'Processing stream pipeline via yt-dlp and FFmpeg… Please wait.');
        btn.disabled        = true;
        labelEl.textContent = 'CONVERTING STREAM…';

        form.submit();
        document.body.removeChild(form);

        // Reset UI state after transmission has commenced
        setTimeout(() => {
            btn.disabled        = false;
            labelEl.textContent = 'INITIALIZE CONVERSION';
            setStatus('success', 'Stream dispatched successfully. Browser download started.');
        }, 3500);
    }

    btn.addEventListener('click', triggerDownload);
    urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') triggerDownload();
    });
}

// ── System Modal Information Dialogs ───────────────────────────────────────
function initSystemModals() {
    const modal        = document.getElementById('system-modal');
    const modalTitle   = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const btnClose     = document.getElementById('btn-close-modal');
    const btnDismiss   = document.getElementById('btn-dismiss-modal');

    const btnSpecs     = document.getElementById('btn-open-specs');
    const btnPrivacy   = document.getElementById('btn-open-privacy');
    const btnAccess    = document.getElementById('btn-open-accessibility');

    if (!modal || !modalTitle || !modalContent) return;

    const modalData = {
        specs: {
            title: 'ENGINE SPECIFICATIONS',
            body: `
                <h3>Pipeline Architecture</h3>
                <p>Hermes interfaces directly with the yt-dlp core extractor, piping raw streams through FFmpeg 7.x audio and video processing modules.</p>
                <h3>Audio Transcoding Parameters</h3>
                <p>Audio streams extracted via MP3 Full are encoded with LAME at 192 kbps Variable Bitrate (VBR), injecting ID3v2.3 tags with front album art cropped to 1:1 aspect ratio.</p>
                <h3>Playlist Processing</h3>
                <p>Multi-track playlist queries are captured iteratively with error tolerance, bundled into uncompressed or deflated ZIP archives, and streamed as single binary archives.</p>
            `,
        },
        privacy: {
            title: 'DATA PRIVACY & LOCAL SANDBOX',
            body: `
                <h3>Zero External Telemetry</h3>
                <p>Hermes operates in a strictly local execution sandbox. No user telemetry, query history, IP logs, or analytics beacons are generated or sent to third-party endpoints.</p>
                <h3>Token & Session Storage</h3>
                <p>Session access tokens are persisted strictly within your client browser local storage (<code>localStorage</code>) to enable fast reconnects. They are never sent to external servers beyond the local authentication endpoint.</p>
                <h3>Temporary File Scrubbing</h3>
                <p>All downloaded chunks and interim transcode fragments reside inside ephemeral operating system temporary directories and are removed immediately following transfer completion.</p>
            `,
        },
        accessibility: {
            title: 'ACCESSIBILITY CONFORMANCE (WCAG 2.2 AA)',
            body: `
                <h3>Compliance Mandates</h3>
                <p>Hermes is designed to conform with the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA, Americans with Disabilities Act (ADA Title III), and European Accessibility Act (EAA).</p>
                <h3>Keyboard Navigation & Screen Readers</h3>
                <p>All interactive elements maintain unobstructed tab order, programmatic label associations, and high-contrast focus rings. Live status announcements utilize ARIA status regions.</p>
                <h3>Motion & Contrast Standards</h3>
                <p>Surfaces maintain contrast ratios exceeding 4.5:1 for body copy and 3:1 for control borders. System preferences for reduced motion (<code>prefers-reduced-motion</code>) are fully respected.</p>
            `,
        },
    };

    function openModal(key) {
        const data = modalData[key];
        if (!data) return;
        modalTitle.textContent = data.title;
        modalContent.innerHTML = data.body;
        modal.style.display    = 'flex';
        modal.classList.add('active');
        if (btnClose) btnClose.focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    if (btnSpecs)   btnSpecs.addEventListener('click',   () => openModal('specs'));
    if (btnPrivacy) btnPrivacy.addEventListener('click', () => openModal('privacy'));
    if (btnAccess)  btnAccess.addEventListener('click',  () => openModal('accessibility'));

    if (btnClose)   btnClose.addEventListener('click',   closeModal);
    if (btnDismiss) btnDismiss.addEventListener('click', closeModal);

    modal.addEventListener('click', e => {
        if (e.target === modal || e.target.classList.contains('modal-scrim')) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ── Initialization on DOM Ready ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFormatButtons();
    initClear();
    initPaste();
    initDownload();
    initSystemModals();
});
