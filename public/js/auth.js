// ── Hermes Token Authentication ────────────────────────────────────────────

(function () {
    const STORAGE_KEY = 'hermes_token';

    const gate           = document.getElementById('auth-gate');
    const appShell       = document.getElementById('app-shell');
    const tokenInput     = document.getElementById('token-input');
    const tokenGroup     = document.querySelector('.token-input-group');
    const btnAuth        = document.getElementById('btn-auth');
    const btnPeek        = document.getElementById('btn-peek');
    const authError      = document.getElementById('auth-error');
    const authBadge      = document.getElementById('auth-badge');
    const remembered     = document.getElementById('auth-remembered');
    const authBtnLabel   = document.getElementById('auth-btn-label');
    const btnDisconnect  = document.getElementById('btn-disconnect');

    // ── Show / Hide Token Action ──────────────────────────────────────────

    if (btnPeek && tokenInput) {
        const peekShow = btnPeek.querySelector('.icon-peek-show');
        const peekHide = btnPeek.querySelector('.icon-peek-hide');

        btnPeek.addEventListener('click', () => {
            const isPassword = tokenInput.type === 'password';
            tokenInput.type  = isPassword ? 'text' : 'password';

            if (peekShow && peekHide) {
                peekShow.style.display = isPassword ? 'none' : 'block';
                peekHide.style.display = isPassword ? 'block' : 'none';
            }
            btnPeek.setAttribute('aria-label', isPassword ? 'Hide token' : 'Show token');
            btnPeek.setAttribute('title', isPassword ? 'Hide token' : 'Show token');
            tokenInput.focus();
        });
    }

    // ── Server Validation ─────────────────────────────────────────────────

    async function validateToken(token) {
        try {
            const res = await fetch('/auth', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ token }),
            });
            if (res.ok) {
                const data = await res.json();
                return data.valid === true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    // ── Grant / Revoke Access ─────────────────────────────────────────────

    function grantAccess(token) {
        localStorage.setItem(STORAGE_KEY, token);
        if (gate) gate.classList.add('hidden');
        if (appShell) appShell.classList.add('visible');
        if (authBadge) authBadge.classList.add('visible');
        if (tokenGroup) tokenGroup.classList.remove('invalid');
        if (authError) authError.classList.remove('visible');
        if (remembered) remembered.classList.remove('visible');

        // Autofocus URL input for instant user productivity
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            setTimeout(() => urlInput.focus(), 150);
        }
    }

    function revokeAccess() {
        localStorage.removeItem(STORAGE_KEY);
        if (appShell) appShell.classList.remove('visible');
        if (authBadge) authBadge.classList.remove('visible');
        if (gate) gate.classList.remove('hidden');
        if (tokenInput) {
            tokenInput.value = '';
            tokenInput.focus();
        }
        if (authError) authError.classList.remove('visible');
        if (remembered) remembered.classList.remove('visible');
        if (tokenGroup) tokenGroup.classList.remove('invalid');
    }

    // ── Input Shake on Failure ────────────────────────────────────────────

    function shakeInput() {
        if (!tokenInput) return;
        tokenInput.classList.remove('shake');
        void tokenInput.offsetWidth; // reflow trigger
        tokenInput.classList.add('shake');
        tokenInput.addEventListener('animationend', () => {
            tokenInput.classList.remove('shake');
        }, { once: true });
    }

    // ── Attempt Authentication ────────────────────────────────────────────

    async function attemptAuth() {
        if (!tokenInput || !btnAuth) return;
        const token = tokenInput.value.trim();
        if (!token) {
            if (tokenGroup) tokenGroup.classList.add('invalid');
            shakeInput();
            tokenInput.focus();
            return;
        }

        btnAuth.disabled = true;
        if (authBtnLabel) authBtnLabel.textContent = 'VERIFYING CREDENTIALS…';
        if (authError) authError.classList.remove('visible');
        if (tokenGroup) tokenGroup.classList.remove('invalid');

        const valid = await validateToken(token);

        btnAuth.disabled = false;
        if (authBtnLabel) authBtnLabel.textContent = 'UNLOCK WORKSTATION';

        if (valid) {
            grantAccess(token);
        } else {
            localStorage.removeItem(STORAGE_KEY);
            if (authError) authError.classList.add('visible');
            if (tokenGroup) tokenGroup.classList.add('invalid');
            shakeInput();
            tokenInput.select();
        }
    }

    // ── Event Listeners ───────────────────────────────────────────────────

    if (btnAuth) btnAuth.addEventListener('click', attemptAuth);
    if (tokenInput) {
        tokenInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') attemptAuth();
        });
        tokenInput.addEventListener('input', () => {
            if (tokenGroup) tokenGroup.classList.remove('invalid');
            if (authError) authError.classList.remove('visible');
        });
    }

    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', revokeAccess);
    }

    // ── Auto-Check Stored Token on Load ───────────────────────────────────

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        if (remembered) remembered.classList.add('visible');
        if (tokenInput) tokenInput.value = stored;
        validateToken(stored).then(valid => {
            if (valid) {
                grantAccess(stored);
            } else {
                localStorage.removeItem(STORAGE_KEY);
                if (remembered) remembered.classList.remove('visible');
                if (tokenInput) {
                    tokenInput.value = '';
                    tokenInput.focus();
                }
            }
        });
    } else {
        if (tokenInput) tokenInput.focus();
    }
})();
