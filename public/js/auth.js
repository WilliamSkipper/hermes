// ── Hermes Token Authentication ────────────────────────────────────────────

(function () {
    const STORAGE_KEY = 'hermes_token';

    const gate       = document.getElementById('auth-gate');
    const appShell   = document.getElementById('app-shell');
    const tokenInput = document.getElementById('token-input');
    const btnAuth    = document.getElementById('btn-auth');
    const btnPeek    = document.getElementById('btn-peek');
    const authError  = document.getElementById('auth-error');
    const authBadge  = document.getElementById('auth-badge');
    const remembered = document.getElementById('auth-remembered');
    const authArrow  = document.getElementById('auth-arrow');

    // ── Show / hide token ─────────────────────────────────────────────────

    btnPeek.addEventListener('click', () => {
        const hidden        = tokenInput.type === 'password';
        tokenInput.type     = hidden ? 'text' : 'password';
        btnPeek.textContent = hidden ? '🙈' : '👁';
    });

    // ── Server validation ─────────────────────────────────────────────────

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

    // ── Grant / revoke access ─────────────────────────────────────────────

    function grantAccess(token) {
        localStorage.setItem(STORAGE_KEY, token);
        gate.classList.add('hidden');
        appShell.classList.add('visible');
        authBadge.classList.add('visible');
    }

    function revokeAccess() {
        localStorage.removeItem(STORAGE_KEY);
        appShell.classList.remove('visible');
        authBadge.classList.remove('visible');
        gate.classList.remove('hidden');
        tokenInput.value = '';
        authError.classList.remove('visible');
        remembered.classList.remove('visible');
    }

    // ── Input shake on failure ────────────────────────────────────────────

    function shakeInput() {
        tokenInput.classList.remove('shake');
        void tokenInput.offsetWidth; // reflow to restart animation
        tokenInput.classList.add('shake');
        tokenInput.addEventListener('animationend', () => {
            tokenInput.classList.remove('shake');
        }, { once: true });
    }

    // ── Attempt authentication ────────────────────────────────────────────

    async function attemptAuth() {
        const token = tokenInput.value.trim();
        if (!token) {
            shakeInput();
            return;
        }

        btnAuth.disabled      = true;
        authArrow.textContent = '⟳';
        authError.classList.remove('visible');

        const valid = await validateToken(token);

        btnAuth.disabled      = false;
        authArrow.textContent = '→';

        if (valid) {
            grantAccess(token);
        } else {
            localStorage.removeItem(STORAGE_KEY);
            authError.classList.add('visible');
            shakeInput();
            tokenInput.select();
        }
    }

    // ── Sign out on badge click ───────────────────────────────────────────

    // authBadge.addEventListener('click', revokeAccess);

    // ── Button & keyboard listeners ───────────────────────────────────────

    btnAuth.addEventListener('click', attemptAuth);
    tokenInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptAuth();
    });

    // ── Auto-check stored token on page load ──────────────────────────────

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        remembered.classList.add('visible');
        tokenInput.value = stored;
        validateToken(stored).then(valid => {
            if (valid) {
                grantAccess(stored);
            } else {
                localStorage.removeItem(STORAGE_KEY);
                remembered.classList.remove('visible');
                tokenInput.value = '';
            }
        });
    }
})();