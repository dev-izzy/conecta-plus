(function () {
    const configured = Boolean(window.CONECTA_SUPABASE_URL && window.CONECTA_SUPABASE_KEY);
    const client = configured && window.supabase
        ? window.supabase.createClient(window.CONECTA_SUPABASE_URL, window.CONECTA_SUPABASE_KEY)
        : null;

    window.ConectaBackend = {
        configured: Boolean(client),
        client,
        async currentUser() {
            if (!client) return null;
            const { data, error } = await client.auth.getUser();
            if (error) return null;
            return data.user;
        },
        async getProfile(userId) {
            if (!client) throw new Error('Configure o Supabase para ativar os perfis compartilhados.');
            const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
            if (error) throw error;
            return data;
        },
        async getProfiles() {
            if (!client) throw new Error('Configure o Supabase para listar usuarios.');
            const { data, error } = await client.from('profiles').select('id, display_name, bio, profile_color, avatar_url').order('display_name');
            if (error) throw error;
            return data || [];
        },
        async getFriendRequests() {
            const user = await this.currentUser();
            if (!user) return [];
            const { data, error } = await client.from('friend_requests')
                .select('id, sender_id, receiver_id, status, created_at')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        async sendFriendRequest(receiverId) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para solicitar amizade.');
            if (user.id === receiverId) throw new Error('Voce nao pode solicitar amizade para si mesmo.');
            const displayName = user.user_metadata?.display_name
                || user.user_metadata?.full_name
                || user.email?.split('@')[0]
                || 'Usuario';
            const { error: profileError } = await client.from('profiles').upsert(
                { id: user.id, display_name: displayName },
                { onConflict: 'id', ignoreDuplicates: true }
            );
            if (profileError) throw profileError;
            const { data, error } = await client.from('friend_requests')
                .insert({ sender_id: user.id, receiver_id: receiverId })
                .select('id, sender_id, receiver_id, status, created_at')
                .single();
            if (error) throw error;
            return data;
        },
        async updateFriendRequest(requestId, status) {
            if (!['accepted', 'declined', 'cancelled'].includes(status)) {
                throw new Error('Acao de amizade invalida.');
            }
            const { data, error } = await client.from('friend_requests')
                .update({ status })
                .eq('id', requestId)
                .select('id, sender_id, receiver_id, status, created_at')
                .single();
            if (error) throw error;
            return data;
        },
        async getMessages() {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para ver suas mensagens.');
            const { data, error } = await client.from('messages')
                .select('id, sender_id, recipient_id, body, created_at')
                .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        async sendMessage(recipientId, body) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para enviar mensagens.');
            const text = String(body || '').trim();
            if (!text || text.length > 2000) throw new Error('A mensagem deve ter entre 1 e 2000 caracteres.');
            const { data, error } = await client.from('messages')
                .insert({ sender_id: user.id, recipient_id: recipientId, body: text })
                .select('id, sender_id, recipient_id, body, created_at')
                .single();
            if (error) throw error;
            return data;
        },
        async subscribeMessages(friendId, onMessage, onTyping, onStatus) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para receber mensagens.');
            const participants = [user.id, friendId].sort();
            return client.channel(`conversation:${participants.join(':')}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                }, payload => {
                    const message = payload.new;
                    if ((message.sender_id === user.id && message.recipient_id === friendId)
                        || (message.sender_id === friendId && message.recipient_id === user.id)) {
                        onMessage(message);
                    }
                })
                .on('broadcast', { event: 'typing' }, ({ payload }) => {
                    if (payload?.sender_id === friendId) {
                        onTyping(payload.is_typing === true);
                    }
                })
                .subscribe(onStatus);
        },
        async sendTyping(channel, senderId, isTyping) {
            if (!channel || !senderId) return;
            return channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender_id: senderId, is_typing: Boolean(isTyping) }
            });
        },
        async getPosts(userId) {
            if (!client) throw new Error('Configure o Supabase para ativar as publicacoes compartilhadas.');
            let query = client.from('service_posts').select('*, profiles!service_posts_author_id_fkey(id, display_name, avatar_url)').order('created_at', { ascending: false });
            if (userId) query = query.eq('author_id', userId);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        async getComments(postIds) {
            if (!client || !postIds.length) return [];
            const { data, error } = await client.from('comments').select('id, post_id, body, created_at, author_id, profiles!comments_author_id_fkey(display_name)').in('post_id', postIds).order('created_at');
            if (error) throw error;
            return data || [];
        },
        async createPost(post) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para publicar.');
            const { data, error } = await client.from('service_posts').insert({ ...post, author_id: user.id }).select('*, profiles!service_posts_author_id_fkey(id, display_name, avatar_url)').single();
            if (error) throw error;
            return data;
        },
        async addComment(postId, body) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para responder.');
            const { error } = await client.from('comments').insert({ post_id: postId, author_id: user.id, body });
            if (error) throw error;
        },
        async deletePost(postId) {
            const { error } = await client.from('service_posts').delete().eq('id', postId);
            if (error) throw error;
        },
        async deleteComment(commentId) {
            const { error } = await client.from('comments').delete().eq('id', commentId);
            if (error) throw error;
        },
        async getLikes(postIds) {
            if (!client || !postIds.length) return [];
            const { data, error } = await client.from('post_likes').select('post_id, user_id').in('post_id', postIds);
            if (error) throw error;
            return data || [];
        },
        async toggleLike(postId) {
            const user = await this.currentUser();
            if (!user) throw new Error('Entre na sua conta para curtir.');
            const { data: existing, error: readError } = await client.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
            if (readError) throw readError;
            const result = existing
                ? await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
                : await client.from('post_likes').insert({ post_id: postId, user_id: user.id });
            if (result.error) throw result.error;
        },
        async updateProfile(userId, profile) {
            const user = await this.currentUser();
            if (!user || user.id !== userId) {
                throw new Error('Voce so pode editar o perfil da sua propria conta.');
            }
            const { data, error } = await client.from('profiles').update(profile).eq('id', userId).select().single();
            if (error) throw error;
            return data;
        },
        async uploadImage(userId, file, folder) {
            if (!file) return null;
            const path = `${userId}/${folder}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { error } = await client.storage.from('social-images').upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            return client.storage.from('social-images').getPublicUrl(path).data.publicUrl;
        }
    };
})();
