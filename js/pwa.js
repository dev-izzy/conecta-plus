// Registra o service worker para o Conecta+ funcionar como PWA
// (instalável e com acesso básico offline às páginas já visitadas).
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // Se o navegador bloquear (ex.: abrindo o arquivo direto sem
            // servidor local), a página continua funcionando normalmente.
        });
    });
}
