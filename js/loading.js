(function () {
    const bar = document.getElementById('globalLoading');
    if (!bar) return;

    const screen = document.createElement('div');
    screen.className = 'auth-loading-overlay';
    screen.hidden = true;
    screen.setAttribute('role', 'status');
    screen.setAttribute('aria-live', 'polite');
    screen.innerHTML = '<div class="auth-loading-card"><span class="auth-loading-spinner" aria-hidden="true"></span><strong class="auth-loading-label"></strong></div>';
    document.body.appendChild(screen);
    let screenTimer;

    window.ConectaLoading = {
        showScreen(message) {
            clearTimeout(screenTimer);
            screen.querySelector('.auth-loading-label').textContent = message || 'Carregando...';
            screen.hidden = false;
            requestAnimationFrame(() => screen.classList.add('is-visible'));
        },
        hideScreen() {
            clearTimeout(screenTimer);
            screen.classList.remove('is-visible');
            screenTimer = setTimeout(() => { screen.hidden = true; }, 180);
        }
    };

    let activeRequests = 0;
    let showTimer;
    let hideTimer;
    let navigationStarted = true;

    function show() {
        clearTimeout(hideTimer);
        if (!bar.classList.contains('is-visible')) {
            bar.classList.add('is-visible');
            bar.setAttribute('aria-hidden', 'false');
        }
    }

    function start() {
        clearTimeout(showTimer);
        showTimer = setTimeout(show, 140);
    }

    function finish() {
        clearTimeout(showTimer);
        hideTimer = setTimeout(() => {
            if (activeRequests === 0 && !navigationStarted) {
                bar.classList.remove('is-visible');
                bar.setAttribute('aria-hidden', 'true');
            }
        }, 180);
    }

    if (window.fetch) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = function (...args) {
            activeRequests += 1;
            start();
            return originalFetch(...args).finally(() => {
                activeRequests = Math.max(0, activeRequests - 1);
                if (!activeRequests) finish();
            });
        };
    }

    if (document.readyState === 'complete') {
        navigationStarted = false;
        finish();
    } else {
        window.addEventListener('load', () => {
            navigationStarted = false;
            finish();
        }, { once: true });
    }

    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.hash) return;
        navigationStarted = true;
        start();
    });

    window.addEventListener('pagehide', () => {
        navigationStarted = false;
        activeRequests = 0;
        finish();
    });
})();
