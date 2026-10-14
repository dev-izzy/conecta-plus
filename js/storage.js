// Ponto único das chaves de localStorage usadas pelo Conecta+, para não
// espalhar strings repetidas por vários arquivos.
const STORAGE_KEYS = {
    user: 'muralConectaUser',
    session: 'muralConectaSession',
    profile: 'muralConectaProfile',
    posts: 'muralConectaPosts',
    likedPosts: 'muralConectaLikedPosts',
    friends: 'muralConectaFriends',
    sentRequests: 'muralConectaSentRequests',
    receivedRequests: 'muralConectaReceivedRequests',
    messages: 'muralConectaMessages',
    theme: 'muralConectaTheme'
};

// Todas as chaves de dados da conta (usadas para "apagar meus dados").
// Não inclui 'theme', que é uma preferência do navegador, não da conta.
const ACCOUNT_STORAGE_KEYS = Object.keys(STORAGE_KEYS)
    .filter(key => key !== 'theme')
    .map(key => STORAGE_KEYS[key]);

function getJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

async function compressImageFile(file, { maxDimension = 1280, quality = 0.78 } = {}) {
    if (!file || !file.type?.startsWith('image/') || /gif|svg|heic|heif/i.test(file.type)) return file;
    if (!window.createImageBitmap || !HTMLCanvasElement.prototype.toBlob) return file;

    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 350 * 1024) return file;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) return file;
        const extension = blob.type === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'img';
        const name = `${file.name.replace(/\.[^.]+$/, '')}.${extension}`;
        return new File([blob], name, { type: blob.type || file.type, lastModified: Date.now() });
    } catch (error) {
        console.warn('Nao foi possivel comprimir esta imagem; o arquivo original sera usado.', error);
        return file;
    } finally {
        bitmap?.close?.();
    }
}

function imageFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'));
        reader.readAsDataURL(file);
    });
}

function getPublicContactHref(value) {
    const contact = String(value || '').trim();
    if (!contact) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        return `mailto:${contact}`;
    }
    if (!/^[+\d\s().-]+$/.test(contact)) return '';
    let digits = contact.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    return digits.length >= 12 && digits.length <= 15 ? `https://wa.me/${digits}` : '';
}

// Hash simples só para não guardar a senha em texto puro no localStorage.
// IMPORTANTE: isso NÃO é segurança de verdade — é só ofuscação para uma
// demo 100% front-end. Um sistema real faria isso no servidor, com sal.
function simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

function getAccount() {
    return getJSON(STORAGE_KEYS.user, null);
}

function isLoggedIn() {
    return localStorage.getItem(STORAGE_KEYS.session) === 'true';
}

function setLoggedIn(value) {
    if (value) {
        localStorage.setItem(STORAGE_KEYS.session, 'true');
    } else {
        localStorage.removeItem(STORAGE_KEYS.session);
    }
}

function clearAccountData() {
    ACCOUNT_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
}
