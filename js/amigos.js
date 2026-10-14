(() => {
    'use strict';

    const byId = id => document.getElementById(id);
    const ui = {
        count: byId('friendsCount'),
        total: byId('friendsTotal'),
        suggestions: byId('friendsList'),
        search: byId('friendSearch'),
        userName: byId('friendsUserName'),
        userAvatar: byId('friendsUserAvatar'),
        confirmedCount: byId('confirmedFriendsCount'),
        confirmed: byId('confirmedFriendsList'),
        received: byId('receivedRequests'),
        sent: byId('sentRequests'),
        contacts: byId('messagesContacts'),
        messagesLayout: document.querySelector('.messages-layout'),
        threadHeader: byId('messagesThreadHeader'),
        messagesBack: byId('messagesBack'),
        thread: byId('messagesThread'),
        messageStatus: byId('messagesStatus'),
        messageForm: byId('messageForm'),
        messageInput: byId('messageInput'),
        tabFriends: byId('tab-amigos'),
        tabMessages: byId('tab-mensagens')
    };

    if (!ui.suggestions || !ui.search || !ui.confirmed || !ui.received || !ui.sent) {
        console.error('A pagina de amigos esta sem elementos HTML obrigatorios.');
        return;
    }

    const state = {
        user: null,
        profiles: [],
        profilesById: new Map(),
        requests: [],
        requestsError: '',
        profilesError: '',
        actionError: '',
        activeFriendId: null,
        messages: {},
        messageUserId: null,
        messagesError: '',
        realtimeError: '',
        messageChannel: null,
        messageChannelFriendId: null,
        localTypingFriendId: null,
        localTypingTimer: null,
        remoteTypingFriendId: null,
        remoteTypingTimer: null,
        sendingMessage: false,
        refreshPromise: null,
        actions: new Set()
    };

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    const initialsFor = name => String(name || 'U')
        .trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map(part => part[0]).join('').toLocaleUpperCase('pt-BR') || 'U';

    const safeColor = value => /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value || '') ? value : '#004c94';

    function profileFor(id) {
        return state.profilesById.get(id) || null;
    }

    function getRequestsFor(profileId) {
        if (!state.user) return [];
        return state.requests.filter(request =>
            (request.sender_id === state.user.id && request.receiver_id === profileId)
            || (request.receiver_id === state.user.id && request.sender_id === profileId)
        );
    }

    function friendState(profileId) {
        const related = getRequestsFor(profileId);
        const accepted = related.find(request => request.status === 'accepted');
        if (accepted) return { type: 'friend', request: accepted };
        const incoming = related.find(request => request.status === 'pending' && request.receiver_id === state.user?.id);
        if (incoming) return { type: 'incoming', request: incoming };
        const outgoing = related.find(request => request.status === 'pending' && request.sender_id === state.user?.id);
        if (outgoing) return { type: 'outgoing', request: outgoing };
        return { type: 'none', request: null };
    }

    function avatarMarkup(person, extraClass = '') {
        const photo = person.avatar_url
            ? `<img src="${escapeHtml(person.avatar_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
            : escapeHtml(initialsFor(person.display_name));
        return `<span class="friend-avatar ${extraClass}" style="background-color:${safeColor(person.profile_color)}">${photo}</span>`;
    }

    function profileLink(person, text = person.display_name) {
        return `<a class="friend-profile-link" href="usuario.html?user=${encodeURIComponent(person.id)}">${escapeHtml(text)}</a>`;
    }

    function emptyMessage(text) {
        return `<p class="no-comments">${escapeHtml(text)}</p>`;
    }

    function requestButton(action, label, entityId, className = '') {
        const entityAttribute = entityId
            ? action === 'send'
                ? ` data-person-id="${escapeHtml(entityId)}"`
                : ` data-request-id="${escapeHtml(entityId)}"`
            : '';
        const busy = state.actions.has(entityId || action);
        return `<button class="${className || 'request-button'}" type="button" data-action="${action}"${entityAttribute}${busy ? ' disabled' : ''}>${busy ? 'Aguarde...' : label}</button>`;
    }

    function renderSuggestion(person) {
        const relationship = friendState(person.id);
        let buttons = '';
        if (relationship.type === 'friend') {
            buttons = '<button class="friend-button added" type="button" disabled>Amigo</button>';
        } else if (relationship.type === 'outgoing') {
            buttons = requestButton('cancel', 'Cancelar pedido', relationship.request.id, 'friend-button added');
        } else if (relationship.type === 'incoming') {
            buttons = `<div style="display:grid;gap:6px;padding:0 10px 10px">
                ${requestButton('accept', 'Aceitar', relationship.request.id, 'request-button accept')}
                ${requestButton('decline', 'Recusar', relationship.request.id, 'request-button decline')}
            </div>`;
        } else {
            buttons = requestButton('send', 'Solicitar amizade', person.id, 'friend-button');
        }

        return `<article class="friend-item">
            ${avatarMarkup(person)}
            <div class="friend-details">
                ${profileLink(person)}
                <small>${escapeHtml(person.bio || 'Membro do Conecta+')}</small>
            </div>
            ${buttons}
        </article>`;
    }

    function renderSuggestions() {
        if (!ui.suggestions) return;
        if (state.profilesError) {
            ui.suggestions.innerHTML = emptyMessage(`Nao foi possivel carregar os perfis: ${state.profilesError}`);
            if (ui.count) ui.count.textContent = '0';
            return;
        }

        const term = ui.search.value.trim().toLocaleLowerCase('pt-BR');
        const filtered = state.profiles.filter(person =>
            `${person.display_name} ${person.bio || ''}`.toLocaleLowerCase('pt-BR').includes(term)
        );
        if (ui.count) ui.count.textContent = String(filtered.length);
        if (ui.total) ui.total.textContent = `(${confirmedFriendIds().length})`;
        const results = filtered.length
            ? filtered.map(renderSuggestion).join('')
            : emptyMessage(state.profiles.length
                ? 'Nenhuma pessoa encontrada para essa busca.'
                : 'Ainda nao ha outros perfis cadastrados.');
        const actionError = state.actionError
            ? `<p class="no-comments" role="alert">${escapeHtml(state.actionError)}</p>`
            : '';
        ui.suggestions.innerHTML = actionError + results;
    }

    function confirmedFriendIds() {
        if (!state.user) return [];
        return [...new Set(state.requests
            .filter(request => request.status === 'accepted'
                && (request.sender_id === state.user.id || request.receiver_id === state.user.id))
            .map(request => request.sender_id === state.user.id ? request.receiver_id : request.sender_id))];
    }

    function renderConfirmedFriends() {
        const ids = confirmedFriendIds();
        if (ui.confirmedCount) ui.confirmedCount.textContent = String(ids.length);
        if (ui.total) ui.total.textContent = `(${ids.length})`;
        const people = ids.map(profileFor).filter(Boolean);
        if (!people.length) {
            ui.confirmed.innerHTML = emptyMessage(ids.length
                ? 'Uma amizade existe, mas o perfil dessa conta nao foi encontrado.'
                : 'Seus amigos confirmados aparecerao aqui.');
            return;
        }
        ui.confirmed.innerHTML = people.map(person => `<article class="friend-item confirmed-friend-item">
            ${avatarMarkup(person)}
            <div class="friend-details">
                ${profileLink(person)}
                <small>${escapeHtml(person.bio || 'Membro do Conecta+')}</small>
            </div>
            <a class="primary-button friends-profile-link" href="usuario.html?user=${encodeURIComponent(person.id)}">Ver perfil</a>
        </article>`).join('');
    }

    function renderRequestItem(request, direction) {
        const personId = direction === 'received' ? request.sender_id : request.receiver_id;
        const person = profileFor(personId);
        if (!person) {
            return `<article class="request-item">${emptyMessage('O perfil desta solicitacao nao existe na tabela profiles.')}</article>`;
        }
        const controls = direction === 'received'
            ? `${requestButton('accept', 'Aceitar', request.id, 'request-button accept')}${requestButton('decline', 'Recusar', request.id, 'request-button decline')}`
            : requestButton('cancel', 'Cancelar', request.id, 'request-button decline');
        return `<article class="request-item">
            ${avatarMarkup(person)}
            <div class="friend-details">${profileLink(person)}<small>${escapeHtml(person.bio || 'Membro do Conecta+')}</small></div>
            ${controls}
        </article>`;
    }

    function renderRequests() {
        const pending = state.requests.filter(request => request.status === 'pending');
        const received = pending.filter(request => request.receiver_id === state.user?.id);
        const sent = pending.filter(request => request.sender_id === state.user?.id);
        if (state.requestsError) {
            const message = `Nao foi possivel carregar solicitacoes: ${state.requestsError}`;
            ui.received.innerHTML = emptyMessage(message);
            ui.sent.innerHTML = emptyMessage(message);
            return;
        }
        ui.received.innerHTML = received.length
            ? received.map(request => renderRequestItem(request, 'received')).join('')
            : emptyMessage('Nenhuma solicitacao recebida.');
        ui.sent.innerHTML = sent.length
            ? sent.map(request => renderRequestItem(request, 'sent')).join('')
            : emptyMessage('Nenhuma solicitacao enviada.');
    }

    function friendIdForMessage(message) {
        return message.sender_id === state.user?.id ? message.recipient_id : message.sender_id;
    }

    function conversationFor(person) {
        return state.messages[person.id] || [];
    }

    function messageFromRow(row) {
        return {
            id: row.id,
            from: row.sender_id === state.user?.id ? 'me' : 'friend',
            text: row.body,
            at: row.created_at
        };
    }

    function formatMessageTime(value) {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? ''
            : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function addMessage(row) {
        const friendId = friendIdForMessage(row);
        const conversation = state.messages[friendId] ||= [];
        if (conversation.some(message => message.id === row.id)) return;
        conversation.push(messageFromRow(row));
        conversation.sort((left, right) => new Date(left.at) - new Date(right.at));
    }

    function setMessageStatus() {
        if (!ui.messageStatus) return;
        const message = state.messagesError || state.realtimeError;
        ui.messageStatus.hidden = !message;
        ui.messageStatus.textContent = message || '';
        ui.messageStatus.classList.toggle('error', Boolean(state.messagesError));
    }

    function stopMessageSubscription() {
        stopLocalTyping();
        clearTimeout(state.remoteTypingTimer);
        state.remoteTypingFriendId = null;
        if (state.messageChannel && ConectaBackend?.client) {
            ConectaBackend.client.removeChannel(state.messageChannel);
        }
        state.messageChannel = null;
        state.messageChannelFriendId = null;
    }

    function startMessageSubscription(friendId) {
        if (state.messageChannelFriendId === friendId) return;
        stopMessageSubscription();
        state.messageChannelFriendId = friendId;
        ConectaBackend.subscribeMessages(friendId, row => {
            addMessage(row);
            renderMessageContacts();
            renderThread();
        }, isTyping => {
            if (state.activeFriendId !== friendId) return;
            clearTimeout(state.remoteTypingTimer);
            state.remoteTypingFriendId = isTyping ? friendId : null;
            if (isTyping) {
                state.remoteTypingTimer = window.setTimeout(() => {
                    state.remoteTypingFriendId = null;
                    renderThread();
                }, 3500);
            }
            renderThread();
        }, status => {
            if (state.messageChannelFriendId !== friendId) return;
            if (status === 'SUBSCRIBED') {
                state.realtimeError = '';
                if (state.localTypingFriendId === friendId) publishTyping(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                state.realtimeError = 'Nao foi possivel manter a conexao em tempo real. Novas mensagens serao buscadas automaticamente.';
            }
            setMessageStatus();
        }).then(channel => {
            if (state.messageChannelFriendId === friendId) {
                state.messageChannel = channel;
                if (state.localTypingFriendId === friendId) publishTyping(true);
            } else {
                ConectaBackend.client.removeChannel(channel);
            }
        }).catch(error => {
            console.error('Falha ao assinar atualizacoes de mensagens.', error);
            state.realtimeError = error?.message || 'Nao foi possivel ativar as mensagens em tempo real.';
            setMessageStatus();
        });
    }

    function publishTyping(isTyping) {
        if (!state.messageChannel || !state.user) return;
        ConectaBackend.sendTyping(state.messageChannel, state.user.id, isTyping)
            .then(status => {
                if (status && status !== 'ok' && status !== 'timed out') {
                    console.warn('O status de digitacao nao foi enviado.', status);
                }
            })
            .catch(error => console.warn('Nao foi possivel atualizar o status de digitacao.', error));
    }

    function stopLocalTyping() {
        clearTimeout(state.localTypingTimer);
        if (state.localTypingFriendId) publishTyping(false);
        state.localTypingFriendId = null;
    }

    function setLocalTyping() {
        const text = ui.messageInput?.value.trim();
        const friendId = state.activeFriendId;
        if (!text || !friendId || !confirmedFriendIds().includes(friendId)) {
            stopLocalTyping();
            return;
        }
        if (state.localTypingFriendId !== friendId) {
            stopLocalTyping();
            state.localTypingFriendId = friendId;
            publishTyping(true);
        }
        clearTimeout(state.localTypingTimer);
        state.localTypingTimer = window.setTimeout(stopLocalTyping, 2200);
    }

    function renderMessageContacts() {
        if (!ui.contacts) return;
        const friends = confirmedFriendIds().map(profileFor).filter(Boolean);
        if (!friends.length) {
            ui.contacts.innerHTML = emptyMessage('Voce ainda nao tem amigos confirmados para conversar.');
            return;
        }
        const sortedFriends = [...friends].sort((left, right) => {
            const leftTime = new Date(conversationFor(left).at(-1)?.at || 0).getTime();
            const rightTime = new Date(conversationFor(right).at(-1)?.at || 0).getTime();
            return rightTime - leftTime;
        });
        ui.contacts.innerHTML = sortedFriends.map(person => {
            const conversation = conversationFor(person);
            const lastMessage = conversation.at(-1);
            const isTyping = state.remoteTypingFriendId === person.id;
            const preview = isTyping ? 'digitando...' : (lastMessage?.text || 'Diga oi!');
            const active = state.activeFriendId === person.id ? ' active' : '';
            const time = formatMessageTime(lastMessage?.at);
            return `<button class="messages-contact${active}" type="button" data-person-id="${escapeHtml(person.id)}" aria-pressed="${state.activeFriendId === person.id}">
                ${avatarMarkup(person)}
                <span class="messages-contact-info">
                    <span class="messages-contact-topline"><strong>${escapeHtml(person.display_name)}</strong><time>${escapeHtml(time)}</time></span>
                    <span class="messages-contact-preview${isTyping ? ' is-typing' : ''}">${escapeHtml(preview)}</span>
                </span>
            </button>`;
        }).join('');
    }

    function renderThread() {
        if (!ui.threadHeader || !ui.thread || !ui.messageForm) return;
        const person = profileFor(state.activeFriendId);
        const isFriend = person && confirmedFriendIds().includes(person.id);
        if (ui.messagesLayout) {
            ui.messagesLayout.classList.toggle('show-thread', Boolean(isFriend));
        }
        if (!isFriend) {
            state.activeFriendId = null;
            ui.threadHeader.innerHTML = '<p class="muted-copy">Selecione um amigo confirmado para abrir a conversa.</p>';
            ui.thread.innerHTML = '';
            ui.messageForm.hidden = true;
            if (ui.messagesBack) ui.messagesBack.hidden = true;
            stopMessageSubscription();
            return;
        }
        startMessageSubscription(person.id);
        const friendIsTyping = state.remoteTypingFriendId === person.id;
        ui.threadHeader.innerHTML = `<button class="messages-back" id="messagesBack" type="button" aria-label="Voltar para conversas">←</button>
            ${avatarMarkup(person, 'messages-header-avatar')}
            <span class="messages-header-info">
                ${profileLink(person)}
                <small class="messages-presence${friendIsTyping ? ' is-typing' : ''}">${friendIsTyping ? 'digitando...' : 'Conversa privada'}</small>
            </span>`;
        ui.messageForm.hidden = false;
        const thread = conversationFor(person);
        ui.thread.innerHTML = thread.length
            ? thread.map(message => `<div class="message-bubble${message.from === 'me' ? ' mine' : ''}">
                <span>${escapeHtml(message.text)}</span>
                <time>${escapeHtml(formatMessageTime(message.at))}</time>
            </div>`).join('')
            : emptyMessage('Nenhuma mensagem nesta conversa ainda.');
        ui.thread.scrollTop = ui.thread.scrollHeight;
        bindMessagesBack();
    }

    function renderAll() {
        renderSuggestions();
        renderConfirmedFriends();
        renderRequests();
        renderMessageContacts();
        renderThread();
        setMessageStatus();
    }

    function bindMessagesBack() {
        const button = byId('messagesBack');
        if (!button || button.dataset.bound) return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => {
            state.activeFriendId = null;
            state.remoteTypingFriendId = null;
            clearTimeout(state.remoteTypingTimer);
            renderMessageContacts();
            renderThread();
        });
    }

    function setUserStrip(profile) {
        if (!ui.userName || !ui.userAvatar) return;
        const name = profile?.display_name
            || state.user?.user_metadata?.display_name
            || state.user?.user_metadata?.full_name
            || state.user?.email?.split('@')[0]
            || getAccount()?.name
            || 'Seu nome';
        ui.userName.textContent = name;
        ui.userAvatar.textContent = initialsFor(name);
        ui.userAvatar.innerHTML = '';
        ui.userAvatar.style.backgroundImage = '';
        ui.userAvatar.classList.remove('has-photo');
        if (profile?.avatar_url) {
            ui.userAvatar.textContent = '';
            ui.userAvatar.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            ui.userAvatar.classList.add('has-photo');
        }
    }

    async function refresh() {
        if (state.refreshPromise) return state.refreshPromise;
        state.refreshPromise = (async () => {
            if (!window.ConectaBackend?.configured) {
                state.profilesError = 'Configure a chave publica (anon/publishable) do Supabase.';
                state.requestsError = 'O Supabase nao esta configurado.';
                state.messagesError = 'Configure o Supabase e entre na sua conta para usar as mensagens.';
                renderAll();
                return;
            }

            try {
                state.user = await ConectaBackend.currentUser();
                if (state.messageUserId !== (state.user?.id || null)) {
                    stopMessageSubscription();
                    state.messages = {};
                    state.messageUserId = state.user?.id || null;
                }
                const profileTask = state.user
                    ? ConectaBackend.getProfile(state.user.id).catch(error => {
                        console.warn('Nao foi possivel carregar o perfil da conta atual.', error);
                        return null;
                    })
                    : Promise.resolve(null);
                const requestTask = state.user
                    ? ConectaBackend.getFriendRequests().catch(error => ({ error }))
                    : Promise.resolve([]);
                const messagesTask = state.user
                    ? ConectaBackend.getMessages().catch(error => ({ error }))
                    : Promise.resolve([]);
                const [profiles, ownProfile, requestResult, messageResult] = await Promise.all([
                    ConectaBackend.getProfiles(), profileTask, requestTask, messagesTask
                ]);

                state.profiles = (profiles || [])
                    .filter(person => person?.id && person.id !== state.user?.id)
                    .map(person => ({
                        ...person,
                        display_name: String(person.display_name || 'Usuario').trim() || 'Usuario',
                        bio: String(person.bio || ''),
                        profile_color: safeColor(person.profile_color)
                    }));
                state.profilesById = new Map((profiles || []).filter(person => person?.id).map(person => [person.id, {
                    ...person,
                    display_name: String(person.display_name || 'Usuario').trim() || 'Usuario',
                    bio: String(person.bio || ''),
                    profile_color: safeColor(person.profile_color)
                }]));
                state.profilesError = '';
                state.requestsError = requestResult?.error?.message || '';
                state.requests = state.requestsError ? [] : (requestResult || []);
                state.messagesError = messageResult?.error?.message
                    || (!state.user ? 'Entre na sua conta para usar as mensagens.' : '');
                if (!state.messagesError) {
                    (messageResult || []).forEach(addMessage);
                }
                setUserStrip(ownProfile);
                renderAll();
            } catch (error) {
                console.error('Erro ao atualizar a lista de amigos.', error);
                state.profilesError = error?.message || 'Verifique sua conexao com o Supabase.';
                state.requestsError = state.user ? (state.requestsError || state.profilesError) : '';
                state.messagesError = state.user
                    ? (state.messagesError || state.profilesError)
                    : 'Entre na sua conta para usar as mensagens.';
                state.profiles = [];
                state.profilesById = new Map();
                if (!state.user) state.messages = {};
                if (!state.requestsError) state.requests = [];
                renderAll();
            }
        })().finally(() => {
            state.refreshPromise = null;
        });
        return state.refreshPromise;
    }

    async function performAction(button) {
        const action = button.dataset.action;
        const requestId = button.dataset.requestId || '';
        const personId = button.dataset.personId || '';
        const actionKey = requestId || personId;
        if (!action || state.actions.has(actionKey)) return;
        state.actionError = '';

        if (!state.user) {
            state.actionError = 'Entre na sua conta para usar as solicitacoes de amizade.';
            renderSuggestions();
            return;
        }

        state.actions.add(actionKey);
        button.disabled = true;
        renderAll();
        try {
            if (action === 'send') {
                await ConectaBackend.sendFriendRequest(personId);
            } else if (['accept', 'decline', 'cancel'].includes(action)) {
                const nextStatus = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[action];
                await ConectaBackend.updateFriendRequest(requestId, nextStatus);
            }
            state.actionError = '';
            if (state.refreshPromise) await state.refreshPromise;
            await refresh();
        } catch (error) {
            console.error(`Falha na acao de amizade (${action}).`, error);
            state.actionError = error?.message || 'Nao foi possivel concluir a acao.';
            renderAll();
        } finally {
            state.actions.delete(actionKey);
            renderAll();
        }
    }

    ui.suggestions.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (button) performAction(button);
    });
    ui.confirmed.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (button) performAction(button);
    });
    ui.received.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (button) performAction(button);
    });
    ui.sent.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (button) performAction(button);
    });

    ui.search.addEventListener('input', renderSuggestions);

    if (ui.contacts) {
        ui.contacts.addEventListener('click', event => {
            const contact = event.target.closest('[data-person-id]');
            if (!contact) return;
            state.activeFriendId = contact.dataset.personId;
            state.realtimeError = '';
            renderMessageContacts();
            renderThread();
            if (window.matchMedia('(max-width: 700px)').matches) {
                ui.threadHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                ui.messageInput?.focus();
            }
        });
    }

    if (ui.messageForm) {
        ui.messageInput?.addEventListener('input', setLocalTyping);
        ui.messageInput?.addEventListener('blur', stopLocalTyping);
        ui.messageForm.addEventListener('submit', async event => {
            event.preventDefault();
            const person = profileFor(state.activeFriendId);
            const text = ui.messageInput?.value.trim();
            if (!person || !text || text.length > 2000 || state.sendingMessage
                || !confirmedFriendIds().includes(person.id)) return;
            stopLocalTyping();
            state.sendingMessage = true;
            const submitButton = ui.messageForm.querySelector('[type="submit"]');
            if (submitButton) submitButton.disabled = true;
            try {
                const row = await ConectaBackend.sendMessage(person.id, text);
                addMessage(row);
                state.messagesError = '';
                state.realtimeError = '';
                ui.messageInput.value = '';
            } catch (error) {
                console.error('Falha ao enviar mensagem.', error);
                state.messagesError = error?.message || 'Nao foi possivel enviar a mensagem.';
            } finally {
                state.sendingMessage = false;
                if (submitButton) submitButton.disabled = false;
                renderMessageContacts();
                renderThread();
                setMessageStatus();
                if (state.messagesError) ui.messageInput?.focus();
            }
        });
    }

    document.querySelectorAll('.friends-tab').forEach(button => {
        button.addEventListener('click', () => {
            const showMessages = button.dataset.tab === 'mensagens';
            document.querySelectorAll('.friends-tab').forEach(tab => {
                const active = tab === button;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', String(active));
            });
            if (ui.tabFriends) ui.tabFriends.hidden = showMessages;
            if (ui.tabMessages) ui.tabMessages.hidden = !showMessages;
            if (showMessages) {
                renderMessageContacts();
                renderThread();
            }
        });
    });

    renderAll();
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh();
    });
    window.setInterval(() => {
        if (document.visibilityState === 'visible') refresh();
    }, 20000);
})();
