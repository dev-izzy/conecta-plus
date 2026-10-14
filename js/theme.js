// Tema claro/escuro compartilhado entre index.html, amigos.html e usuario.html
function getStoredTheme() {
    return localStorage.getItem(STORAGE_KEYS.theme) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.classList.toggle('active', theme === 'dark');
        const circle = toggle.querySelector('.toggle-circle');
        if (circle) circle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    const settingsCheckbox = document.getElementById('settingsThemeToggle');
    if (settingsCheckbox) settingsCheckbox.checked = theme === 'dark';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#161320' : '#004C94');
}

function toggleTheme() {
    const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    applyTheme(nextTheme);
}

applyTheme(getStoredTheme());

const themeToggleButton = document.getElementById('themeToggle');
if (themeToggleButton) {
    themeToggleButton.addEventListener('click', toggleTheme);
}
