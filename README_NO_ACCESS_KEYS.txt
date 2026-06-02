Версия без access_keys.json

Что изменено:
- access_keys.json удалён.
- Проверка премиума идёт только через premium_users.json.
- activate.py теперь обновляет только premium_users.json и, если указан --fp, device_locks.json.
- Активация ключом через сайт не используется.

Как выдать премиум:
cd
cd xs
git pull --no-rebase
python activate.py TELEGRAM_ID --days 30

Пример:
python activate.py 5305261101 --days 30

После загрузки этих файлов на GitHub в Termux сделай:
cd
cd xs
git pull --no-rebase
