// ── Theme ──────────────────────────────────────────────────────────────────
function initTheme() {
    const root  = document.documentElement;
    const btn   = document.getElementById('theme-toggle');
    const icon  = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');

    function applyTheme(t) {
        root.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
        icon.textContent  = t === 'dark' ? '☀️' : '🌙';
        label.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
    }

    applyTheme(root.getAttribute('data-theme') || 'dark');
    btn.addEventListener('click', () => {
        applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
}

// ── Format selector ────────────────────────────────────────────────────────
function initFormatButtons() {
    document.querySelectorAll('.fmt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ── Clear ──────────────────────────────────────────────────────────────────
function initClear() {
    document.getElementById('btn-clear').addEventListener('click', () => {
        document.getElementById('url-input').value = '';
        document.getElementById('url-input').focus();
        setStatus('idle', 'Ready.');
    });
}

// ── Status ─────────────────────────────────────────────────────────────────
function setStatus(state, text) {
    const box = document.getElementById('status-box');
    const txt = document.getElementById('status-text');
    box.className = 'status-box' + (state !== 'idle' ? ' ' + state : '');
    txt.textContent = text;
}

// ── Download ───────────────────────────────────────────────────────────────
function initDownload() {
    const btn     = document.getElementById('btn-download');
    const labelEl = document.getElementById('dl-label');
    const arrowEl = document.getElementById('dl-arrow');

    function triggerDownload() {
        const url  = document.getElementById('url-input').value.trim();
        const mode = document.querySelector('.fmt-btn.active')?.dataset.mode;

        if (!url) {
            setStatus('error', 'Paste a YouTube URL first.');
            document.getElementById('url-input').focus();
            return;
        }

        // Build a hidden form and submit it. This is a real browser navigation
        // so Safari on iOS will show its native download prompt when the server
        // responds with Content-Disposition: attachment.
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

        setStatus('pending', 'Processing… this may take a moment.');
        btn.disabled        = true;
        labelEl.textContent = 'DOWNLOADING…';
        arrowEl.textContent = '⟳';

        form.submit();
        document.body.removeChild(form);

        // Re-enable UI after a delay — we can't detect completion since the
        // browser navigates away for the download, then stays on the page.
        setTimeout(() => {
            btn.disabled        = false;
            labelEl.textContent = 'DOWNLOAD';
            arrowEl.textContent = '→';
            setStatus('success', '✓ Download started.');
        }, 3000);
    }

    btn.addEventListener('click', triggerDownload);
    document.getElementById('url-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') triggerDownload();
    });
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFormatButtons();
    initClear();
    initDownload();
});
