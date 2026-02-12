        // Прогресс: модуль начал загружаться
        if (window._updateLoadingProgress) window._updateLoadingProgress(20, 'Загрузка Firebase...');

        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
        import {
            getDatabase, ref, set, onValue, remove, push, update, get, query, orderByChild, equalTo, off
        } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
        import {
            getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
            browserLocalPersistence, setPersistence, EmailAuthProvider, reauthenticateWithCredential, updatePassword
        } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
        // App Check временно отключен для диагностики
        import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app-check.js";

        const firebaseConfig = {
            apiKey: "AIzaSyBJbaGaHwdGEEz2xvIB3EM0BNpRU-fj4AU",
            authDomain: "llupat-database.firebaseapp.com",
            databaseURL: "https://llupat-database-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "llupat-database",
            storageBucket: "llupat-database.firebasestorage.app",
            messagingSenderId: "1038954959558",
            appId: "1:1038954959558:web:3b7e2833e33cade2a7fdc7"
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        // Прогресс: Firebase инициализирован
        if (window._updateLoadingProgress) window._updateLoadingProgress(50, 'Настройка безопасности...');

        // App Check временно отключен - раскомментируй после настройки
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('6Lc8mzMsAAAAAPrF2YNYrn-J23_9sPuk3Ly9qhkY'),
            isTokenAutoRefreshEnabled: true
        });

        // Устанавливаем сохранение сессии в localStorage
        setPersistence(auth, browserLocalPersistence);

        // Прогресс: App Check настроен
        if (window._updateLoadingProgress) window._updateLoadingProgress(70, 'Загрузка интерфейса...');

        // ═══════════════════════════════════════════════════════════
        // UTILITY FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        const $ = id => document.getElementById(id);

        function showToast(msg, isError = false) {
            const toast = $('toast');
            toast.textContent = msg;
            toast.className = 'toast show' + (isError ? ' error' : '');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function getDefaultAvatar(id) {
            // Используем официальные Default Avatars Discord
            // Формула: (user_id >> 22) % 6 для новых аккаунтов
            try {
                const index = Number(BigInt(id) >> BigInt(22)) % 6;
                return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
            } catch (e) {
                // Fallback на ui-avatars если ID некорректный
                const colors = ['FF6B35', '00B4D8', '7209B7', '06D6A0', 'FFD166', 'F72585', '4361EE', '4CC9F0'];
                const hash = Math.abs(hashCode(id));
                const color = colors[hash % colors.length];
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const char1 = chars[hash % chars.length];
                const char2 = chars[(hash >> 5) % chars.length];
                return `https://ui-avatars.com/api/?name=${char1}${char2}&background=${color}&color=fff&size=128&bold=true&format=svg`;
            }
        }

        function getDiscordAvatarUrl(userId, avatarHash, size = 128) {
            // Получаем URL аватара Discord если известен hash
            if (!avatarHash) return getDefaultAvatar(userId);
            const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
            return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
        }

        function getAvatarFallback(id) {
            // Резервный вариант - Discord default avatar
            return getDefaultAvatar(id);
        }

        function hashCode(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return hash;
        }

        function generateTicketId() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 6);
            return `TKT-${timestamp}-${random}`.toUpperCase();
        }

        function formatDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function getStatusLabel(status) {
            const labels = {
                'open': 'Открыт',
                'in-progress': 'В работе',
                'closed': 'Закрыт'
            };
            return labels[status] || status;
        }

        function getModeLabel(mode) {
            const labels = {
                'block': '🔨 Block',
                'kog': '⚡ Kog',
                'race': '🏎️ Race',
                'fng': '🎯 FNG'
            };
            return labels[mode] || mode;
        }

        // ═══════════════════════════════════════════════════════════
        // STATE MANAGEMENT
        // ═══════════════════════════════════════════════════════════
        const State = {
            members: [],
            allMembers: {},
            tickets: {},
            userTickets: [],
            currentFilter: 'all',
            currentTicketFilter: 'all',
            currentAdminTicketFilter: 'all',
            currentTicketId: null,
            isAdmin: false,
            isLoggedIn: false,
            currentUser: null,
            currentUserData: null,
            allUsers: {},
            currentAdminTab: 'members',
            userId: localStorage.getItem('llupat_user_id') || generateUserId()
        };

        function generateUserId() {
            const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            localStorage.setItem('llupat_user_id', id);
            return id;
        }

        // ═══════════════════════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════════════════════
        function showSection(id) {
            document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
            $(id).classList.add('active');

            document.querySelectorAll('.nav-links a').forEach(a => {
                a.classList.toggle('active', a.dataset.section === id);
            });

            document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.section === id);
            });
        }

        function showAdminTab(tab) {
            State.currentAdminTab = tab;

            document.querySelectorAll('[data-admin-tab]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.adminTab === tab);
            });

            $('admin-members-tab').style.display = tab === 'members' ? 'block' : 'none';
            $('admin-tickets-tab').style.display = tab === 'tickets' ? 'block' : 'none';
            $('admin-users-tab').style.display = tab === 'users' ? 'block' : 'none';
            $('admin-settings-tab').style.display = tab === 'settings' ? 'block' : 'none';

            // Refresh users list when opening users tab
            if (tab === 'users' && Object.keys(State.allUsers).length > 0) {
                renderUsersManagement(State.allUsers);
            }

            // Load proxy status when opening settings tab
            if (tab === 'settings') {
                checkProxyStatus();
            }
        }

        // ═══════════════════════════════════════════════════════════
        // MEMBERS FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        function filterMembers(mode) {
            State.currentFilter = mode;

            document.querySelectorAll('.filter-tab').forEach(tab => {
                const isActive = tab.textContent.toLowerCase().includes(mode) ||
                    (mode === 'all' && tab.textContent.toLowerCase().includes('все'));
                tab.classList.toggle('active', isActive);
            });

            renderMembers();
        }

        function renderMembers() {
            const grid = $('members-grid');
            let filtered = State.members;

            if (State.currentFilter !== 'all') {
                // Фильтруем по любому из режимов участника
                filtered = State.members.filter(m => {
                    const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                    return modes.includes(State.currentFilter);
                });
            }

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div class="loading">
                        <p>Участников в этой категории пока нет</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = filtered.map(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                const modeBadges = modes.map(mode =>
                    `<span class="game-mode-badge ${mode}">${mode.toUpperCase()}</span>`
                ).join('');

                return `
                <div class="member-card">
                    <div class="member-avatar">
                        <img src="${m.avatarUrl || getDefaultAvatar(m.id)}" 
                             onerror="this.src='${getDefaultAvatar(m.id)}'">
                    </div>
                    <div class="member-info">
                        <div class="member-name">${escapeHtml(m.name)}</div>
                        <div class="member-badges">
                            ${modeBadges}
                            <span class="best-role" style="color: ${m.roleColor || 'var(--secondary)'}; border-color: ${m.roleColor || 'var(--secondary)'}">${escapeHtml(m.bestRole)}</span>
                            ${m.birthday ? '<span class="birthday-badge">🎂 ДР!</span>' : ''}
                        </div>
                    </div>
                </div>
            `}).join('');
        }

        function updateMemberCount() {
            $('members-count').textContent = State.members.length;
        }

        function updateModeCounts() {
            const counts = { block: 0, kog: 0, race: 0, fng: 0 };
            State.members.forEach(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                modes.forEach(mode => {
                    if (counts[mode] !== undefined) counts[mode]++;
                });
            });

            $('count-block').textContent = counts.block;
            $('count-kog').textContent = counts.kog;
            $('count-race').textContent = counts.race;
            $('count-fng').textContent = counts.fng;
        }

        function updateLastUpdateInfo() {
            const now = new Date();
            $('last-update').textContent = now.toLocaleString('ru-RU');
        }

        // ═══════════════════════════════════════════════════════════
        // TICKETS FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        function renderTicketForm() {
            const container = $('ticket-form-container');
            if (!container) return;

            // Check if user is logged in
            if (!State.isLoggedIn || !State.currentUserData || !State.currentUser) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <h3 class="card-title" style="margin-bottom: 1rem;">📝 Создать тикет</h3>
                        <div style="color: var(--warning); font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
                            Для создания тикета необходимо войти в аккаунт
                        </p>
                        <button class="btn btn-primary" onclick="App.openAuthModal()">
                            Войти / Регистрация
                        </button>
                    </div>
                `;
                return;
            }

            // Check if user has active ticket (open or in-progress) - check directly from all tickets
            const userId = State.currentUser.uid;
            const allTickets = Object.values(State.tickets || {});
            const activeTicket = allTickets.find(t =>
                t.userId === userId && (t.status === 'open' || t.status === 'in-progress')
            );

            if (activeTicket) {
                const statusLabel = activeTicket.status === 'open' ? 'Открыт' : 'В работе';
                const statusColor = activeTicket.status === 'open' ? 'var(--success)' : 'var(--warning)';

                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <h3 class="card-title" style="margin-bottom: 1rem;">📝 Создать тикет</h3>
                        <div style="color: var(--secondary); font-size: 3rem; margin-bottom: 1rem;">📋</div>
                        <p style="color: var(--text-muted); margin-bottom: 0.5rem;">
                            У вас уже есть активный тикет
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            <span style="color: ${statusColor}; font-weight: 600;">
                                Статус: ${statusLabel}
                            </span>
                        </p>
                        <button class="btn btn-primary" onclick="App.openTicketDetail('${activeTicket.id}')">
                            Открыть тикет
                        </button>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">
                            Лимит: 1 активный тикет на пользователя
                        </p>
                    </div>
                `;
                return;
            }

            // Show create form
            const username = State.currentUserData.username || '';
            container.innerHTML = `
                <h3 class="card-title">📝 Создать тикет</h3>

                <div style="background: var(--bg-elevated); border: 1px solid var(--border); border-left: 3px solid var(--primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    <p style="color: var(--primary); font-weight: 600; margin-bottom: 0.5rem;">📋 Как составить заявку:</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin: 0;">
                        1) Ваше имя?<br>
                        2) Ваш игровой никнейм?<br>
                        3) Сколько вам лет?<br>
                        4) Ваш дискорд для связи с вами?
                    </p>
                </div>

                <div class="form-group">
                    <label>Ваше имя</label>
                    <input type="text" id="ticket-author" value="${username}" readonly 
                        style="background: var(--bg-dark); cursor: not-allowed;">
                </div>

                <div class="form-group">
                    <label>Режим</label>
                    <select id="ticket-mode">
                        <option value="block">🔨 Block</option>
                        <option value="kog">⚡ Kog</option>
                        <option value="race">🏎️ Race</option>
                        <option value="fng">🎯 FNG</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Сообщение</label>
                    <textarea id="ticket-message" placeholder="Заполните заявку по шаблону выше..."></textarea>
                </div>

                <button class="btn btn-primary" onclick="App.createTicket()">Отправить тикет</button>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem; text-align: center;">
                    Лимит: 1 активный тикет на пользователя
                </p>
            `;
        }

        async function createTicket() {
            // Check if logged in
            if (!State.isLoggedIn || !State.currentUserData || !State.currentUser) {
                showToast('Войдите в аккаунт для создания тикета', true);
                openAuthModal();
                return;
            }

            const userId = State.currentUser.uid;
            const author = State.currentUserData.username;
            const gameMode = $('ticket-mode')?.value;
            const message = $('ticket-message')?.value?.trim();

            if (!message) {
                showToast('Введите сообщение!', true);
                return;
            }

            // Disable button while checking
            const submitBtn = document.querySelector('#ticket-form-container .btn-primary');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Проверка...';
            }

            try {
                // ВАЖНО: Используем query для получения только своих тикетов (соответствует правилам Firebase)
                const userTicketsQuery = query(ref(db, 'tickets'), orderByChild('userId'), equalTo(userId));
                const ticketsSnapshot = await get(userTicketsQuery);
                const userTicketsData = ticketsSnapshot.val() || {};
                const userTickets = Object.values(userTicketsData);

                // Проверяем есть ли активный тикет
                const activeTicket = userTickets.find(t =>
                    t.status === 'open' || t.status === 'in-progress'
                );

                if (activeTicket) {
                    showToast('У вас уже есть активный тикет!', true);
                    // Обновляем локальный кэш тикетов пользователя
                    Object.assign(State.tickets, userTicketsData);
                    renderTicketForm();
                    renderUserTickets();
                    return;
                }

                const ticketId = generateTicketId();
                const ticketData = {
                    id: ticketId,
                    author: author,
                    userId: userId,
                    gameMode: gameMode,
                    status: 'open',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    messages: [{
                        id: 1,
                        author: author,
                        content: message,
                        isAdmin: false,
                        timestamp: Date.now()
                    }]
                };

                await set(ref(db, 'tickets/' + ticketId), ticketData);
                showToast('Тикет создан! ID: ' + ticketId);
                if ($('ticket-message')) $('ticket-message').value = '';
                // Form will update automatically via onValue listener
            } catch (err) {
                console.error('Create ticket error:', err);
                showToast('Ошибка: ' + err.message, true);
            } finally {
                // Re-enable button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Отправить тикет';
                }
            }
        }

        function filterTickets(filter) {
            State.currentTicketFilter = filter;

            document.querySelectorAll('.ticket-filter-tab[data-filter]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });

            renderUserTickets();
        }

        function renderUserTickets() {
            const container = $('user-tickets-list');
            if (!container) return;

            // Проверяем авторизацию
            if (!State.currentUser || !State.currentUser.uid) {
                container.innerHTML = `
                    <div class="empty-tickets">
                        <p>🔒 Войдите в аккаунт</p>
                        <small>Чтобы увидеть свои тикеты, необходимо авторизоваться</small>
                    </div>
                `;
                // Reset counts
                if ($('filter-count-all')) $('filter-count-all').textContent = '0';
                if ($('filter-count-open')) $('filter-count-open').textContent = '0';
                if ($('filter-count-progress')) $('filter-count-progress').textContent = '0';
                if ($('filter-count-closed')) $('filter-count-closed').textContent = '0';
                return;
            }

            // Get user tickets directly from all tickets
            const userId = State.currentUser.uid;
            const allTickets = Object.values(State.tickets || {});

            // Фильтруем тикеты текущего пользователя
            let userTickets = allTickets.filter(t => t.userId === userId);

            // Update State.userTickets for consistency
            State.userTickets = userTickets;

            let tickets = userTickets;

            if (State.currentTicketFilter !== 'all') {
                tickets = tickets.filter(t => t.status === State.currentTicketFilter);
            }

            // Update counts
            const allCount = userTickets.length;
            const openCount = userTickets.filter(t => t.status === 'open').length;
            const progressCount = userTickets.filter(t => t.status === 'in-progress').length;
            const closedCount = userTickets.filter(t => t.status === 'closed').length;

            if ($('filter-count-all')) $('filter-count-all').textContent = allCount;
            if ($('filter-count-open')) $('filter-count-open').textContent = openCount;
            if ($('filter-count-progress')) $('filter-count-progress').textContent = progressCount;
            if ($('filter-count-closed')) $('filter-count-closed').textContent = closedCount;

            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="empty-tickets">
                        <p>🎫 ${State.currentTicketFilter === 'all' ? 'У вас пока нет тикетов' : 'Нет тикетов в этой категории'}</p>
                        <small>Создайте тикет выше, чтобы связаться с администрацией</small>
                    </div>
                `;
                return;
            }

            container.innerHTML = tickets.sort((a, b) => b.updatedAt - a.updatedAt).map(ticket => `
                <div class="ticket-card ${ticket.status}" onclick="App.openTicketDetail('${ticket.id}')">
                    <div class="ticket-header">
                        <div>
                            <div class="ticket-title">${ticket.author} - ${getModeLabel(ticket.gameMode)}</div>
                            <div class="ticket-id">${ticket.id}</div>
                        </div>
                        <span class="ticket-status ${ticket.status}">${getStatusLabel(ticket.status)}</span>
                    </div>
                    <div class="ticket-preview">
                        ${ticket.messages[0].content.substring(0, 100)}${ticket.messages[0].content.length > 100 ? '...' : ''}
                    </div>
                    <div class="ticket-meta">
                        <span>📅 ${formatDate(ticket.createdAt)}</span>
                        <span>💬 ${ticket.messages.length} сообщений</span>
                    </div>
                </div>
            `).join('');
        }

        function openTicketDetail(ticketId) {
            const ticket = State.tickets[ticketId];

            if (!ticket) {
                showToast('Тикет не найден', true);
                return;
            }

            // Проверяем авторизацию
            if (!State.currentUser) {
                showToast('Войдите в аккаунт для просмотра тикета', true);
                openAuthModal();
                return;
            }

            const currentUserId = State.currentUser.uid;

            // Проверяем доступ: только свои тикеты или админ
            if (!State.isAdmin && ticket.userId !== currentUserId) {
                showToast('У вас нет доступа к этому тикету', true);
                return;
            }

            State.currentTicketId = ticketId;

            $('tickets-list-view').style.display = 'none';
            $('ticket-detail-view').style.display = 'block';

            renderTicketDetail(ticket);
        }

        function renderTicketDetail(ticket) {
            const isAdmin = State.isAdmin;
            const container = $('ticket-detail-content');

            container.innerHTML = `
                <div class="ticket-detail-header">
                    <h2 class="ticket-detail-title">${ticket.author} - ${getModeLabel(ticket.gameMode)}</h2>
                    <div class="ticket-detail-info">
                        <span>🎫 ${ticket.id}</span>
                        <span>📅 ${formatDate(ticket.createdAt)}</span>
                        <span class="ticket-status ${ticket.status}">${getStatusLabel(ticket.status)}</span>
                    </div>
                </div>

                <div style="background: var(--bg-elevated); border: 1px solid var(--border); border-left: 3px solid var(--primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    <p style="color: var(--primary); font-weight: 600; margin-bottom: 0.5rem;">📋 Как составить заявку:</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin: 0;">
                        1) Ваше имя?<br>
                        2) Ваш игровой никнейм?<br>
                        3) Сколько вам лет?<br>
                        4) Ваш дискорд для связи с вами?
                    </p>
                </div>

                <div class="ticket-messages" id="ticket-messages">
                    ${ticket.messages.map(msg => `
                        <div class="ticket-message ${msg.isAdmin ? 'admin' : 'user'}">
                            <div class="message-author ${msg.isAdmin ? 'admin-author' : 'user-author'}">
                                ${msg.isAdmin ? '🛡️ ' : '👤 '}${msg.author}
                            </div>
                            <div class="message-content">${msg.content}</div>
                            <div class="message-time">${formatDate(msg.timestamp)}</div>
                        </div>
                    `).join('')}
                </div>

                ${ticket.status !== 'closed' ? `
                    <div class="ticket-reply-form">
                        <div class="form-group">
                            <label>Ответить на тикет</label>
                            <textarea id="ticket-reply" placeholder="Введите ваше сообщение..."></textarea>
                        </div>
                        <div class="ticket-actions">
                            <button class="btn btn-primary" onclick="App.sendTicketReply('${ticket.id}')">
                                Отправить
                            </button>
                            ${isAdmin ? `
                                <button class="btn btn-warning" onclick="App.changeTicketStatus('${ticket.id}', 'in-progress')">
                                    В работу
                                </button>
                                <button class="btn btn-danger" onclick="App.changeTicketStatus('${ticket.id}', 'closed')">
                                    Закрыть
                                </button>
                                <button class="btn btn-danger" onclick="App.deleteTicket('${ticket.id}')" style="background: #8b0000;">
                                    🗑️ Удалить
                                </button>
                            ` : ''}
                        </div>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <p>🔒 Этот тикет закрыт</p>
                        ${isAdmin ? `
                            <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                                <button class="btn btn-success" onclick="App.changeTicketStatus('${ticket.id}', 'open')">
                                    Переоткрыть тикет
                                </button>
                                <button class="btn btn-danger" onclick="App.deleteTicket('${ticket.id}')">
                                    🗑️ Удалить тикет
                                </button>
                            </div>
                        ` : '<p style="margin-top: 1rem; font-size: 0.85rem;">Если вам нужна дополнительная помощь, создайте новый тикет.</p>'}
                    </div>
                `}
            `;

            // Scroll to bottom of messages
            const messagesContainer = $('ticket-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        function closeTicketDetail() {
            State.currentTicketId = null;
            $('tickets-list-view').style.display = 'block';
            $('ticket-detail-view').style.display = 'none';
        }

        function sendTicketReply(ticketId) {
            const replyText = $('ticket-reply').value.trim();

            if (!replyText) {
                showToast('Введите сообщение!', true);
                return;
            }

            const ticket = State.tickets[ticketId];
            if (!ticket) return;

            // Проверяем доступ: только свои тикеты или админ
            if (!State.isAdmin && ticket.userId !== State.currentUser?.uid) {
                showToast('У вас нет доступа к этому тикету', true);
                return;
            }

            // Получаем ник текущего пользователя
            const authorName = State.currentUserData?.username || 'Пользователь';

            const newMessage = {
                id: ticket.messages.length + 1,
                author: authorName,
                content: replyText,
                isAdmin: State.isAdmin,
                timestamp: Date.now()
            };

            const updates = {};
            updates[`tickets/${ticketId}/messages`] = [...ticket.messages, newMessage];
            updates[`tickets/${ticketId}/updatedAt`] = Date.now();

            update(ref(db), updates)
                .then(() => {
                    showToast('Сообщение отправлено!');
                    $('ticket-reply').value = '';
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        function changeTicketStatus(ticketId, newStatus) {
            // Только админы могут менять статус тикетов
            if (!State.isAdmin) {
                showToast('Только администраторы могут менять статус тикетов', true);
                return;
            }

            const statusNames = {
                'open': 'Открыт',
                'in-progress': 'В работе',
                'closed': 'Закрыт'
            };

            if (newStatus === 'closed' && !confirm('Вы уверены, что хотите закрыть этот тикет?')) {
                return;
            }

            const updates = {};
            updates[`tickets/${ticketId}/status`] = newStatus;
            updates[`tickets/${ticketId}/updatedAt`] = Date.now();

            update(ref(db), updates)
                .then(() => {
                    showToast(`Статус изменён на: ${statusNames[newStatus]}`);
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        function deleteTicket(ticketId) {
            if (!State.isAdmin) {
                showToast('Только администраторы могут удалять тикеты', true);
                return;
            }

            if (!confirm('Вы уверены, что хотите удалить этот тикет? Это действие нельзя отменить.')) {
                return;
            }

            remove(ref(db, 'tickets/' + ticketId))
                .then(() => {
                    showToast('Тикет удалён!');
                    closeTicketModal();
                    closeTicketDetail();
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        // Admin Tickets Functions
        function filterAdminTickets(filter) {
            State.currentAdminTicketFilter = filter;

            document.querySelectorAll('.ticket-filter-tab[data-admin-filter]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.adminFilter === filter);
            });

            renderAdminTickets();
        }

        function searchAdminTickets() {
            renderAdminTickets();
        }

        function renderAdminTickets() {
            const container = $('admin-tickets-list');
            let tickets = Object.values(State.tickets);

            // Apply filter
            if (State.currentAdminTicketFilter !== 'all') {
                tickets = tickets.filter(t => t.status === State.currentAdminTicketFilter);
            }

            // Apply search
            const searchTerm = $('admin-ticket-search')?.value.toLowerCase() || '';
            if (searchTerm) {
                tickets = tickets.filter(t =>
                    t.gameMode.toLowerCase().includes(searchTerm) ||
                    t.author.toLowerCase().includes(searchTerm) ||
                    t.id.toLowerCase().includes(searchTerm)
                );
            }

            // Update stats
            const allTickets = Object.values(State.tickets);
            $('admin-tickets-total').textContent = allTickets.length;
            $('admin-tickets-open').textContent = allTickets.filter(t => t.status === 'open').length;
            $('admin-tickets-progress').textContent = allTickets.filter(t => t.status === 'in-progress').length;
            $('admin-tickets-closed').textContent = allTickets.filter(t => t.status === 'closed').length;

            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="empty-tickets">
                        <p>🎫 Нет тикетов</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = tickets.sort((a, b) => b.updatedAt - a.updatedAt).map(ticket => `
                <div class="ticket-card ${ticket.status}" onclick="App.openAdminTicketModal('${ticket.id}')">
                    <div class="ticket-header">
                        <div>
                            <div class="ticket-title">${ticket.author} - ${getModeLabel(ticket.gameMode)}</div>
                            <div class="ticket-id">${ticket.id}</div>
                        </div>
                        <span class="ticket-status ${ticket.status}">${getStatusLabel(ticket.status)}</span>
                    </div>
                    <div class="ticket-preview">
                        ${ticket.messages[0].content.substring(0, 100)}${ticket.messages[0].content.length > 100 ? '...' : ''}
                    </div>
                    <div class="ticket-meta">
                        <span>📅 ${formatDate(ticket.createdAt)}</span>
                        <span>💬 ${ticket.messages.length} сообщений</span>
                        <span>🔄 ${formatDate(ticket.updatedAt)}</span>
                    </div>
                </div>
            `).join('');
        }

        function openAdminTicketModal(ticketId) {
            const ticket = State.tickets[ticketId];
            if (!ticket) return;

            const isAlreadyOpen = State.currentTicketId === ticketId;
            State.currentTicketId = ticketId;

            const modal = $('ticket-modal');
            const content = $('ticket-modal-content');

            content.innerHTML = `
                <div class="modal-header">
                    <h2>🎫 ${ticket.author} - ${getModeLabel(ticket.gameMode)}</h2>
                </div>

                <div class="ticket-detail-info" style="margin-bottom: 1.5rem;">
                    <span>📋 ${ticket.id}</span>
                    <span>📅 ${formatDate(ticket.createdAt)}</span>
                    <span class="ticket-status ${ticket.status}">${getStatusLabel(ticket.status)}</span>
                </div>

                <div style="background: var(--bg-elevated); border: 1px solid var(--border); border-left: 3px solid var(--primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    <p style="color: var(--primary); font-weight: 600; margin-bottom: 0.5rem;">📋 Как составить заявку:</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin: 0;">
                        1) Ваше имя?<br>
                        2) Ваш игровой никнейм?<br>
                        3) Сколько вам лет?<br>
                        4) Ваш дискорд для связи с вами?
                    </p>
                </div>

                <div class="ticket-messages" id="modal-ticket-messages" style="max-height: 300px;">
                    ${ticket.messages.map(msg => `
                        <div class="ticket-message ${msg.isAdmin ? 'admin' : 'user'}">
                            <div class="message-author ${msg.isAdmin ? 'admin-author' : 'user-author'}">
                                ${msg.isAdmin ? '🛡️ ' : '👤 '}${msg.author}
                            </div>
                            <div class="message-content">${msg.content}</div>
                            <div class="message-time">${formatDate(msg.timestamp)}</div>
                        </div>
                    `).join('')}
                </div>

                ${ticket.status !== 'closed' ? `
                    <div class="ticket-reply-form">
                        <div class="form-group">
                            <label>Ответ администратора</label>
                            <textarea id="modal-ticket-reply" placeholder="Введите ваш ответ..."></textarea>
                        </div>
                        <div class="ticket-actions">
                            <button class="btn btn-primary" onclick="App.sendAdminReply('${ticket.id}')">
                                Отправить
                            </button>
                            <button class="btn btn-warning" onclick="App.changeTicketStatus('${ticket.id}', 'in-progress'); App.closeTicketModal();">
                                В работу
                            </button>
                            <button class="btn btn-danger" onclick="App.changeTicketStatus('${ticket.id}', 'closed'); App.closeTicketModal();">
                                Закрыть
                            </button>
                            <button class="btn btn-danger" onclick="App.deleteTicket('${ticket.id}')" style="background: #8b0000;">
                                🗑️ Удалить
                            </button>
                        </div>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
                        <p>🔒 Этот тикет закрыт</p>
                        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                            <button class="btn btn-success" onclick="App.changeTicketStatus('${ticket.id}', 'open'); App.closeTicketModal();">
                                Переоткрыть
                            </button>
                            <button class="btn btn-danger" onclick="App.deleteTicket('${ticket.id}')">
                                🗑️ Удалить
                            </button>
                        </div>
                    </div>
                `}
            `;

            // Показываем модальное окно только если оно еще не открыто
            if (!isAlreadyOpen) {
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('open'), 10);
            }

            // Scroll messages to bottom
            const messagesContainer = $('modal-ticket-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        function sendAdminReply(ticketId) {
            const replyText = $('modal-ticket-reply').value.trim();

            if (!replyText) {
                showToast('Введите сообщение!', true);
                return;
            }

            const ticket = State.tickets[ticketId];
            if (!ticket) return;

            const newMessage = {
                id: ticket.messages.length + 1,
                author: State.currentUserData?.username || 'Администратор',
                content: replyText,
                isAdmin: true,
                timestamp: Date.now()
            };

            const updates = {};
            updates[`tickets/${ticketId}/messages`] = [...ticket.messages, newMessage];
            updates[`tickets/${ticketId}/updatedAt`] = Date.now();

            // Auto set to in-progress if it was open
            if (ticket.status === 'open') {
                updates[`tickets/${ticketId}/status`] = 'in-progress';
            }

            update(ref(db), updates)
                .then(() => {
                    showToast('Ответ отправлен!');
                    $('modal-ticket-reply').value = '';
                    // Небольшая задержка чтобы Firebase обновил данные
                    setTimeout(() => openAdminTicketModal(ticketId), 100);
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        function closeTicketModal() {
            const modal = $('ticket-modal');
            modal.classList.remove('open');
            setTimeout(() => modal.style.display = 'none', 300);
            State.currentTicketId = null;
        }

        // ═══════════════════════════════════════════════════════════
        // AVATAR FUNCTIONS (Discord API Integration)
        // ═══════════════════════════════════════════════════════════
        // Discord API Reference: https://discord.com/developers/docs/reference#image-formatting
        // 
        // Используем Vercel Serverless Functions для получения аватарок
        // API endpoint: /api/avatar?id={userId}
        // ═══════════════════════════════════════════════════════════

        // Для Vercel - пустая строка (относительные пути)
        // Для локальной разработки - http://localhost:3000
        const DISCORD_API_URL = '';

        function loadAvatarById() {
            const id = $('inp-id').value.trim();
            const previewBox = $('preview-box');

            if (!id || id.length < 17) {
                previewBox.innerHTML = '?';
                previewBox.className = 'avatar-preview';
                delete previewBox.dataset.avatarUrl;
                delete previewBox.dataset.avatarHash;
                return;
            }

            // Проверяем что это валидный Discord Snowflake ID
            if (!/^\d{17,19}$/.test(id)) {
                previewBox.innerHTML = '❌';
                previewBox.className = 'avatar-preview error';
                showToast('Некорректный Discord ID', true);
                return;
            }

            fetchDiscordAvatar(id, previewBox);
        }

        function loadEditAvatarById(id) {
            const previewBox = $('edit-preview-box');
            if (!id || id.length < 17 || !/^\d{17,19}$/.test(id)) {
                previewBox.innerHTML = '?';
                previewBox.className = 'avatar-preview';
                return;
            }
            fetchDiscordAvatar(id, previewBox);
        }

        async function fetchDiscordAvatar(userId, previewBox) {
            // Получаем аватар через Vercel API
            // Endpoint: /api/avatar?id={userId}

            previewBox.innerHTML = '⏳';
            previewBox.className = 'avatar-preview loading';

            let avatarUrl = null;
            let avatarHash = null;
            let username = null;

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`${DISCORD_API_URL}/api/avatar?id=${userId}&size=256`, {
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timeout);

                if (response.ok) {
                    const data = await response.json();
                    avatarUrl = data.avatarUrl;
                    avatarHash = data.avatar;
                    username = data.username;

                    if (username && !data.isDefault) {
                        showToast(`✓ ${username}`, false);
                    }

                    if (data.error) {
                        console.log('API warning:', data.error);
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.log('API error:', errorData);
                    if (errorData.error?.includes('Invalid')) {
                        showToast('Некорректный Discord ID', true);
                    }
                }
            } catch (e) {
                if (e.name === 'AbortError') {
                    console.log('Request timeout');
                } else {
                    console.log('API unavailable:', e.message);
                }
            }

            // Fallback на Discord Default Avatar
            if (!avatarUrl) {
                avatarUrl = getDefaultAvatar(userId);
            }

            // Загружаем изображение
            const img = new Image();
            img.onload = () => {
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                previewBox.className = 'avatar-preview success';
                previewBox.style.background = '';
                previewBox.dataset.avatarUrl = avatarUrl;
                if (avatarHash) {
                    previewBox.dataset.avatarHash = avatarHash;
                }
            };
            img.onerror = () => {
                // Если Discord CDN не отвечает, используем fallback
                const fallbackUrl = getDefaultAvatar(userId);
                const fallbackImg = new Image();
                fallbackImg.onload = () => {
                    previewBox.innerHTML = '';
                    previewBox.appendChild(fallbackImg);
                    previewBox.className = 'avatar-preview success';
                    previewBox.style.background = '';
                    previewBox.dataset.avatarUrl = fallbackUrl;
                };
                fallbackImg.onerror = () => {
                    // Финальный fallback на цветные буквы
                    const hash = Math.abs(hashCode(userId));
                    const colors = ['#FF6B35', '#00B4D8', '#7209B7', '#06D6A0', '#FFD166', '#F72585', '#4361EE'];
                    const color = colors[hash % colors.length];
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                    const char1 = chars[hash % chars.length];
                    const char2 = chars[(hash >> 5) % chars.length];
                    previewBox.innerHTML = char1 + char2;
                    previewBox.className = 'avatar-preview success';
                    previewBox.style.background = color;
                    previewBox.dataset.avatarUrl = '';
                };
                fallbackImg.src = fallbackUrl;
            };
            img.src = avatarUrl;
        }

        function loadAvatarPreview(url, previewBox) {
            const img = new Image();
            img.onload = () => {
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                previewBox.className = 'avatar-preview success';
            };
            img.onerror = () => {
                previewBox.innerHTML = '❌';
                previewBox.className = 'avatar-preview error';
            };
            img.src = url;
        }

        // ═══════════════════════════════════════════════════════════
        // DISCORD PROXY SERVER FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        async function checkProxyStatus() {
            const statusDiv = $('proxy-status');

            statusDiv.innerHTML = `
                <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 8px;">
                    <span style="color: var(--text-muted);">🔄 Проверка API...</span>
                </div>
            `;

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`${DISCORD_API_URL}/api/health`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (response.ok) {
                    const data = await response.json();
                    statusDiv.innerHTML = `
                        <div style="padding: 1rem; background: rgba(6, 214, 160, 0.1); border-radius: 8px; border-left: 3px solid var(--success);">
                            <strong style="color: var(--success);">✅ API работает!</strong>
                            <div style="margin-top: 0.5rem; color: var(--text-muted);">
                                Статус: ${data.status}
                                <br>Версия: ${data.version || '1.0.0'}
                            </div>
                        </div>
                    `;
                    showToast('API доступен!');
                } else {
                    throw new Error('Server returned ' + response.status);
                }
            } catch (error) {
                let errorMessage = 'API недоступен';
                if (error.name === 'AbortError') {
                    errorMessage = 'Превышено время ожидания';
                }

                statusDiv.innerHTML = `
                    <div style="padding: 1rem; background: rgba(239, 71, 111, 0.1); border-radius: 8px; border-left: 3px solid var(--danger);">
                        <strong style="color: var(--danger);">❌ ${errorMessage}</strong>
                        <div style="margin-top: 0.5rem; color: var(--text-muted);">
                            Проверьте деплой на Vercel
                        </div>
                    </div>
                `;
                showToast('API недоступен', true);
            }
        }

        async function refreshAllAvatars() {
            // Проверяем доступность API
            try {
                const healthCheck = await fetch(`${DISCORD_API_URL}/api/health`);
                if (!healthCheck.ok) throw new Error('API unavailable');
            } catch (e) {
                showToast('API недоступен', true);
                return;
            }

            const members = Object.entries(State.allMembers);
            if (members.length === 0) {
                showToast('Нет участников для обновления', true);
                return;
            }

            const progressDiv = $('refresh-progress');
            const btn = $('refresh-avatars-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Обновление...';

            let updated = 0;
            let failed = 0;

            for (const [id, member] of members) {
                progressDiv.innerHTML = `
                    <div style="padding: 0.5rem; background: var(--bg-elevated); border-radius: 8px;">
                        Обновление: ${member.name} (${updated + failed + 1}/${members.length})
                    </div>
                `;

                try {
                    const avatarUrl = await fetchAvatarFromProxy(id);
                    if (avatarUrl) {
                        await update(ref(db, 'members/' + id), { avatarUrl });
                        updated++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.error(`Failed to update avatar for ${id}:`, error);
                    failed++;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            btn.disabled = false;
            btn.textContent = '🔄 Обновить аватарки всех участников';

            progressDiv.innerHTML = `
                <div style="padding: 1rem; background: rgba(6, 214, 160, 0.1); border-radius: 8px; border-left: 3px solid var(--success);">
                    <strong style="color: var(--success);">✅ Готово!</strong>
                    <span style="color: var(--text-muted);"> — Обновлено: ${updated}, Ошибок: ${failed}</span>
                </div>
            `;

            showToast(`Обновлено ${updated} аватарок`);
        }

        async function fetchAvatarFromProxy(userId) {
            // Fetch avatar via Vercel API
            try {
                const response = await fetch(`${DISCORD_API_URL}/api/avatar?id=${userId}&size=256`);

                if (response.ok) {
                    const data = await response.json();
                    if (data.avatarUrl && !data.isDefault) {
                        return data.avatarUrl;
                    }
                }
                return null;
            } catch (error) {
                console.error('API request error:', error);
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════
        // AUTH FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        function openAuthModal() {
            const modal = $('auth-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('open'), 10);
        }

        function closeAuthModal() {
            const modal = $('auth-modal');
            modal.classList.remove('open');
            setTimeout(() => modal.style.display = 'none', 300);
            // Clear errors and inputs
            $('login-error').textContent = '';
            $('register-error').textContent = '';
        }

        function switchAuthTab(tab) {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`[data-auth-tab="${tab}"]`).classList.add('active');

            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            $(tab + '-form').classList.add('active');

            // Clear errors
            $('login-error').textContent = '';
            $('register-error').textContent = '';
        }

        function usernameToEmail(username) {
            // Convert username to fake email for Firebase Auth
            return username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@llupat.local';
        }

        async function register() {
            const username = $('register-username').value.trim();
            const password = $('register-password').value;
            const passwordConfirm = $('register-password-confirm').value;

            // Validation
            if (!username) {
                $('register-error').textContent = 'Введите никнейм';
                return;
            }
            if (username.length < 3) {
                $('register-error').textContent = 'Никнейм должен быть минимум 3 символа';
                return;
            }
            if (username.length > 20) {
                $('register-error').textContent = 'Никнейм не должен превышать 20 символов';
                return;
            }
            if (password.length < 6) {
                $('register-error').textContent = 'Пароль должен быть минимум 6 символов';
                return;
            }
            if (password !== passwordConfirm) {
                $('register-error').textContent = 'Пароли не совпадают';
                return;
            }

            // Check if username already exists via public 'usernames' table
            try {
                const usernameKey = username.toLowerCase();
                const usernameRef = ref(db, 'usernames/' + usernameKey);
                const usernameSnapshot = await get(usernameRef);

                if (usernameSnapshot.exists()) {
                    $('register-error').textContent = 'Этот никнейм уже занят';
                    return;
                }

                // Create user in Firebase Auth
                const email = usernameToEmail(username);
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;

                // Prepare user data
                const userData = {
                    username: username,
                    role: 'user', // Default role
                    createdAt: Date.now(),
                    email: email
                };

                // Save user data AND register username atomically
                const updates = {};
                updates['users/' + uid] = userData;
                updates['usernames/' + usernameKey] = uid;

                await update(ref(db), updates);

                // Manually update State and UI (faster than waiting for onAuthStateChanged)
                State.currentUser = userCredential.user;
                State.currentUserData = userData;
                State.isLoggedIn = true;
                State.isAdmin = false;

                updateNavUI(userCredential.user, userData);
                renderProfile(userData);

                // Обновляем отображение тикетов для нового пользователя
                renderUserTickets();
                renderTicketForm();

                showToast('Аккаунт создан! Добро пожаловать, ' + username);
                closeAuthModal();

                // Clear form
                $('register-username').value = '';
                $('register-password').value = '';
                $('register-password-confirm').value = '';

            } catch (error) {
                console.error('Registration error:', error);
                if (error.code === 'auth/email-already-in-use') {
                    $('register-error').textContent = 'Этот никнейм уже зарегистрирован';
                } else {
                    $('register-error').textContent = 'Ошибка регистрации: ' + error.message;
                }
            }
        }

        async function login() {
            const username = $('login-username').value.trim();
            const password = $('login-password').value;

            if (!username || !password) {
                $('login-error').textContent = 'Введите никнейм и пароль';
                return;
            }

            try {
                const email = usernameToEmail(username);
                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                // Load user data immediately
                const userSnapshot = await get(ref(db, 'users/' + userCredential.user.uid));
                const userData = userSnapshot.val();

                if (userData) {
                    // Update State
                    State.currentUser = userCredential.user;
                    State.currentUserData = userData;
                    State.isLoggedIn = true;
                    State.isAdmin = userData.role === 'admin';

                    // Update UI
                    updateNavUI(userCredential.user, userData);
                    renderProfile(userData);

                    // ВАЖНО: Устанавливаем listener для тикетов
                    setupTicketsListener();

                    // Handle admin panel
                    if (State.isAdmin) {
                        $('admin-login').style.display = 'none';
                        $('admin-dashboard').classList.add('active');

                        if (Object.keys(State.allMembers).length > 0) {
                            renderAdminTable(State.allMembers);
                            updateAdminStats(State.allMembers);
                        }
                    }
                }

                showToast('Вход выполнен!');
                closeAuthModal();

                // Clear form
                $('login-username').value = '';
                $('login-password').value = '';

            } catch (error) {
                console.error('Login error:', error);
                $('login-error').textContent = 'Неверный никнейм или пароль';
            }
        }

        function logout() {
            signOut(auth).then(() => {
                showToast('Вы вышли из системы');
                closeUserDropdown();
            });
        }

        function toggleUserDropdown() {
            const dropdown = $('user-dropdown');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        }

        function closeUserDropdown() {
            const dropdown = $('user-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-user-wrapper')) {
                closeUserDropdown();
            }
        });

        function updateNavUI(user, userData) {
            const container = $('nav-auth-container');
            const adminLink = $('nav-admin-link');

            if (user && userData) {
                const initial = userData.username.charAt(0).toUpperCase();
                const roleLabel = userData.role === 'admin' ? 'Администратор' : 'Участник';
                const roleClass = userData.role === 'admin' ? 'admin' : '';

                container.innerHTML = `
                    <div class="nav-user-wrapper">
                        <div class="nav-user" onclick="App.toggleUserDropdown()">
                            <div class="nav-user-avatar">${initial}</div>
                            <div class="nav-user-info">
                                <span class="nav-user-name">${userData.username}</span>
                                <span class="nav-user-role ${roleClass}">${roleLabel}</span>
                            </div>
                        </div>
                        <div class="user-dropdown" id="user-dropdown">
                            <div class="dropdown-item" onclick="App.showSection('profile'); App.closeUserDropdown();">
                                👤 Мой профиль
                            </div>
                            ${userData.role === 'admin' ? `
                            <div class="dropdown-item" onclick="App.showSection('admin'); App.closeUserDropdown();">
                                ⚙️ Админ-панель
                            </div>
                            ` : ''}
                            <div class="dropdown-divider"></div>
                            <div class="dropdown-item danger" onclick="App.logout()">
                                🚪 Выйти
                            </div>
                        </div>
                    </div>
                `;

                // Show/hide admin link based on role
                if (userData.role === 'admin') {
                    adminLink.style.display = 'block';
                } else {
                    adminLink.style.display = 'none';
                }
            } else {
                container.innerHTML = `
                    <button class="nav-auth-btn" onclick="App.openAuthModal()">Войти</button>
                `;
                adminLink.style.display = 'none';
            }
        }

        async function changeUserRole(uid, newRole) {
            if (!State.isAdmin) {
                showToast('У вас нет прав для этого действия', true);
                return;
            }

            try {
                await update(ref(db, 'users/' + uid), { role: newRole });
                showToast('Роль пользователя изменена');
            } catch (error) {
                showToast('Ошибка: ' + error.message, true);
            }
        }

        function renderUsersManagement(users) {
            const container = $('users-list');
            if (!container) return;

            const usersArray = Object.entries(users);

            if (usersArray.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Нет пользователей</p>';
                return;
            }

            container.innerHTML = usersArray.map(([uid, user]) => `
                <div class="user-row">
                    <div class="user-row-info">
                        <div class="user-row-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="user-row-name">${user.username}</div>
                            <div class="user-row-email">ID: ${uid.substring(0, 8)}...</div>
                        </div>
                    </div>
                    <select class="role-select" onchange="App.changeUserRole('${uid}', this.value)" ${uid === State.currentUser?.uid ? 'disabled' : ''}>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Участник</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
            `).join('');
        }

        // ═══════════════════════════════════════════════════════════
        // MEMBER MANAGEMENT
        // ═══════════════════════════════════════════════════════════
        function saveMember() {
            const id = $('inp-id').value.trim();
            const name = $('inp-name').value.trim();

            // Собираем выбранные режимы игры
            const gameModes = [];
            if ($('inp-mode-block').checked) gameModes.push('block');
            if ($('inp-mode-kog').checked) gameModes.push('kog');
            if ($('inp-mode-race').checked) gameModes.push('race');
            if ($('inp-mode-fng').checked) gameModes.push('fng');

            const role = $('inp-role').value.trim() || 'Участник';
            const roleColor = $('inp-role-color').value;
            const avatarUrl = $('preview-box').dataset.avatarUrl;

            if (!id || !name) {
                showToast('Заполните ID и никнейм!', true);
                return;
            }

            if (gameModes.length === 0) {
                showToast('Выберите хотя бы один режим игры!', true);
                return;
            }

            set(ref(db, 'members/' + id), {
                id, name, gameModes, gameMode: gameModes[0], bestRole: role, roleColor, avatarUrl
            })
                .then(() => {
                    showToast(`${name} добавлен!`);
                    clearAddForm();
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        function clearAddForm() {
            $('inp-id').value = '';
            $('inp-name').value = '';
            $('inp-role').value = '';
            $('inp-mode-block').checked = false;
            $('inp-mode-kog').checked = false;
            $('inp-mode-race').checked = false;
            $('inp-mode-fng').checked = false;
            $('preview-box').innerHTML = '?';
            $('preview-box').className = 'avatar-preview';
            delete $('preview-box').dataset.avatarUrl;
        }

        function deleteMember(id) {
            const member = State.allMembers[id];
            const name = member ? member.name : id;

            if (confirm(`Удалить участника "${name}"?`)) {
                remove(ref(db, 'members/' + id))
                    .then(() => showToast(`${name} удалён`))
                    .catch(err => showToast('Ошибка: ' + err.message, true));
            }
        }

        function openEditModal(id) {
            const m = State.allMembers[id];
            if (!m) return;

            $('edit-id').value = m.id;
            $('edit-name').value = m.name;

            // Получаем массив режимов (поддержка старого формата с одним режимом)
            const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
            $('edit-mode-block').checked = modes.includes('block');
            $('edit-mode-kog').checked = modes.includes('kog');
            $('edit-mode-race').checked = modes.includes('race');
            $('edit-mode-fng').checked = modes.includes('fng');

            $('edit-role').value = m.bestRole;
            $('edit-role-color').value = m.roleColor || '#00b4d8';
            $('edit-birthday').checked = m.birthday || false;

            const previewBox = $('edit-preview-box');
            if (m.avatarUrl) {
                loadAvatarPreview(m.avatarUrl, previewBox);
                previewBox.dataset.avatarUrl = m.avatarUrl;
            } else {
                previewBox.innerHTML = '?';
                previewBox.className = 'avatar-preview';
            }

            loadEditAvatarById(m.id);

            const modal = $('edit-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('open'), 10);
        }

        function closeModal() {
            const modal = $('edit-modal');
            modal.classList.remove('open');
            setTimeout(() => modal.style.display = 'none', 300);
        }

        function saveModalChanges() {
            const id = $('edit-id').value;
            const name = $('edit-name').value.trim();

            // Собираем выбранные режимы игры
            const gameModes = [];
            if ($('edit-mode-block').checked) gameModes.push('block');
            if ($('edit-mode-kog').checked) gameModes.push('kog');
            if ($('edit-mode-race').checked) gameModes.push('race');
            if ($('edit-mode-fng').checked) gameModes.push('fng');

            const role = $('edit-role').value.trim();
            const color = $('edit-role-color').value;
            const avatarUrl = $('edit-preview-box').dataset.avatarUrl;
            const isBirthday = $('edit-birthday').checked;

            if (!name) {
                showToast('Имя не может быть пустым', true);
                return;
            }

            if (gameModes.length === 0) {
                showToast('Выберите хотя бы один режим игры!', true);
                return;
            }

            const oldMember = State.allMembers[id] || {};

            set(ref(db, 'members/' + id), {
                ...oldMember,
                name,
                gameModes,
                gameMode: gameModes[0], // Для обратной совместимости
                bestRole: role || 'Участник',
                roleColor: color,
                avatarUrl: avatarUrl || oldMember.avatarUrl,
                birthday: isBirthday
            })
                .then(() => {
                    showToast('Изменения сохранены!');
                    closeModal();
                })
                .catch(err => showToast('Ошибка: ' + err.message, true));
        }

        function renderAdminTable(data) {
            const tbody = $('admin-table-body');
            tbody.innerHTML = '';

            Object.values(data).forEach(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                const modeBadges = modes.map(mode =>
                    `<span class="role-badge" style="color: var(--${mode}-color); border-color: var(--${mode}-color)">${mode.toUpperCase()}</span>`
                ).join(' ');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="member-row-info">
                            <img src="${m.avatarUrl || ''}" onerror="this.src='${getDefaultAvatar(m.id)}'">
                            <div>
                                <div class="member-row-name">${escapeHtml(m.name)}</div>
                                <div class="member-row-id">${m.id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${modeBadges}</td>
                    <td><span class="role-badge" style="color: ${m.roleColor || '#00b4d8'}; border-color: ${m.roleColor || '#00b4d8'}">${escapeHtml(m.bestRole)}</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-edit" onclick="App.openEditModal('${m.id}')">✏️</button>
                        <button class="btn btn-danger" onclick="App.deleteMember('${m.id}')">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function updateAdminStats(data) {
            const list = Object.values(data);
            $('stat-total').innerText = list.length;

            // Считаем участников, у которых есть каждый режим
            $('stat-block').innerText = list.filter(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                return modes.includes('block');
            }).length;
            $('stat-kog').innerText = list.filter(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                return modes.includes('kog');
            }).length;
            $('stat-race').innerText = list.filter(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                return modes.includes('race');
            }).length;
            $('stat-fng').innerText = list.filter(m => {
                const modes = m.gameModes || (m.gameMode ? [m.gameMode] : []);
                return modes.includes('fng');
            }).length;
        }

        function filterTable() {
            const term = $('admin-search').value.toLowerCase();
            const filtered = Object.fromEntries(
                Object.entries(State.allMembers).filter(([k, v]) =>
                    v.name.toLowerCase().includes(term)
                )
            );
            renderAdminTable(filtered);
        }

        // ═══════════════════════════════════════════════════════════
        // TICKETS LISTENER (динамическая подписка в зависимости от роли)
        // ═══════════════════════════════════════════════════════════
        let ticketsUnsubscribe = null;

        function setupTicketsListener() {
            // Отписываемся от предыдущего listener если есть
            if (ticketsUnsubscribe) {
                ticketsUnsubscribe();
                ticketsUnsubscribe = null;
            }

            // Если пользователь не авторизован - просто очищаем тикеты
            if (!State.currentUser) {
                State.tickets = {};
                renderUserTickets();
                renderTicketForm();
                return;
            }

            // Создаём правильный query в зависимости от роли
            let ticketsQuery;
            if (State.isAdmin) {
                // Админ видит все тикеты
                ticketsQuery = ref(db, 'tickets');
            } else {
                // Обычный пользователь видит только свои тикеты
                ticketsQuery = query(ref(db, 'tickets'), orderByChild('userId'), equalTo(State.currentUser.uid));
            }

            // Подписываемся на обновления
            ticketsUnsubscribe = onValue(ticketsQuery, (snapshot) => {
                const data = snapshot.val() || {};
                State.tickets = data;

                // Рендерим тикеты
                renderUserTickets();
                renderTicketForm();

                if (State.isAdmin) {
                    renderAdminTickets();
                }

                // Обновляем детали текущего тикета если открыт
                if (State.currentTicketId && State.tickets[State.currentTicketId]) {
                    const currentTicket = State.tickets[State.currentTicketId];
                    if (State.isAdmin || currentTicket.userId === State.currentUser?.uid) {
                        renderTicketDetail(currentTicket);
                    }
                }
            }, (error) => {
                console.error('Tickets listener error:', error);
                State.tickets = {};
                renderUserTickets();
                renderTicketForm();
            });
        }

        // ═══════════════════════════════════════════════════════════
        // INITIALIZATION
        // ═══════════════════════════════════════════════════════════
        function init() {
            // Прогресс: начинаем загрузку данных
            if (window._updateLoadingProgress) window._updateLoadingProgress(85, 'Загрузка данных...');

            // Listen to members
            const membersRef = ref(db, 'members');
            onValue(membersRef, (snapshot) => {
                const data = snapshot.val();

                if (data) {
                    State.members = Object.values(data);
                    State.allMembers = data;

                    updateMemberCount();
                    updateModeCounts();
                    renderMembers();
                    updateLastUpdateInfo();

                    if (State.isAdmin) {
                        renderAdminTable(data);
                        updateAdminStats(data);
                    }
                } else {
                    State.members = [];
                    State.allMembers = {};
                    $('members-grid').innerHTML = `
                        <div class="error-message">
                            <p>Список участников пуст</p>
                        </div>
                    `;
                    updateMemberCount();
                    updateModeCounts();
                }
            }, (error) => {
                console.error("Firebase error:", error);
                showToast("Ошибка загрузки данных", true);
            });

            // Tickets listener будет установлен после авторизации через setupTicketsListener()
            // Это необходимо потому что обычные пользователи могут читать только свои тикеты

            // Auth state listener
            onAuthStateChanged(auth, (user) => {
                State.currentUser = user;

                if (user) {
                    State.isLoggedIn = true;

                    // Show loading state in nav
                    const container = $('nav-auth-container');
                    container.innerHTML = `<span style="color: var(--text-muted);">Загрузка...</span>`;

                    // Load user data from database
                    get(ref(db, 'users/' + user.uid)).then((userSnapshot) => {
                        const userData = userSnapshot.val();

                        if (userData) {
                            State.currentUserData = userData;
                            State.isAdmin = userData.role === 'admin';

                            // Update navigation UI
                            updateNavUI(user, userData);

                            // Update profile section
                            renderProfile(userData);

                            // ВАЖНО: Устанавливаем listener для тикетов (зависит от роли)
                            setupTicketsListener();

                            // Handle admin panel visibility
                            if (State.isAdmin) {
                                $('admin-login').style.display = 'none';
                                $('admin-dashboard').classList.add('active');

                                if (Object.keys(State.allMembers).length > 0) {
                                    renderAdminTable(State.allMembers);
                                    updateAdminStats(State.allMembers);
                                }
                            } else {
                                $('admin-login').style.display = 'block';
                                $('admin-dashboard').classList.remove('active');
                            }
                        } else {
                            // User data not found - might be old account
                            State.isAdmin = false;
                            State.currentUserData = null;
                            updateNavUI(null, null);
                            renderTicketForm();
                        }
                    }).catch((error) => {
                        console.error('Error loading user data:', error);
                        State.isAdmin = false;
                        State.currentUserData = null;
                        updateNavUI(null, null);
                        renderTicketForm();
                    });
                } else {
                    State.isLoggedIn = false;
                    State.isAdmin = false;
                    State.currentUser = null;
                    State.currentUserData = null;
                    State.userTickets = [];

                    updateNavUI(null, null);

                    // Очищаем listener тикетов
                    setupTicketsListener();

                    $('admin-login').style.display = 'block';
                    $('admin-dashboard').classList.remove('active');

                    // Clear profile
                    const profileContent = $('profile-content');
                    if (profileContent) {
                        profileContent.innerHTML = `
                            <div style="text-align: center; color: var(--text-muted);">
                                <p>Войдите в аккаунт, чтобы увидеть профиль</p>
                                <button class="btn btn-primary" onclick="App.openAuthModal()" style="margin-top: 1rem;">Войти</button>
                            </div>
                        `;
                    }
                }
            });

            // Listen to users for admin panel
            const usersRef = ref(db, 'users');
            onValue(usersRef, (snapshot) => {
                const data = snapshot.val() || {};
                State.allUsers = data;

                if (State.isAdmin && State.currentAdminTab === 'users') {
                    renderUsersManagement(data);
                }
            });
        }

        // ═══════════════════════════════════════════════════════════
        // PASSWORD CHANGE FUNCTIONS
        // ═══════════════════════════════════════════════════════════
        function openPasswordModal() {
            const modal = $('password-modal');
            if (modal) {
                modal.classList.add('open');
                // Очищаем поля при открытии
                $('current-password').value = '';
                $('new-password').value = '';
                $('confirm-password').value = '';
            }
        }

        function closePasswordModal() {
            const modal = $('password-modal');
            if (modal) {
                modal.classList.remove('open');
            }
        }

        function togglePasswordVisibility(inputId, button) {
            const input = $(inputId);
            if (!input) return;

            if (input.type === 'password') {
                input.type = 'text';
                button.textContent = '🙈';
            } else {
                input.type = 'password';
                button.textContent = '👁️';
            }
        }

        async function changePassword() {
            const currentPassword = $('current-password')?.value;
            const newPassword = $('new-password')?.value;
            const confirmPassword = $('confirm-password')?.value;

            // Валидация
            if (!currentPassword || !newPassword || !confirmPassword) {
                showToast('Заполните все поля', true);
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast('Новые пароли не совпадают', true);
                return;
            }

            if (newPassword.length < 6) {
                showToast('Новый пароль должен быть минимум 6 символов', true);
                return;
            }

            if (currentPassword === newPassword) {
                showToast('Новый пароль должен отличаться от текущего', true);
                return;
            }

            const user = auth.currentUser;
            if (!user || !user.email) {
                showToast('Пользователь не авторизован', true);
                return;
            }

            try {
                // Реаутентификация пользователя
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);

                // Обновление пароля
                await updatePassword(user, newPassword);

                // Очистка полей
                $('current-password').value = '';
                $('new-password').value = '';
                $('confirm-password').value = '';

                // Закрываем модальное окно
                closePasswordModal();

                showToast('Пароль успешно изменён! ✅');
            } catch (error) {
                console.error('Password change error:', error);

                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    showToast('Неверный текущий пароль', true);
                } else if (error.code === 'auth/weak-password') {
                    showToast('Слишком слабый пароль', true);
                } else if (error.code === 'auth/requires-recent-login') {
                    showToast('Требуется повторный вход в аккаунт', true);
                } else {
                    showToast('Ошибка смены пароля: ' + error.message, true);
                }
            }
        }

        function renderProfile(userData) {
            const container = $('profile-content');
            if (!container) return;

            const createdDate = new Date(userData.createdAt).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            container.innerHTML = `
                <div style="text-align: center;">
                    <div class="nav-user-avatar" style="width: 80px; height: 80px; font-size: 2rem; margin: 0 auto 1rem;">
                        ${userData.username.charAt(0).toUpperCase()}
                    </div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">${userData.username}</h3>
                    <span class="admin-badge" style="margin-bottom: 1.5rem; display: inline-flex;">
                        ${userData.role === 'admin' ? '🛡️ Администратор' : '👤 Участник'}
                    </span>
                </div>
                
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span style="color: var(--text-muted);">Дата регистрации:</span>
                        <span>${createdDate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Роль:</span>
                        <span style="color: ${userData.role === 'admin' ? 'var(--danger)' : 'var(--secondary)'};">
                            ${userData.role === 'admin' ? 'Администратор' : 'Участник'}
                        </span>
                    </div>
                </div>
                
                <button class="btn btn-secondary" onclick="App.openPasswordModal()" style="width: 100%; margin-top: 2rem;">
                    🔐 Сменить пароль
                </button>
                
                <button class="btn btn-danger" onclick="App.logout()" style="width: 100%; margin-top: 1rem;">
                    🚪 Выйти из аккаунта
                </button>
            `;
        }

        // ═══════════════════════════════════════════════════════════
        // EXPORT TO GLOBAL SCOPE
        // ═══════════════════════════════════════════════════════════
        const _app = {
            showSection,
            showAdminTab,
            filterMembers,
            login,
            logout,
            register,
            openAuthModal,
            closeAuthModal,
            switchAuthTab,
            toggleUserDropdown,
            closeUserDropdown,
            changeUserRole,
            saveMember,
            deleteMember,
            openEditModal,
            closeModal,
            saveModalChanges,
            filterTable,
            loadAvatarById,
            // Ticket functions
            createTicket,
            filterTickets,
            openTicketDetail,
            closeTicketDetail,
            sendTicketReply,
            changeTicketStatus,
            deleteTicket,
            filterAdminTickets,
            searchAdminTickets,
            openAdminTicketModal,
            sendAdminReply,
            closeTicketModal,
            // Proxy server functions
            checkProxyStatus,
            refreshAllAvatars,
            // Password change functions
            openPasswordModal,
            closePasswordModal,
            togglePasswordVisibility,
            changePassword
        };

        // Прогресс: приложение готово к запуску
        if (window._updateLoadingProgress) window._updateLoadingProgress(95, 'Запуск приложения...');

        // Активируем App через систему очереди (для поддержки кликов до загрузки модуля)
        if (typeof window._activateApp === 'function') {
            window._activateApp(_app);
        } else {
            window.App = _app;
        }

        // Start the app
        init();
