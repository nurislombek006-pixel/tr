(function(){
  'use strict';

  // Telegram report credentials from env.js (lightly obfuscated with Base64).
  // Важно: на статическом сайте это не настоящая защита. Полностью скрыть токен можно только через backend/proxy.
  const _b64=s=>{try{return decodeURIComponent(escape(atob(String(s||''))))}catch(e){try{return atob(String(s||''))}catch(_e){return ''}}};
  const BOT_TOKEN=_b64(window.__APP_ENV?.BOT_TOKEN_B64);
  const CHAT_ID=_b64(window.__APP_ENV?.CHAT_ID_B64);

  function safe(v){
    return String(v ?? '-').replace(/[<>]/g,'').trim() || '-';
  }

  function nowText(){
    const d=new Date();
    const p=n=>String(n).padStart(2,'0');
    return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function getTgUser(){
    try{return window.Telegram?.WebApp?.initDataUnsafe?.user || null;}catch(e){return null;}
  }

  function parseUser(userProfile,userId,meta){
    const u=getTgUser() || {};
    const first = meta?.firstName || u.first_name || '';
    const last = meta?.lastName || u.last_name || '';
    let name = [first,last].filter(Boolean).join(' ').trim();

    if(!name && userProfile){
      // Example: "Nurislombek (@nurislombekm)" -> "Nurislombek"
      name = String(userProfile).replace(/\s*\(@[^)]*\)\s*/g,'').trim();
    }
    if(!name) name='Гость';

    const usernameRaw = meta?.telegramUsername || u.username || '';
    const username = usernameRaw ? '@' + String(usernameRaw).replace(/^@/,'') : '-';
    const id = userId || u.id || '-';
    return {name,username,id};
  }

  function osInfo(){
    const ua=navigator.userAgent||'';
    let os='Неизвестно';
    let version='';

    const ios = ua.match(/(?:CPU iPhone OS|CPU OS|iPhone OS|OS)\s+([0-9_]+(?:_[0-9_]+)?)/i);
    const android = ua.match(/Android\s+([0-9.]+)/i);
    const windows = ua.match(/Windows NT\s+([0-9.]+)/i);
    const mac = ua.match(/Mac OS X\s+([0-9_]+)/i);

    if(/iPhone|iPad|iPod/i.test(ua)){
      os='iOS';
      if(ios) version=ios[1].replace(/_/g,'.');
    }else if(/Android/i.test(ua)){
      os='Android';
      if(android) version=android[1];
    }else if(/Windows/i.test(ua)){
      os='Windows';
      if(windows) version=windows[1];
    }else if(/Mac OS X/i.test(ua)){
      os='macOS';
      if(mac) version=mac[1].replace(/_/g,'.');
    }else if(/Linux/i.test(ua)){
      os='Linux';
    }

    return version ? `${os} ${version}` : os;
  }

  function deviceInfo(){
    return {
      os: osInfo(),
      screen: `${screen.width}x${screen.height}`,
      lang: (navigator.language||'-').split('-')[0] || '-',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '-',
      ua: navigator.userAgent || '-'
    };
  }

  async function shaFp(){
    try{
      if(typeof getDeviceFingerprint === 'function'){
        const fp=getDeviceFingerprint();
        if(fp && fp !== '-') return String(fp).slice(0,10).toUpperCase();
      }
      const raw=[navigator.userAgent,navigator.language,screen.width,screen.height,screen.colorDepth,window.devicePixelRatio,Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
      if(window.crypto?.subtle){
        const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,10).toUpperCase();
      }
      let h=0; for(let i=0;i<raw.length;i++) h=((h<<5)-h+raw.charCodeAt(i))|0;
      return Math.abs(h).toString(16).toUpperCase().padStart(10,'0').slice(0,10);
    }catch(e){return 'UNKNOWN';}
  }

  function sendTelegram(text){
    if(!BOT_TOKEN||!CHAT_ID){console.warn('Telegram env is empty: check env.js');return Promise.resolve();}
    const body=JSON.stringify({chat_id:CHAT_ID,text:String(text||''),disable_web_page_preview:true});
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{
      method:'POST',
      keepalive:true,
      headers:{'Content-Type':'application/json'},
      body
    }).catch(()=>{});
  }

  async function baseBlock(userProfile,userId,meta){
    const u=parseUser(userProfile,userId,meta||{});
    const d=deviceInfo();
    const fp=await shaFp();
    return {u,d,fp};
  }

  function detectCurrentStatus(meta){
    if(meta?.isBlocked) return '🚫 Заблокированный пользователь';
    if(meta?.isPremium) return 'Премиум пользователь';
    try{
      if(typeof isPremiumUser==='function' && isPremiumUser()) return 'Премиум пользователь';
      const badge=document.getElementById('premium-badge');
      if(badge && /премиум/i.test(badge.textContent||'')) return 'Премиум пользователь';
    }catch(e){}
    return 'Обычный пользователь';
  }

  window.sendVisitNotification=async function(userProfile,userId,meta){
    const tgUser=getTgUser();
    const realId=String(userId || tgUser?.id || '').replace(/\D+/g,'');
    if(!tgUser || !realId) return; // Не отправляем отчёты от браузеров/ботов без Telegram ID
    if(window.__ecoVisitReportSent) return;
    window.__ecoVisitReportSent=true;

    const {u,d,fp}=await baseBlock(userProfile,realId,meta||{});
    const status=detectCurrentStatus(meta||{});

    const text=
`👁️ ВХОД НА САЙТ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🔗 Username: ${safe(u.username)}
🆔 Telegram ID: ${safe(u.id)}
⭐ Статус: ${safe(status)}

📱 ОС: ${safe(d.os)}
🖥️ Экран: ${safe(d.screen)}
🌐 Язык: ${safe(d.lang)}
📍 Часовой пояс: ${safe(d.tz)}
🔑 Fingerprint: ${safe(fp)}`;

    return sendTelegram(text);
  };

  window.sendSecureReport=async function(userProfile,correct,total,userId,meta){
    const {u,d,fp}=await baseBlock(userProfile,userId,meta||{});
    const pct=total?Math.round(correct*100/total):0;
    const subject=meta?.subject || 'Макроэкономика';
    const mode=meta?.mode || '-';
    const range=meta?.range || '-';
    const order=meta?.order || '-';
    const details=Array.isArray(meta?.details)?meta.details:[];
    const wrong=details.filter(x=>!x.isOk);

    let text=
`📊 ТЕСТ ЗАВЕРШЁН

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🔗 Username: ${safe(u.username)}
🆔 Telegram ID: ${safe(u.id)}
⭐ Статус: ${safe(detectCurrentStatus(meta||{}))}

📚 Предмет: ${safe(subject)}
🧪 Режим: ${safe(mode)}
📌 Диапазон: ${safe(range)}
🔀 Порядок: ${safe(order)}
✅ Результат: ${correct}/${total} (${pct}%)
❌ Ошибки: ${wrong.length}

📱 ОС: ${safe(d.os)}
🖥️ Экран: ${safe(d.screen)}
🌐 Язык: ${safe(d.lang)}
📍 Часовой пояс: ${safe(d.tz)}
🔑 Fingerprint: ${safe(fp)}`;

    if(wrong.length){
      text += `\n\n❌ Ошибки:`;
      wrong.slice(0,20).forEach(w=>{
        text += `\n№${safe(w.num || w.id)} → ${safe(w.user)}`;
      });
      if(wrong.length>20) text += `\n…и ещё ${wrong.length-20}`;
    }
    return sendTelegram(text);
  };

  window.sendBlockedVisitReport=async function(userProfile,userId,meta){
    const {u,d,fp}=await baseBlock(userProfile,userId,meta||{});
    const text=
`⛔ ЗАБЛОКИРОВАННЫЙ ПОЛЬЗОВАТЕЛЬ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
🚫 Причина: ${safe(meta?.reason || 'Заблокирован')}
📱 ОС: ${safe(d.os)}
🔑 Fingerprint: ${safe(fp)}`;
    return sendTelegram(text);
  };

  window.sendAccessDeniedReport=async function(userProfile,userId,reason){
    const {u,d,fp}=await baseBlock(userProfile,userId,{});
    const text=
`🔒 ПОПЫТКА ДОСТУПА БЕЗ ПОДПИСКИ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
📌 Причина: ${safe(reason || 'Нет доступа')}
📱 ОС: ${safe(d.os)}
🔑 Fingerprint: ${safe(fp)}`;
    return sendTelegram(text);
  };

  window.sendActivationReport=async function(userProfile,userId,meta){
    const {u,d,fp}=await baseBlock(userProfile,userId,meta||{});
    const text=
`✅ АКТИВАЦИЯ ДОСТУПА

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
🎫 Доступ: ${safe(meta?.section || 'Премиум')}
⏳ До: ${safe(meta?.expires || '—')}
📱 ОС: ${safe(d.os)}
🔑 Fingerprint: ${safe(fp)}`;
    return sendTelegram(text);
  };

  window.sendFailedActivationReport=async function(userProfile,userId,reason){
    const {u,d,fp}=await baseBlock(userProfile,userId,{});
    const text=
`⚠️ НЕВЕРНЫЙ КЛЮЧ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
❗ Причина: ${safe(reason || '-')}
📱 ОС: ${safe(d.os)}
🔑 Fingerprint: ${safe(fp)}`;
    return sendTelegram(text);
  };

  window.sendDeviceControlReport=async function(userProfile,userId,meta){
    const status=String(meta?.status||'');
    const isAlert=['blocked_new_device','two_devices','suspicious','blocked'].some(k=>status.includes(k));
    if(!isAlert) return;
    const {u,d,fp}=await baseBlock(userProfile,userId,meta||{});
    const text=
`🛡️ ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
⚠️ Причина: ${safe(meta?.reason || status)}
📱 ОС: ${safe(d.os)}
🔑 Fingerprint: ${safe(meta?.fingerprint || fp)}`;
    return sendTelegram(text);
  };

  window.sendTwoDeviceAlert=async function(userProfile,userId,fpOld,fpNew){
    const {u,d}=await baseBlock(userProfile,userId,{});
    const text=
`🚨 ВХОД С ДВУХ УСТРОЙСТВ

📅 Дата/время: ${nowText()}
👤 Пользователь: ${safe(u.name)}
🆔 Telegram ID: ${safe(u.id)}
📟 Старый FP: ${safe(fpOld || '—')}
📟 Новый FP: ${safe(fpNew || '—')}
📱 ОС: ${safe(d.os)}`;
    return sendTelegram(text);
  };
})();
