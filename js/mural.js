const userIcon = document.getElementById('userIcon');
const userMenu = document.getElementById('userMenu');
const openRegister = document.getElementById('openRegister');
const openLogin = document.getElementById('openLogin');
const registerModal = document.getElementById('registerModal');
const closeRegister = document.getElementById('closeRegister');
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');
const loginModal = document.getElementById('loginModal');
const closeLogin = document.getElementById('closeLogin');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const switchToRegister = document.getElementById('switchToRegister');
const muralSearch = document.getElementById('muralSearch');
const profileMenuLink = document.getElementById('profileMenuLink');
const logoutLink = document.getElementById('logoutLink');

const DEFAULT_PROFILE = {
    bio: 'Conte para a comunidade quais serviços você oferece.',
    color: '#004c94',
    image: '',
    coverColor: '#004c94',
    coverImage: ''
};

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[character]));
}

function formatPrice(price) {
    if (price == null || price === '') return '';
    return Number(price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateAccountUI() {
    const account = getAccount();
    const loggedIn = isLoggedIn() && account;

    if (openRegister) openRegister.hidden = Boolean(loggedIn);
    if (openLogin) openLogin.hidden = Boolean(loggedIn);
    if (profileMenuLink) profileMenuLink.hidden = !loggedIn;
    if (logoutLink) logoutLink.hidden = !loggedIn;

    const profile = getJSON(STORAGE_KEYS.profile, null);
    if (userIcon) {
        if (profile && profile.image) {
            userIcon.style.backgroundImage = `url("${profile.image}")`;
            userIcon.classList.add('has-photo');
        } else {
            userIcon.style.backgroundImage = '';
            userIcon.classList.remove('has-photo');
        }
        userIcon.setAttribute('aria-label', loggedIn ? 'Menu da conta' : 'Menu do perfil');
        userIcon.title = loggedIn ? 'Meu perfil' : 'Perfil do Usuário';
    }
}

let lastFocusedElement = null;

function openModal(modal, focusTarget) {
    lastFocusedElement = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    closeUserMenu();
});

function closeRegisterModal() { closeModal(registerModal); }

function openRegisterModal(event) {
    event.preventDefault();
    event.stopPropagation();
    closeUserMenu();
    openModal(registerModal, document.getElementById('registerName'));
}

if (openRegister && registerModal && closeRegister) {
    openRegister.addEventListener('click', openRegisterModal);
    closeRegister.addEventListener('click', closeRegisterModal);
    registerModal.addEventListener('click', function(event) {
        if (event.target === registerModal) closeRegisterModal();
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim().toLowerCase();
        const password = formData.get('password');
        if (password !== formData.get('passwordConfirmation')) {
            registerMessage.textContent = 'As senhas precisam ser iguais.';
            registerMessage.classList.remove('success');
            return;
        }
        if (!window.ConectaBackend?.configured) {
            registerMessage.textContent = 'Configure o backend Supabase para criar uma conta compartilhada.';
            registerMessage.classList.remove('success');
            return;
        }
        const submitButton = registerForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        window.ConectaLoading?.showScreen('Criando sua conta...');
        let data, error;
        try {
            ({ data, error } = await ConectaBackend.client.auth.signUp({
                email, password, options: { data: { display_name: name } }
            }));
        } catch (requestError) {
            error = requestError;
        } finally {
            window.ConectaLoading?.hideScreen();
            if (submitButton) submitButton.disabled = false;
        }
        if (error) {
            registerMessage.textContent = error.message;
            registerMessage.classList.remove('success');
            return;
        }
        if (data.session) {
            setJSON(STORAGE_KEYS.user, { id: data.user.id, name, email });
            setLoggedIn(true);
        }
        registerMessage.textContent = data.session
            ? `Cadastro realizado, ${name}!`
            : 'Cadastro realizado. Confirme seu e-mail para entrar.';
        registerMessage.classList.add('success');
        registerForm.reset();
        updateAccountUI();
        renderMural();
        if (data.session) setTimeout(closeRegisterModal, 1200);
    });
}
function closeLoginModal() { closeModal(loginModal); }

function openLoginModal(event) {
    event.preventDefault();
    event.stopPropagation();
    closeUserMenu();
    if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.classList.remove('success');
    }
    if (loginForm) loginForm.reset();
    openModal(loginModal, document.getElementById('loginEmail'));
}

if (openLogin && loginModal && closeLogin) {
    openLogin.addEventListener('click', openLoginModal);
    closeLogin.addEventListener('click', closeLoginModal);
    loginModal.addEventListener('click', function(event) {
        if (event.target === loginModal) closeLoginModal();
    });
}

if (switchToRegister) {
    switchToRegister.addEventListener('click', function(event) {
        event.preventDefault();
        closeLoginModal();
        openModal(registerModal, document.getElementById('registerName'));
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        if (!window.ConectaBackend?.configured) {
            loginMessage.textContent = 'Configure o backend Supabase para entrar na conta compartilhada.';
            loginMessage.classList.remove('success');
            return;
        }
        const formData = new FormData(loginForm);
        const email = formData.get('email').trim().toLowerCase();
        const submitButton = loginForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        window.ConectaLoading?.showScreen('Entrando na sua conta...');
        let data, error;
        try {
            ({ data, error } = await ConectaBackend.client.auth.signInWithPassword({ email, password: formData.get('password') }));
            if (!error) {
                const { data: profileData, error: profileError } = await ConectaBackend.client.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
                if (profileError) console.warn('Nao foi possivel carregar o perfil da conta.', profileError);
                data.profile = profileData;
            }
        } catch (requestError) {
            error = requestError;
        } finally {
            window.ConectaLoading?.hideScreen();
            if (submitButton) submitButton.disabled = false;
        }
        if (error) {
            loginMessage.textContent = error.status ? 'E-mail ou senha incorretos.' : 'NÃ£o foi possÃ­vel conectar. Verifique sua internet e tente novamente.';
            loginMessage.classList.remove('success');
            return;
        }
        const profileData = data.profile;
        setJSON(STORAGE_KEYS.user, { id: data.user.id, name: profileData?.display_name || data.user.user_metadata.display_name, email });
        if (profileData) setJSON(STORAGE_KEYS.profile, { name: profileData.display_name, bio: profileData.bio, color: profileData.profile_color, image: profileData.avatar_url || '', coverColor: profileData.cover_color, coverImage: profileData.cover_url || '' });
        setLoggedIn(true);
        loginMessage.textContent = `Bem-vindo de volta, ${data.user.user_metadata.display_name || email}!`;
        loginMessage.classList.add('success');
        updateAccountUI();
        renderMural();
        setTimeout(closeLoginModal, 1000);
    });
}
if (logoutLink) {
    logoutLink.addEventListener('click', async function(event) {
        event.preventDefault();
        event.stopPropagation();

        if (window.ConectaBackend?.configured) await ConectaBackend.client.auth.signOut();
        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.profile);
        setLoggedIn(false);
        updateAccountUI();
        closeUserMenu();
    });
}

const openSettings = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const settingsForm = document.getElementById('settingsForm');
const settingsEmail = document.getElementById('settingsEmail');
const settingsAccountHint = document.getElementById('settingsAccountHint');
const settingsMessage = document.getElementById('settingsMessage');
const settingsThemeToggle = document.getElementById('settingsThemeToggle');
const deleteAccountButton = document.getElementById('deleteAccountButton');

function closeSettingsModal() { closeModal(settingsModal); }

function openSettingsModal(event) {
    event.preventDefault();
    event.stopPropagation();
    closeUserMenu();

    const account = getAccount();
    if (settingsEmail) {
        settingsEmail.value = account ? account.email : '';
        settingsEmail.disabled = !account;
    }
    if (settingsAccountHint) {
        settingsAccountHint.textContent = account
            ? ''
            : 'Crie um cadastro para poder alterar o e-mail da conta.';
    }
    if (settingsThemeToggle) {
        settingsThemeToggle.checked = document.body.classList.contains('dark');
    }
    if (settingsMessage) {
        settingsMessage.textContent = '';
        settingsMessage.classList.remove('success');
    }
    if (deleteAccountButton) {
        deleteAccountButton.hidden = !account || Boolean(window.ConectaBackend?.configured);
    }

    openModal(settingsModal, settingsThemeToggle);
}

if (openSettings && settingsModal && closeSettings) {
    openSettings.addEventListener('click', openSettingsModal);
    closeSettings.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', function(event) {
        if (event.target === settingsModal) closeSettingsModal();
    });
}

if (settingsThemeToggle) {
    settingsThemeToggle.addEventListener('change', function() {
        toggleTheme();
    });
}

if (settingsForm) {
    settingsForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const account = getAccount();
        if (!account) {
            settingsMessage.textContent = 'Crie um cadastro antes de salvar as configurações.';
            settingsMessage.classList.remove('success');
            return;
        }

        const email = settingsEmail.value.trim().toLowerCase();
        if (!email) {
            settingsMessage.textContent = 'Informe um e-mail válido.';
            settingsMessage.classList.remove('success');
            return;
        }

        if (window.ConectaBackend?.configured) {
            const { error } = await ConectaBackend.client.auth.updateUser({ email });
            if (error) {
                settingsMessage.textContent = error.message;
                settingsMessage.classList.remove('success');
                return;
            }
            settingsMessage.textContent = 'Confira seu e-mail para confirmar a alteracao.';
            settingsMessage.classList.add('success');
            return;
        }

        setJSON(STORAGE_KEYS.user, { ...account, email });
        settingsMessage.textContent = 'Configurações salvas!';
        settingsMessage.classList.add('success');
    });
}

if (deleteAccountButton) {
    deleteAccountButton.addEventListener('click', function() {
        const confirmed = window.confirm(
            'Apagar todos os seus dados deste navegador? Isso remove cadastro, perfil, publicações, amigos e mensagens. Essa ação não pode ser desfeita.'
        );
        if (!confirmed) return;

        clearAccountData();
        window.location.href = 'index.html';
    });
}

function cardMatches(card, searchTerm) {
    const haystack = `${card.title} ${card.description} ${card.category} ${card.author || ''} ${card.location || ''}`.toLowerCase();
    return haystack.includes(searchTerm);
}

function renderCard(card) {
    const price = formatPrice(card.price);
    const image = card.image
        ? `<img src="${escapeHtml(card.image)}" alt="" loading="lazy" decoding="async">`
        : `<div class="card-image-placeholder" aria-hidden="true">${card.icon || '◎'}</div>`;

    return `<article class="mural-card" tabindex="0" data-card-id="${escapeHtml(card.id)}">
        <div class="card-image">${image}</div>
        <div class="card-content">
            <p class="card-category">${escapeHtml(card.category)}</p>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.description)}</p>
            ${card.location ? `<p class="card-location"><strong>Local:</strong> ${escapeHtml(card.location)}</p>` : ''}
            ${card.contact ? renderCardContact(card.contact) : ''}
            ${price ? `<p class="card-price">${price}</p>` : ''}
        </div>
    </article>`;
}

function renderCardContact(contact) {
    const href = getPublicContactHref(contact);
    return href
        ? `<p class="card-contact"><strong>Contato:</strong> <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contact)}</a></p>`
        : `<p class="card-contact"><strong>Contato:</strong> ${escapeHtml(contact)}</p>`;
}

function getRequestCards(posts = getJSON(STORAGE_KEYS.posts, [])) {
    return posts.filter(post => post.type === 'request').map(post => ({
        id: post.id, title: post.title, description: post.description, category: post.category,
        author: post.author, authorId: post.authorId, image: post.image,
        location: post.location || '', contact: post.contact || '', icon: '? ', source: 'request'
    }));
}

function getOfferCards(posts = getJSON(STORAGE_KEYS.posts, [])) {
    posts = posts.filter(post => post.type !== 'request');
    const fromUser = posts.map(post => ({
        id: post.id,
        title: post.title,
        description: post.description,
        category: post.category,
        author: post.author,
        authorId: post.authorId,
        price: post.price,
        image: post.image,
        location: post.location || '',
        contact: post.contact || '',
        icon: '★',
        source: 'post'
    }));
    return fromUser;
}

let muralCatalog = { seek: [], offer: [] };

async function renderMural() {
    let userPosts = getJSON(STORAGE_KEYS.posts, []);
    if (window.ConectaBackend?.configured) {
        try {
            const records = await ConectaBackend.getPosts();
            userPosts = records.map(post => ({
                id: post.id,
                type: post.type,
                title: post.title,
                description: post.description,
                category: post.category,
                author: post.profiles?.display_name || 'Usuario',
                authorId: post.author_id,
                price: post.price,
                image: post.image_url,
                location: post.location || '',
                contact: post.contact || '',
                createdAt: Date.parse(post.created_at)
            }));
        } catch (error) {
            console.error('Nao foi possivel carregar as publicacoes compartilhadas.', error);
        }
    }
    muralCatalog = { seek: getRequestCards(userPosts), offer: getOfferCards(userPosts) };
    const term = muralSearch ? muralSearch.value.trim().toLowerCase() : '';
    const seek = muralCatalog.seek.filter(card => cardMatches(card, term));
    const offer = muralCatalog.offer.filter(card => cardMatches(card, term));

    const gridBuscar = document.getElementById('grid-buscar');
    const gridOferecer = document.getElementById('grid-oferecer');
    const emptySearch = document.getElementById('muralEmptySearch');

    if (gridBuscar) {
        gridBuscar.innerHTML = seek.length
            ? seek.map(renderCard).join('')
            : '<p class="empty-state">Nenhum pedido encontrado.</p>';
    }
    if (gridOferecer) {
        gridOferecer.innerHTML = offer.length
            ? offer.map(renderCard).join('')
            : '<p class="empty-state">Nenhuma oferta encontrada.</p>';
    }
    if (emptySearch) {
        emptySearch.hidden = Boolean(seek.length || offer.length);
    }
}

function findCard(id) {
    return muralCatalog.seek.concat(muralCatalog.offer).find(card => card.id === id);
}

const serviceModal = document.getElementById('serviceModal');
const closeService = document.getElementById('closeService');

function openServiceCard(card) {
    if (!card || !serviceModal) return;
    document.getElementById('serviceModalCategory').textContent = card.category;
    document.getElementById('serviceModalTitle').textContent = card.title;
    const bits = [card.author, formatPrice(card.price)].filter(Boolean);
    document.getElementById('serviceModalMeta').textContent = bits.join(' · ');
    const details = document.getElementById('serviceModalDetails');
    if (details) {
        details.innerHTML = [
            card.location ? `<p><strong>Local:</strong> ${escapeHtml(card.location)}</p>` : '',
            card.contact ? renderCardContact(card.contact) : ''
        ].filter(Boolean).join('');
    }
    document.getElementById('serviceModalDescription').textContent = card.description;
    const cta = document.getElementById('serviceModalCta');
    cta.href = card.source === 'request'
        ? `usuario.html?user=${encodeURIComponent(card.authorId || '')}&post=${encodeURIComponent(card.id)}#post-${encodeURIComponent(card.id)}`
        : card.source === 'post'
            ? `usuario.html?user=${encodeURIComponent(card.authorId || '')}`
            : 'amigos.html';
    cta.textContent = card.source === 'request' ? 'Responder a este pedido' : card.source === 'post' ? 'Ver perfil' : 'Conhecer pessoas da comunidade';
    openModal(serviceModal, closeService);
}

if (closeService && serviceModal) {
    closeService.addEventListener('click', () => closeModal(serviceModal));
    serviceModal.addEventListener('click', event => {
        if (event.target === serviceModal) closeModal(serviceModal);
    });
}

function handleMuralActivate(event) {
    if (event.target.closest('a, button')) return;
    const cardEl = event.target.closest('.mural-card');
    if (!cardEl) return;
    openServiceCard(findCard(cardEl.dataset.cardId));
}

['grid-buscar', 'grid-oferecer'].forEach(id => {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.addEventListener('click', handleMuralActivate);
    grid.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('a, button')) return;
        const cardEl = event.target.closest('.mural-card');
        if (!cardEl) return;
        event.preventDefault();
        openServiceCard(findCard(cardEl.dataset.cardId));
    });
});

if (muralSearch) {
    muralSearch.addEventListener('input', renderMural);
}

function closeUserMenu() {
    if (!userIcon) return;
    userIcon.classList.remove('active');
    userIcon.setAttribute('aria-expanded', 'false');
}

function toggleUserMenu() {
    if (!userIcon) return;
    const isOpen = userIcon.classList.toggle('active');
    userIcon.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

updateAccountUI();
renderMural();

async function syncSharedSession() {
    if (!window.ConectaBackend?.configured) return;
    const user = await ConectaBackend.currentUser();
    if (!user) {
        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.profile);
        setLoggedIn(false);
    } else {
        const { data } = await ConectaBackend.client.from('profiles').select('*').eq('id', user.id).maybeSingle();
        setJSON(STORAGE_KEYS.user, { id: user.id, name: data?.display_name || user.user_metadata.display_name || user.email, email: user.email });
        if (data) setJSON(STORAGE_KEYS.profile, { name: data.display_name, bio: data.bio, color: data.profile_color, image: data.avatar_url || '', coverColor: data.cover_color, coverImage: data.cover_url || '' });
        setLoggedIn(true);
    }
    updateAccountUI();
    renderMural();
}

if (window.ConectaBackend?.configured) {
    syncSharedSession();
    ConectaBackend.client.auth.onAuthStateChange(() => window.setTimeout(syncSharedSession, 0));
}

if (userIcon) {
    userIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleUserMenu();
    });
    userIcon.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleUserMenu();
        }
    });
}

document.addEventListener('click', function() {
    closeUserMenu();
});
