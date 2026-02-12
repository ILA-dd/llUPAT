        // Создаём очередь вызовов пока модуль загружается
        window._appQueue = [];
        window._appReady = false;

        // Функция обновления прогресса загрузки
        window._updateLoadingProgress = function (percent, status) {
            var progressBar = document.getElementById('app-loading-progress');
            var statusText = document.getElementById('app-loading-status');
            if (progressBar) progressBar.style.width = percent + '%';
            if (statusText) statusText.textContent = status;
        };

        // Начальный прогресс
        setTimeout(function () {
            window._updateLoadingProgress(10, 'Загрузка Firebase...');
        }, 100);

        // Таймаут - показываем предупреждение через 10 секунд
        window._loadingTimeout = setTimeout(function () {
            var warning = document.getElementById('app-loading-warning');
            if (warning && !window._appReady) {
                warning.style.display = 'block';
                var statusText = document.getElementById('app-loading-status');
                if (statusText) statusText.textContent = 'Подключение к серверу...';
            }
        }, 10000);

        // Создаём Proxy для App который либо вызывает функцию, либо добавляет в очередь
        window.App = new Proxy({}, {
            get: function (target, prop) {
                return function () {
                    var args = Array.prototype.slice.call(arguments);
                    if (window._appReady && window._realApp && window._realApp[prop]) {
                        return window._realApp[prop].apply(null, args);
                    } else {
                        // Добавляем в очередь для выполнения после загрузки
                        window._appQueue.push({ method: prop, args: args });
                        console.log('[App] Queued:', prop, args);
                    }
                };
            }
        });

        // Функция для активации реального App
        window._activateApp = function (realApp) {
            window._realApp = realApp;
            window._appReady = true;

            // Очищаем таймаут предупреждения
            if (window._loadingTimeout) {
                clearTimeout(window._loadingTimeout);
            }

            // Финальный прогресс
            window._updateLoadingProgress(100, 'Готово!');

            // Выполняем отложенные вызовы
            window._appQueue.forEach(function (item) {
                if (realApp[item.method]) {
                    console.log('[App] Executing queued:', item.method, item.args);
                    realApp[item.method].apply(null, item.args);
                }
            });
            window._appQueue = [];

            // Скрываем overlay с небольшой задержкой чтобы показать "Готово!"
            setTimeout(function () {
                var overlay = document.getElementById('app-loading-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(function () { overlay.remove(); }, 300);
                }
            }, 200);

            // Заменяем Proxy на реальный объект
            window.App = realApp;
        };
