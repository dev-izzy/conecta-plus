const defaultProfile = {
    name: 'Seu nome',
    bio: 'Conte para a comunidade quais serviços você oferece.',
    color: '#004c94',
    image: '',
    coverColor: '#004c94',
    coverImage: ''
};

let profile = getJSON(STORAGE_KEYS.profile, null);
if (!profile) {
    const account = getAccount();
    profile = { ...defaultProfile, name: (account && account.name) || defaultProfile.name };
    setJSON(STORAGE_KEYS.profile, profile);
}
let posts = getJSON(STORAGE_KEYS.posts, []);
let communityPosts = posts;
let likedPosts = getJSON(STORAGE_KEYS.likedPosts, []);
let selectedImage = '';
let preparedServiceImage = null;
let serviceImagePreparation = Promise.resolve();
let preparedProfileImage = null;
let preparedCoverImage = null;
let profileImagePreparation = Promise.resolve();
let coverImagePreparation = Promise.resolve();
let viewingUserId = null;
let isOwnProfile = true;
let currentUserId = null;
let currentUserName = profile.name;
let accountProfile = null;
let profileFriendStatus = 'none';
let profileFriendRequest = null;

const elements = {
    profileName: document.getElementById('profileName'),
    profileBio: document.getElementById('profileBio'),
    profileAvatar: document.getElementById('profileAvatar'),
    editProfileButton: document.getElementById('editProfileButton'),
    friendRequestButton: document.getElementById('friendRequestButton'),
    navAvatar: document.getElementById('navAvatar'),
    postCount: document.getElementById('postCount'),
    commentCount: document.getElementById('commentCount'),
    feed: document.getElementById('feed'),
    recommendations: document.getElementById('recommendations'),
    feedFilter: document.getElementById('feedFilter'),
    requestForm: document.getElementById('requestForm'),
    requestMessage: document.getElementById('requestMessage'),
    serviceForm: document.getElementById('serviceForm'),
    serviceImage: document.getElementById('serviceImage'),
    imagePreview: document.getElementById('imagePreview'),
    postMessage: document.getElementById('postMessage'),
    profileModal: document.getElementById('profileModal'),
    profileForm: document.getElementById('profileForm'),
    profileNameInput: document.getElementById('profileNameInput'),
    profileBioInput: document.getElementById('profileBioInput'),
    profileColor: document.getElementById('profileColor'),
    profileImage: document.getElementById('profileImage'),
    profilePhotoPreview: document.getElementById('profilePhotoPreview'),
    profileCover: document.querySelector('.profile-cover'),
    coverImage: document.getElementById('coverImage'),
    coverPreview: document.getElementById('coverPreview')
};

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[character]));
}

function formatPrice(price) {
    return Number(price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(timestamp) {
    return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(
        Math.round((timestamp - Date.now()) / 86400000), 'day'
    );
}

function renderProfile() {
    elements.profileName.textContent = profile.name;
    elements.profileBio.textContent = profile.bio || 'Conte para a comunidade quais serviços você oferece.';
    elements.profileAvatar.textContent = getInitials(profile.name);
    elements.profileAvatar.style.backgroundColor = profile.color;
    setAvatarImage(elements.profileAvatar, profile.image);
    const navProfile = isOwnProfile
        ? profile
        : accountProfile || { name: 'Meu perfil', color: '#004c94', image: '' };
    elements.navAvatar.textContent = getInitials(navProfile.name);
    elements.navAvatar.style.backgroundColor = navProfile.color;
    setAvatarImage(elements.navAvatar, navProfile.image);
    setCoverStyle(elements.profileCover, profile.coverColor, profile.coverImage);
    elements.postCount.textContent = posts.filter(post => post.authorId ? post.authorId === profile.id : post.author === profile.name).length;
    elements.commentCount.textContent = posts.filter(post => post.authorId ? post.authorId === profile.id : post.author === profile.name).reduce((total, post) => total + post.comments.length, 0);
}

function canEditProfile() {
    if (!isOwnProfile) return false;
    if (window.ConectaBackend?.configured) {
        return Boolean(currentUserId && viewingUserId && currentUserId === viewingUserId);
    }
    return !new URLSearchParams(window.location.search).has('user');
}

function updateProfileEditingControls() {
    const canEdit = canEditProfile();
    elements.editProfileButton.hidden = !canEdit;
    elements.profileAvatar.disabled = !canEdit;
    elements.profileAvatar.setAttribute('aria-label', canEdit ? 'Alterar foto do perfil' : 'Foto do perfil');
    elements.navAvatar.setAttribute('aria-label', canEdit ? 'Abrir personalização do perfil' : 'Abrir meu perfil');
}

function setCoverStyle(element, color, image) {
    element.style.backgroundColor = color || '#004c94';
    element.style.backgroundImage = image
        ? `url("${image}")`
        : 'linear-gradient(115deg, var(--senac-blue) 0%, #1475b8 60%, var(--senac-orange) 100%)';
}

function setAvatarImage(element, image) {
    element.style.backgroundImage = image ? `url("${image}")` : '';
    element.classList.toggle('has-photo', Boolean(image));
}

function getInitials(name) {
    return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

function renderPostContact(contact) {
    if (!contact) return '';
    const href = getPublicContactHref(contact);
    return href
        ? `<p class="post-contact"><strong>Contato:</strong> <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contact)}</a></p>`
        : `<p class="post-contact"><strong>Contato:</strong> ${escapeHtml(contact)}</p>`;
}

function renderFeed() {
    const filter = elements.feedFilter.value;
    let visiblePosts = [...posts].sort((first, second) => second.createdAt - first.createdAt);
    if (filter === 'mine') visiblePosts = visiblePosts.filter(post => post.author === profile.name);
    if (filter === 'recommended') visiblePosts = visiblePosts.filter(post => post.author !== profile.name);

    elements.feed.innerHTML = visiblePosts.length
        ? visiblePosts.map(renderPost).join('')
        : '<div class="empty-state">Nenhuma publicação encontrada ainda.</div>';
}

function renderPost(post) {
    const image = post.image
        ? `<img src="${escapeHtml(post.image)}" alt="Foto do serviço ${escapeHtml(post.title)}" loading="lazy" decoding="async">`
        : `<div class="post-image-placeholder"><span>${escapeHtml(post.category.slice(0, 1))}</span><small>Foto do serviço</small></div>`;
    const comments = post.comments.map(comment => {
        const deleteCommentButton = (comment.authorId ? comment.authorId === currentUserId : comment.author === profile.name)
            ? `<button class="comment-delete" data-action="delete-comment" data-comment-id="${comment.id}" type="button">Excluir</button>`
            : '';
        return `<div class="comment-line"><p><strong>${escapeHtml(comment.author)}:</strong> ${escapeHtml(comment.text)}</p>${deleteCommentButton}</div>`;
    }).join('');
    const deleteButton = (post.authorId ? post.authorId === currentUserId : post.author === profile.name)
        ? '<button class="delete-action" data-action="delete" type="button">Excluir publicação</button>'
        : '';
    const hasLiked = likedPosts.includes(post.id);
    const isRequest = post.type === 'request';
    const author = post.authorId
        ? `<a class="post-author-link" href="usuario.html?user=${encodeURIComponent(post.authorId)}">${escapeHtml(post.author)}</a>`
        : `<strong>${escapeHtml(post.author)}</strong>`;

    return `<article class="service-post" id="post-${escapeHtml(post.id)}" data-post-id="${escapeHtml(post.id)}">
        <div class="post-header">
            <div class="post-avatar">${escapeHtml(getInitials(post.author))}</div>
            <div>${author}<small>${escapeHtml(post.category)} · ${formatDate(post.createdAt)}</small></div>
            <span class="post-price">${isRequest ? 'Pedido de serviço' : formatPrice(post.price)}</span>
        </div>
        <div class="post-photo">${image}</div>
        <div class="post-body">
            <div class="post-actions">
                <button class="icon-action like-button${hasLiked ? ' liked' : ''}" data-action="like" type="button" aria-pressed="${hasLiked}">${hasLiked ? '♥' : '♡'} <span>${post.likes}</span></button>
                <span class="service-tag">${isRequest ? 'Pedido' : 'Disponivel'}</span>
                ${deleteButton}
            </div>
            <h3>${escapeHtml(post.title)}</h3>
            <p class="post-description">${escapeHtml(post.description)}</p>
            ${post.location ? `<p class="post-location"><strong>Local:</strong> ${escapeHtml(post.location)}</p>` : ''}
            ${renderPostContact(post.contact)}
            <div class="comments" id="comments-${post.id}">${comments || '<p class="no-comments">Seja o primeiro a comentar.</p>'}</div>
            <form class="comment-form" data-post-id="${post.id}">
                <input name="comment" type="text" placeholder="${isRequest ? 'Responda ao pedido...' : 'Comente...'}" aria-label="Comentario" required>
                <button type="submit">${isRequest ? 'Responder' : 'Publicar'}</button>
            </form>
        </div>
    </article>`;
}

function renderRecommendations() {
    const recommendedPosts = communityPosts.filter(post => post.authorId ? post.authorId !== profile.id : post.author !== profile.name).slice(0, 3);
    elements.recommendations.innerHTML = recommendedPosts.length
        ? recommendedPosts.map(post => `<a class="recommendation-item" href="usuario.html?user=${encodeURIComponent(post.authorId || '')}">
            <span class="recommendation-avatar">${escapeHtml(getInitials(post.author))}</span>
            <span><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.author)} Â· ${post.type === 'request' ? 'Pedido de servico' : formatPrice(post.price)}</small></span>
            <span class="recommendation-arrow">→</span>
        </a>`).join('')
        : '<p class="no-comments">Cadastre outro serviço para começar a recomendar.</p>';
}

async function updateFriendRequestButton() {
    const button = elements.friendRequestButton;
    if (!button) return;
    button.hidden = isOwnProfile || !currentUserId || !viewingUserId;
    button.disabled = false;
    profileFriendStatus = 'none';
    profileFriendRequest = null;
    if (button.hidden) return;

    const requests = await ConectaBackend.getFriendRequests();
    profileFriendRequest = requests.find(request =>
        (request.sender_id === currentUserId && request.receiver_id === viewingUserId)
        || (request.sender_id === viewingUserId && request.receiver_id === currentUserId)
    ) || null;

    if (profileFriendRequest?.status === 'accepted') {
        profileFriendStatus = 'friend';
        button.textContent = 'Amigo';
        button.disabled = true;
    } else if (profileFriendRequest?.status === 'pending' && profileFriendRequest.receiver_id === currentUserId) {
        profileFriendStatus = 'incoming';
        button.textContent = 'Aceitar amizade';
    } else if (profileFriendRequest?.status === 'pending') {
        profileFriendStatus = 'outgoing';
        button.textContent = 'Cancelar solicitação';
    } else {
        button.textContent = 'Solicitar amizade';
    }
}

async function loadSharedProfile() {
    if (!window.ConectaBackend?.configured) {
        if (new URLSearchParams(window.location.search).has('user')) {
            throw new Error('Configure o Supabase para abrir perfis compartilhados. Veja SUPABASE-SETUP.md.');
        }
        return false;
    }
    const currentUser = await ConectaBackend.currentUser();
    currentUserId = currentUser?.id || null;
    if (currentUser) {
        const { data: ownData } = await ConectaBackend.client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
        currentUserName = ownData?.display_name || currentUser.user_metadata.display_name || currentUser.email;
        accountProfile = ownData ? {
            name: ownData.display_name || currentUserName,
            color: ownData.profile_color || '#004c94',
            image: ownData.avatar_url || ''
        } : { name: currentUserName, color: '#004c94', image: '' };
        setJSON(STORAGE_KEYS.user, { id: currentUser.id, name: ownData?.display_name || currentUser.user_metadata.display_name || currentUser.email, email: currentUser.email });
        setLoggedIn(true);
    } else {
        accountProfile = null;
        setLoggedIn(false);
    }
    const requestedId = new URLSearchParams(window.location.search).get('user');
    viewingUserId = requestedId || currentUser?.id || null;
    isOwnProfile = Boolean(currentUser && viewingUserId === currentUser.id);
    if (!viewingUserId) return false;

    const profileData = await ConectaBackend.getProfile(viewingUserId);
    if (!profileData) throw new Error('Esse perfil nao foi encontrado.');
    profile = {
        id: profileData.id,
        name: profileData.display_name,
        bio: profileData.bio || '',
        color: profileData.profile_color || '#004c94',
        image: profileData.avatar_url || '',
        coverColor: profileData.cover_color || '#004c94',
        coverImage: profileData.cover_url || ''
    };
    updateProfileEditingControls();
    // Mostra os dados do perfil assim que forem carregados. Um erro ao buscar
    // amizades ou publicacoes nao deve deixar a pagina exibindo o perfil local.
    renderProfile();
    try {
        await updateFriendRequestButton();
    } catch (error) {
        console.error('Nao foi possivel carregar o estado da amizade.', error);
    }

    let profileRows = [];
    let communityRows = [];
    try {
        [profileRows, communityRows] = await Promise.all([
            ConectaBackend.getPosts(viewingUserId),
            ConectaBackend.getPosts()
        ]);
    } catch (error) {
        console.error('Nao foi possivel carregar as publicacoes do perfil.', error);
        elements.feed.innerHTML = '<div class="empty-state">Perfil carregado, mas nao foi possivel buscar as publicacoes. Atualize a pagina para tentar novamente.</div>';
    }
    const allIds = [...new Set([...profileRows, ...communityRows].map(row => row.id))];
    const [comments, likes, sessionUser] = await Promise.all([
        ConectaBackend.getComments(allIds),
        ConectaBackend.getLikes(allIds),
        currentUser
    ]);
    const mapRows = rows => rows.map(row => ({
        id: row.id,
        authorId: row.author_id,
        author: row.profiles?.display_name || 'Usuario',
        title: row.title,
        description: row.description,
        category: row.category,
        price: row.price,
        image: row.image_url || '',
        location: row.location || '',
        contact: row.contact || '',
        type: row.type,
        createdAt: Date.parse(row.created_at),
        likes: likes.filter(like => like.post_id === row.id).length,
        comments: comments.filter(comment => comment.post_id === row.id).map(comment => ({
            id: comment.id,
            authorId: comment.author_id,
            author: comment.profiles?.display_name || 'Usuario',
            text: comment.body
        }))
    }));
    posts = mapRows(profileRows);
    communityPosts = mapRows(communityRows);
    likedPosts = likes.filter(like => like.user_id === sessionUser?.id).map(like => like.post_id);
    elements.feedFilter.hidden = true;
    document.querySelector('.request-composer').hidden = !isOwnProfile;
    document.querySelector('.feed-column .post-composer').hidden = !isOwnProfile;
    document.querySelector('.feed-heading h2').textContent = isOwnProfile ? 'Suas publicacoes' : 'Publicacoes';
    return true;
}
async function initializeProfilePage() {
    const requestedId = new URLSearchParams(window.location.search).get('user');
    if (requestedId) {
        viewingUserId = requestedId;
        isOwnProfile = false;
    }
    updateProfileEditingControls();
    try {
        const loaded = await loadSharedProfile();
        if (!loaded && window.ConectaBackend?.configured) {
            if (requestedId) throw new Error('Perfil nao encontrado.');
            document.querySelector('.request-composer').hidden = true;
            document.querySelector('.feed-column .post-composer').hidden = true;
            updateProfileEditingControls();
        } else if (!loaded) {
            updateProfileEditingControls();
        }
        updateViews();
    } catch (error) {
        document.getElementById('feed').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
    const requestedPostId = new URLSearchParams(window.location.search).get('post');
    if (requestedPostId) {
        window.setTimeout(() => document.getElementById(`post-${requestedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function updateViews() {
    renderProfile();
    renderFeed();
    renderRecommendations();
    const banner = document.getElementById('loginBanner');
    if (banner) banner.hidden = Boolean(isLoggedIn() && getAccount());
}

elements.serviceImage.addEventListener('change', event => {
    const file = event.target.files[0];
    preparedServiceImage = null;
    selectedImage = '';
    if (!file) {
        elements.imagePreview.innerHTML = '';
        return;
    }
    serviceImagePreparation = (async () => {
        try {
            preparedServiceImage = await compressImageFile(file, { maxDimension: 1200, quality: 0.78 });
            selectedImage = await imageFileToDataUrl(preparedServiceImage);
            elements.imagePreview.innerHTML = `<img src="${selectedImage}" alt="Prévia da foto do serviço" decoding="async">`;
        } catch (error) {
            elements.postMessage.textContent = error.message || 'Nao foi possivel preparar a imagem.';
            elements.postMessage.classList.remove('success');
        }
    })();
});

elements.serviceForm.addEventListener('submit', async event => {
    event.preventDefault();
    await serviceImagePreparation;
    if (!window.ConectaBackend?.configured && (!isLoggedIn() || !getAccount())) {
        elements.postMessage.textContent = 'Entre ou cadastre-se no mural para publicar um serviço.';
        elements.postMessage.classList.remove('success');
        return;
    }
    const data = new FormData(elements.serviceForm);
    const sharedUser = window.ConectaBackend?.configured ? await ConectaBackend.currentUser() : null;
    if (window.ConectaBackend?.configured && !sharedUser) {
        elements.postMessage.textContent = 'Entre na sua conta para publicar.';
        return;
    }
    if (window.ConectaBackend?.configured) {
        try {
            const imageUrl = await ConectaBackend.uploadImage(sharedUser.id, preparedServiceImage || elements.serviceImage.files[0], 'service');
            await ConectaBackend.createPost({
                type: 'offer',
                title: data.get('title').trim(),
                description: data.get('description').trim(),
                category: data.get('category'),
                price: Number(data.get('price')),
                image_url: imageUrl,
                location: data.get('location').trim() || null,
                contact: data.get('contact').trim() || null
            });
            await loadSharedProfile();
            elements.serviceForm.reset();
            elements.imagePreview.innerHTML = '';
            preparedServiceImage = null;
            selectedImage = '';
            elements.postMessage.textContent = 'Servico publicado no seu perfil.';
            elements.postMessage.classList.add('success');
            updateViews();
        } catch (error) {
            elements.postMessage.textContent = error.message;
            elements.postMessage.classList.remove('success');
        }
        return;
    }
    const newPost = {
        id: `post-${Date.now()}`,
        type: 'offer',
        author: profile.name,
        title: data.get('title').trim(),
        description: data.get('description').trim(),
        price: Number(data.get('price')),
        category: data.get('category'),
        image: selectedImage,
        location: data.get('location').trim(),
        contact: data.get('contact').trim(),
        createdAt: Date.now(),
        likes: 0,
        comments: []
    };
    posts.unshift(newPost);
    setJSON(STORAGE_KEYS.posts, posts);
    elements.serviceForm.reset();
    elements.imagePreview.innerHTML = '';
    selectedImage = '';
    preparedServiceImage = null;
    elements.postMessage.textContent = 'Servico publicado no seu mural.';
    elements.postMessage.classList.add('success');
    updateViews();
    setTimeout(() => { elements.postMessage.textContent = ''; }, 2500);
});

elements.requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    const sharedUser = window.ConectaBackend?.configured ? await ConectaBackend.currentUser() : null;
    if ((window.ConectaBackend?.configured && !sharedUser) || (!window.ConectaBackend?.configured && (!isLoggedIn() || !getAccount()))) {
        elements.requestMessage.textContent = 'Entre ou cadastre-se no mural para publicar um pedido.';
        elements.requestMessage.classList.remove('success');
        return;
    }

    const data = new FormData(elements.requestForm);
    if (window.ConectaBackend?.configured) {
        try {
            await ConectaBackend.createPost({
                type: 'request',
                title: data.get('title').trim(),
                description: data.get('description').trim(),
                category: data.get('category'),
                price: null,
                image_url: null,
                location: data.get('location').trim() || null,
                contact: data.get('contact').trim() || null
            });
            await loadSharedProfile();
            elements.requestForm.reset();
            elements.requestMessage.textContent = 'Pedido publicado. A comunidade pode responder nos comentarios.';
            elements.requestMessage.classList.add('success');
            updateViews();
        } catch (error) {
            elements.requestMessage.textContent = error.message;
            elements.requestMessage.classList.remove('success');
        }
        return;
    }
    const request = {
        id: `request-${Date.now()}`,
        type: 'request',
        author: profile.name,
        title: data.get('title').trim(),
        description: data.get('description').trim(),
        category: data.get('category'),
        price: null,
        image: '',
        location: data.get('location').trim(),
        contact: data.get('contact').trim(),
        createdAt: Date.now(),
        likes: 0,
        comments: []
    };
    posts.unshift(request);
    setJSON(STORAGE_KEYS.posts, posts);
    elements.requestForm.reset();
    elements.requestMessage.textContent = 'Pedido publicado. A comunidade pode responder nos comentarios.';
    elements.requestMessage.classList.add('success');
    updateViews();
    setTimeout(() => { elements.requestMessage.textContent = ''; }, 3000);
});

elements.feedFilter.addEventListener('change', renderFeed);
async function handleLike(event) {
    const button = event.target.closest('[data-action="like"]');
    if (!button) return;

    const post = posts.find(item => item.id === button.closest('.service-post').dataset.postId);
    if (!post) return;

    if (window.ConectaBackend?.configured) {
        try {
            await ConectaBackend.toggleLike(post.id);
            await loadSharedProfile();
            updateViews();
        } catch (error) {
            console.error('Could not update like.', error);
        }
        return;
    }

    if (likedPosts.includes(post.id)) {
        post.likes = Math.max(0, post.likes - 1);
        likedPosts = likedPosts.filter(postId => postId !== post.id);
    } else {
        post.likes += 1;
        likedPosts.push(post.id);
    }
    setJSON(STORAGE_KEYS.posts, posts);
    setJSON(STORAGE_KEYS.likedPosts, likedPosts);
    updateViews();
}

async function handleDelete(event) {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;

    const postElement = button.closest('.service-post');
    const post = posts.find(item => item.id === postElement.dataset.postId);
    if (!post || (post.authorId ? post.authorId !== currentUserId : post.author !== profile.name)) return;
    if (!window.confirm('Excluir esta publicação? Essa ação não pode ser desfeita.')) return;

    if (window.ConectaBackend?.configured) {
        try {
            await ConectaBackend.deletePost(post.id);
            await loadSharedProfile();
            updateViews();
        } catch (error) {
            console.error('Could not delete publication.', error);
        }
        return;
    }
    posts = posts.filter(item => item.id !== post.id);
    setJSON(STORAGE_KEYS.posts, posts);
    updateViews();
}

async function handleCommentDelete(event) {
    const button = event.target.closest('[data-action="delete-comment"]');
    if (!button) return;

    const postElement = button.closest('.service-post');
    const post = posts.find(item => item.id === postElement.dataset.postId);
    const comment = post?.comments.find(item => item.id === button.dataset.commentId);
    if (!post || !comment || (comment.authorId ? comment.authorId !== currentUserId : comment.author !== profile.name)) return;
    if (!window.confirm('Excluir este comentário? Essa ação não pode ser desfeita.')) return;

    if (window.ConectaBackend?.configured) {
        try {
            await ConectaBackend.deleteComment(comment.id);
            await loadSharedProfile();
            updateViews();
        } catch (error) {
            console.error('Could not delete comment.', error);
        }
        return;
    }
    post.comments = post.comments.filter(item => item.id !== comment.id);
    setJSON(STORAGE_KEYS.posts, posts);
    updateViews();
}

function handleRecommendationClick(event) {
    const recommendation = event.target.closest('.recommendation-item');
    if (recommendation) {
        const postElement = document.querySelector(`[data-post-id="${recommendation.dataset.postId}"]`);
        postElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

elements.feed.addEventListener('click', handleLike);
elements.feed.addEventListener('click', handleDelete);
elements.feed.addEventListener('click', handleCommentDelete);
elements.recommendations.addEventListener('click', handleRecommendationClick);

elements.feed.addEventListener('submit', async event => {
    if (!event.target.matches('.comment-form')) return;
    event.preventDefault();
    const form = event.target;
    const input = form.elements.comment;
    const post = posts.find(item => item.id === form.dataset.postId);
    if (window.ConectaBackend?.configured) {
        try {
            await ConectaBackend.addComment(post.id, input.value.trim());
            await loadSharedProfile();
            updateViews();
        } catch (error) {
            input.setCustomValidity(error.message);
            input.reportValidity();
        }
        return;
    }
    post.comments.push({ id: `comment-${Date.now()}`, author: currentUserName, text: input.value.trim() });
    setJSON(STORAGE_KEYS.posts, posts);
    updateViews();
});

let previewCoverImage = '';
let lastFocusedElement = null;

function openProfileModal() {
    if (!canEditProfile()) return;
    lastFocusedElement = document.activeElement;
    elements.profileNameInput.value = profile.name;
    elements.profileBioInput.value = profile.bio;
    elements.profileColor.value = profile.color;
    elements.profilePhotoPreview.textContent = getInitials(profile.name);
    previewCoverImage = profile.coverImage || '';
    setAvatarImage(elements.profilePhotoPreview, profile.image);
    setCoverStyle(elements.coverPreview, profile.coverColor, profile.coverImage);
    elements.profileModal.classList.add('active');
    elements.profileModal.setAttribute('aria-hidden', 'false');
    elements.profileNameInput.focus();
}

function closeProfileModal() {
    elements.profileModal.classList.remove('active');
    elements.profileModal.setAttribute('aria-hidden', 'true');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

elements.editProfileButton.addEventListener('click', openProfileModal);
elements.friendRequestButton.addEventListener('click', async () => {
    const button = elements.friendRequestButton;
    button.disabled = true;
    try {
        if (profileFriendStatus === 'incoming') {
            await ConectaBackend.updateFriendRequest(profileFriendRequest.id, 'accepted');
        } else if (profileFriendStatus === 'outgoing') {
            await ConectaBackend.updateFriendRequest(profileFriendRequest.id, 'cancelled');
        } else if (profileFriendStatus === 'none') {
            await ConectaBackend.sendFriendRequest(viewingUserId);
        }
        await updateFriendRequestButton();
    } catch (error) {
        button.disabled = false;
        button.textContent = error.message || 'Nao foi possivel enviar a solicitacao';
    }
});
elements.profileAvatar.addEventListener('click', openProfileModal);
elements.navAvatar.addEventListener('click', () => {
    if (!canEditProfile()) {
        window.location.href = 'usuario.html';
        return;
    }
    openProfileModal();
});
document.getElementById('closeProfile').addEventListener('click', closeProfileModal);
elements.profileModal.addEventListener('click', event => {
    if (event.target === elements.profileModal) closeProfileModal();
});

elements.profileImage.addEventListener('change', event => {
    const file = event.target.files[0];
    preparedProfileImage = null;
    if (!file) return;
    profileImagePreparation = (async () => {
        try {
            preparedProfileImage = await compressImageFile(file, { maxDimension: 900, quality: 0.78 });
            setAvatarImage(elements.profilePhotoPreview, await imageFileToDataUrl(preparedProfileImage));
        } catch (error) {
            console.error('Nao foi possivel preparar a foto do perfil.', error);
        }
    })();
});

elements.coverImage.addEventListener('change', event => {
    const file = event.target.files[0];
    preparedCoverImage = null;
    if (!file) return;
    coverImagePreparation = (async () => {
        try {
            preparedCoverImage = await compressImageFile(file, { maxDimension: 1400, quality: 0.78 });
            previewCoverImage = await imageFileToDataUrl(preparedCoverImage);
            setCoverStyle(elements.coverPreview, profile.coverColor || '#004c94', previewCoverImage);
        } catch (error) {
            console.error('Nao foi possivel preparar a imagem do banner.', error);
        }
    })();
});

elements.profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEditProfile()) {
        closeProfileModal();
        return;
    }
    await Promise.all([profileImagePreparation, coverImagePreparation]);
    const data = new FormData(elements.profileForm);
    const previousName = profile.name;
    const imageFile = preparedProfileImage || elements.profileImage.files[0];
    const coverImageFile = preparedCoverImage || elements.coverImage.files[0];
    if (window.ConectaBackend?.configured) {
        try {
            const user = await ConectaBackend.currentUser();
            if (!user || !canEditProfile() || user.id !== viewingUserId) {
                throw new Error('Entre na sua conta para editar seu proprio perfil.');
            }
            const avatarUrl = imageFile ? await ConectaBackend.uploadImage(user.id, imageFile, 'avatar') : profile.image;
            const coverUrl = coverImageFile ? await ConectaBackend.uploadImage(user.id, coverImageFile, 'cover') : profile.coverImage;
            await ConectaBackend.updateProfile(user.id, {
                display_name: data.get('name').trim(),
                bio: data.get('bio').trim(),
                profile_color: data.get('color'),
                avatar_url: avatarUrl,
                cover_color: profile.coverColor || '#004c94',
                cover_url: coverUrl
            });
            await loadSharedProfile();
            closeProfileModal();
            elements.profileImage.value = '';
            elements.coverImage.value = '';
            preparedProfileImage = null;
            preparedCoverImage = null;
            updateViews();
        } catch (error) {
            console.error('Could not save profile.', error);
        }
        return;
    }
    const saveProfile = (image, coverImage) => {
        profile = {
            name: data.get('name').trim(),
            bio: data.get('bio').trim(),
            color: data.get('color'),
            image,
            coverColor: profile.coverColor || '#004c94',
            coverImage
        };
        posts.forEach(post => {
            if (post.author === previousName) post.author = profile.name;
        });
        setJSON(STORAGE_KEYS.profile, profile);
        setJSON(STORAGE_KEYS.posts, posts);
        closeProfileModal();
        elements.profileImage.value = '';
        elements.coverImage.value = '';
        preparedProfileImage = null;
        preparedCoverImage = null;
        updateViews();
    };

    Promise.all([
        imageFile ? imageFileToDataUrl(imageFile) : Promise.resolve(profile.image || ''),
        coverImageFile ? imageFileToDataUrl(coverImageFile) : Promise.resolve(profile.coverImage || '')
    ]).then(([image, coverImage]) => saveProfile(image, coverImage)).catch(error => {
        console.error('Nao foi possivel ler as imagens do perfil.', error);
    });
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeProfileModal();
});

initializeProfilePage();
