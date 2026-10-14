-- Banco de dados do Conecta e + um pouco
-- Compatível com SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT 'Conte para a comunidade quais serviços você oferece.',
    profile_color TEXT NOT NULL DEFAULT '#004c94',
    profile_image TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (length(trim(name)) >= 2),
    CHECK (length(email) >= 5),
    CHECK (profile_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE IF NOT EXISTS service_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Serviços gerais',
    price_cents INTEGER NOT NULL,
    service_image TEXT,
    location TEXT,
    contact TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (length(trim(title)) >= 2),
    CHECK (length(trim(description)) >= 2),
    CHECK (price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES service_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (length(trim(body)) >= 1)
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES service_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (sender_id <> recipient_id),
    CHECK (length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_service_posts_created_at
    ON service_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_posts_user_id
    ON service_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id
    ON comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id
    ON post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
    ON messages(sender_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_created_at
    ON messages(recipient_id, created_at);

CREATE TRIGGER IF NOT EXISTS users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS service_posts_updated_at
AFTER UPDATE ON service_posts
FOR EACH ROW
BEGIN
    UPDATE service_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS comments_updated_at
AFTER UPDATE ON comments
FOR EACH ROW
BEGIN
    UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- View pronta para o feed: autor, preço formatável em reais e total de curtidas.
CREATE VIEW IF NOT EXISTS service_feed AS
SELECT
    posts.id,
    posts.user_id,
    users.name AS author_name,
    users.profile_image AS author_image,
    posts.title,
    posts.description,
    posts.category,
    posts.price_cents,
    posts.service_image,
    posts.created_at,
    COUNT(likes.user_id) AS likes_count
FROM service_posts AS posts
JOIN users ON users.id = posts.user_id
LEFT JOIN post_likes AS likes ON likes.post_id = posts.id
GROUP BY posts.id;

-- Exemplo de consulta do feed com comentários.
-- SELECT feed.*, comments.id AS comment_id, comments.body,
--        comment_authors.name AS comment_author
-- FROM service_feed AS feed
-- LEFT JOIN comments ON comments.post_id = feed.id
-- LEFT JOIN users AS comment_authors ON comment_authors.id = comments.user_id
-- ORDER BY feed.created_at DESC, comments.created_at ASC;
