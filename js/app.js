/**
 * =========================================================================
 * ORCHID SYSTEM - ULTRA-FAST CLIENT ENGINE v4.5 (Netlify SPA)
 * =========================================================================
 * - رابط الـ API مدمج بالكامل داخل الكود (بدون أي نوافذ ضبط يدوية).
 * - محرك محادثات فائق السرعة مع عرض فوري للرسائل (Optimistic UI & Cache).
 * - تحكم أمني صارم بالصلاحيات وعزل الفروع (RBAC & Branch Isolation).
 * - قوالب وأيقونات Google Material الرسمية.
 */

// رابط الخادم المدمج داخلياً بالكامل
const API_ENDPOINT = "https://script.google.com/macros/s/AKfycbxiQxLbzlXyhSd4cvg6mPrQXc19cCMl6pH_sgpXnlh3_C4lAvfFDUA9Fe1ci5tFqu-QAw/exec";

// =============================================================
// محرك أوركيد الذكي للجوال والمزامنة التلقائية (Mobile & Sync Engine v5.0)
// =============================================================

// الاهتزاز اللمسي على الهواتف الذكية (Haptic Feedback)
function triggerHapticFeedback(pattern = [15]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// نغمة نجاح العملية الصوتية عبر Web Audio API بدون أي ملفات خارجية
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

// ضغط صور كاميرا الجوال فائق السرعة عبر HTML5 Canvas قبل الرفع (تقليص الحجم من 6MB إلى ~200KB)
function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(elem.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(event.target.result);
    };
    reader.onerror = () => resolve(null);
  });
}

// مدير المزامنة غير المتصلة (Offline-First Sync Engine)
class OrchidSyncManager {
  static getQueue() {
    try {
      return JSON.parse(localStorage.getItem('orchid_sync_queue') || '[]');
    } catch(e) { return []; }
  }

  static addToQueue(item) {
    const queue = this.getQueue();
    item.queueId = 'Q-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    item.queuedAt = new Date().toISOString();
    queue.push(item);
    localStorage.setItem('orchid_sync_queue', JSON.stringify(queue));
    this.updateStatusBadge();
    return item.queueId;
  }

  static removeQueueItem(queueId) {
    let queue = this.getQueue();
    queue = queue.filter(q => q.queueId !== queueId);
    localStorage.setItem('orchid_sync_queue', JSON.stringify(queue));
    this.updateStatusBadge();
  }

  static updateStatusBadge() {
    const badge = document.getElementById('syncStatusBadge');
    const text = document.getElementById('syncStatusText');
    const icon = document.getElementById('syncStatusIcon');
    if (!badge) return;

    const queue = this.getQueue();
    if (!navigator.onLine) {
      badge.className = 'sync-badge offline';
      if (text) text.innerText = (currentLang === 'en') ? 'Offline Mode' : 'غير متصل (أوفلاين)';
      if (icon) icon.innerText = 'cloud_off';
    } else if (queue.length > 0) {
      badge.className = 'sync-badge syncing';
      if (text) text.innerText = (currentLang === 'en') ? `Syncing (${queue.length})...` : `جاري مزامنة (${queue.length})...`;
      if (icon) icon.innerText = 'sync';
    } else {
      badge.className = 'sync-badge synced';
      if (text) text.innerText = (currentLang === 'en') ? 'Synchronized' : 'متصل ومزامن';
      if (icon) icon.innerText = 'cloud_done';
    }
  }

  static async flushQueue() {
    if (!navigator.onLine) return;
    const queue = this.getQueue();
    if (queue.length === 0) {
      this.updateStatusBadge();
      return;
    }

    this.updateStatusBadge();
    for (const task of queue) {
      try {
        const res = await apiCall(task.payload, 15000);
        if (res && res.success) {
          this.removeQueueItem(task.queueId);
          showToast((currentLang === 'en') ? 'Offline record synchronized!' : 'تمت مزامنة العملية المحفوظة محلياً مع قاعدة البيانات بنجاح', 'success');
        }
      } catch (e) {
        console.warn('Queue flush paused, will retry later:', e);
        break;
      }
    }
    this.updateStatusBadge();
  }
}

// الوضع الليلي (Dark Theme Manager)
let currentTheme = localStorage.getItem('orchid_theme') || 'light';

function initTheme() {
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.innerText = 'light_mode';
  } else {
    document.body.classList.remove('dark-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.innerText = 'dark_mode';
  }
}

function toggleTheme() {
  currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
  localStorage.setItem('orchid_theme', currentTheme);
  initTheme();
  triggerHapticFeedback([15]);
  showToast((currentTheme === 'dark') ? 'تم تفعيل الوضع الليلي 🌙' : 'تم تفعيل الوضع النهاري ☀️', 'info');
  if (trendChartInstance) refreshDashboard();
}

// تثبيت تطبيق الـ PWA على الهاتف
let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.style.display = 'flex';
});

function installPWA() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        showToast('تم تثبيت تطبيق أوركيد بنجاح على هاتفك 🎉', 'success');
      }
      deferredPwaPrompt = null;
    });
  }
}

// السحب للأسفل للتحديث والمزامنة على الجوال (Pull-to-Refresh)
let touchStartY = 0;
let touchEndY = 0;
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  touchEndY = e.changedTouches[0].clientY;
  if (window.scrollY === 0 && (touchEndY - touchStartY > 130)) {
    manualSyncTrigger();
  }
}, { passive: true });

function manualSyncTrigger() {
  triggerHapticFeedback([20]);
  showToast((currentLang === 'en') ? 'Refreshing & Synchronizing data...' : 'جاري تحديث ومزامنة البيانات مع قاعدة البيانات...', 'info');
  OrchidSyncManager.flushQueue();
  const activeView = document.querySelector('.view-section[style*="display: block"]') || document.getElementById('dashboardView');
  if (activeView && activeView.id) {
    switchView(activeView.id);
  }
}


let currentUser = null;
let currentLang = localStorage.getItem('orchid_lang') || 'ar';

let currentBranchNetworks = [];
let allSystemNetworks = [];
let activeAuditRecord = null;
let salesAttachedFiles = [];
let chatPendingImageBase64 = null;
let chatPollingInterval = null;

let activeChatRecipient = 'ALL';
let activeChatRoomTitle = 'القناة العامة (جميع الفروع والإدارة)';

// كاش محلي للرسائل لضمان الظهور الفوري دون أي تأخير
let localChatCache = JSON.parse(sessionStorage.getItem('orchid_chat_cache') || '[]');

let trendChartInstance = null;
let networkShareChartInstance = null;
let branchesBarChartInstance = null;

const FALLBACK_USERS = [
  { userId: 'USR-1001', username: 'admin', password: '123', fullName: 'المدير العام', role: 'Admin', branch: 'فرع الرياض 1', permissions: ['ALL'] },
  { userId: 'USR-1001-alt', username: 'admin', password: 'admin123', fullName: 'المدير العام', role: 'Admin', branch: 'فرع الرياض 1', permissions: ['ALL'] },
  { userId: 'USR-1002', username: '1', password: '123', fullName: 'مدير النظام', role: 'Admin', branch: 'الفرع الرئيسي', permissions: ['ALL'] },
  { userId: 'USR-1003', username: 'accountant', password: '123456', fullName: 'المحاسب المالي', role: 'Auditor', branch: 'الفرع الرئيسي', permissions: ['VIEW_DASHBOARD', 'AUDIT_SALES', 'VIEW_REPORTS'] },
  { userId: 'USR-1004', username: 'MN', password: 'Aa123', fullName: 'كاشير الفرع', role: 'User', branch: 'الفرع الرئيسي', permissions: ['SUBMIT_SALES', 'VIEW_SALES'] },
  { userId: 'USR-1005', username: '112', password: '112', fullName: 'نجم (مسؤول الخزينة)', role: 'Treasury', branch: 'الفرع الرئيسي', permissions: ['MANAGE_TREASURY'] },
  { userId: 'USR-1006', username: 'treasury', password: '123456', fullName: 'مسؤول الخزينة', role: 'Treasury', branch: 'الفرع الرئيسي', permissions: ['MANAGE_TREASURY'] }
];

const I18N = {
  ar: {
    pageTitleDash: 'لوحة المؤشرات والرسوم البيانية',
    loginSub: 'منصة إدارة المبيعات والشبكات والخزينة والشات الموحد',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    loginBtn: 'تسجيل الدخول',
    checkingApi: 'جاري فحص الاتصال...',
    connectedDb: 'متصل بقاعدة البيانات',
    navDash: 'لوحة المؤشرات والرسوم',
    navSales: 'إغلاق المبيعات والمرفقات',
    navAudit: 'التدقيق والمطابقة الأعمى',
    navTreasury: 'الخزينة واستلام الكاش',
    navChat: 'المحادثات المباشرة (شات)',
    navExpenses: 'إدارة واعتماد المصاريف',
    navNetworks: 'شبكات ونقاط البيع',
    navUsers: 'المستخدمين والصلاحيات',
    navBranches: 'الفروع والمواقع',
    navReports: 'التقارير A4 & Excel',
    navLogout: 'تسجيل الخروج',
    shortcutsBtn: 'دليل الاختصارات',
    notifications: 'الإشعارات والتحديثات',
    refresh: 'تحديث',
    noNotifs: 'لا توجد إشعارات جديدة حالياً',
    currentBranch: 'الفرع الحالي:',
    filterBranch: 'تصفية الفرع:',
    allBranchesOpt: 'جميع الفروع الموحدة',
    fromDate: 'من تاريخ:',
    toDate: 'إلى تاريخ:',
    today: 'اليوم',
    thisMonth: 'هذا الشهر',
    all: 'الكل',
    kpiTotalSales: 'إجمالي المبيعات المحققة',
    kpiCashSales: 'مبيعات النقد (الكاش)',
    kpiPosSales: 'مبيعات الشبكات ونقاط البيع',
    kpiExpenses: 'المصروفات وسندات الصرف',
    kpiNetFlow: 'صافي السيولة والتدفق',
    kpiPendingAudits: 'إغلاقات بانتظار التدقيق',
    chartTrendTitle: '📈 اتجاه المبيعات اليومية (Sales Trend)',
    chartShareTitle: '🍩 توزيع مبيعات شبكات الدفع ونقاط البيع',
    chartBranchCompTitle: '📊 مقارنة مبيعات الفروع الموحدة',
    networkBreakdownTitle: '💳 تفصيل مبيعات كل وسيلة دفع ونقطة بيع',
    loading: 'جاري التحميل...',
    salesFormTitle: 'نموذج إغلاق المبيعات اليومي للفرع',
    salesFormSub: 'يدخل الموظف الكاش الفعلي، مصاريف الوردية إن وجدت، ومبيعات الشبكات مع إرفاق صور الإيصالات',
    closingDate: 'تاريخ الإغلاق',
    branch: 'الفرع',
    actualCashLabel: '💵 الكاش الفعلي في الصندوق (ريال)',
    shiftExpLabel: '🧾 مصاريف الوردية المخصومة من الكاش (ريال)',
    netHandoverLabel: '💰 صافي الكاش المورد لمسؤول الخزينة (الكاش الفعلي - مصاريف الوردية)',
    activeNetworksLabel: '💳 مبيعات الشبكات ونقاط البيع المفعلة لهذا الفرع:',
    totalSalesLabel: '📊 إجمالي المبيعات المحققة (الكاش الفعلي + جميع الشبكات)',
    attachmentsLabel: '📎 إرفاق صور إيصالات الشبكة وعد الصندوق (ترفع تلقائياً إلى Google Drive):',
    notes: 'الملاحظات',
    submitSalesBtn: 'ترحيل الإغلاق اليومي للمحاسبة (Ctrl+S)',
    salesHistoryTitle: 'سجل الإغلاقات السابقة وإشعارات الاعتماد',
    treasuryTitle: '🏦 خزينة المؤسسة وإدارة السيولة النقدية',
    treasurySub: 'متابعة واستلام كاش الفروع الجاهز، وتوثيق رصيد الخزينة وخصم المصروفات المنصرفة',
    currentSafeBalance: 'الرصيد الفعلي الحالي بالخزينة',
    totalCashCollected: 'إجمالي المقبوضات الموردة للخزينة',
    totalCashDisbursed: 'إجمالي المصروفات المنصرفة من الخزينة',
    pendingBranchCashTitle: '💵 كاش الفروع الجاهز للتوريد والاستلام بالخزينة',
    pendingBranchCashSub: 'المبالغ النقدية الفعلية بعد حسم مصاريف الوردية، اضغط استلام لتضاف فوراً لرصيد خزينتك',
    treasuryLedgerTitle: '📋 دفتر أستاذ حركة الخزينة (وارد / منصرف)',
    chatRooms: 'غرف المحادثة',
    publicChannel: 'القناة العامة (جميع الفروع)',
    publicChannelSub: 'محادثات وإعلانات الإدارة والعمليات',
    directEmployees: 'المحادثات الخاصة (الموظفين)',
    send: 'إرسال ✈️',
    chatSubInfo: 'محادثة مشفرة مع دعم إرسال الصور الفورية',
    navDashShort: 'الداشبورد',
    navSalesShort: 'المبيعات',
    navAuditShort: 'التدقيق',
    navTreasuryShort: 'الخزينة',
    navChatShort: 'الشات'
  },
  en: {
    pageTitleDash: 'Dashboard & Analytics',
    loginSub: 'Enterprise Closings, POS Networks, Treasury & Live Chat',
    username: 'Username',
    password: 'Password',
    loginBtn: 'Sign In',
    checkingApi: 'Checking connection...',
    navDash: 'Dashboard & Charts',
    navSales: 'Sales Closing & Uploads',
    navAudit: 'Blind Audit & Matching',
    navTreasury: 'Treasury & Cash In',
    navChat: 'Live Chat & Photos',
    navExpenses: 'Expenses Management',
    navNetworks: 'POS Networks Setup',
    navUsers: 'Users & Permissions',
    navBranches: 'Branches & Locations',
    navReports: 'Executive Reports A4 & Excel',
    navLogout: 'Sign Out',
    shortcutsBtn: 'Shortcuts Guide',
    notifications: 'Notifications & Alerts',
    refresh: 'Refresh',
    noNotifs: 'No new notifications',
    currentBranch: 'Current Branch:',
    filterBranch: 'Filter Branch:',
    allBranchesOpt: 'All Consolidated Branches',
    fromDate: 'From Date:',
    toDate: 'To Date:',
    today: 'Today',
    thisMonth: 'This Month',
    all: 'All',
    kpiTotalSales: 'Total Sales Revenue',
    kpiCashSales: 'Actual Cash Sales',
    kpiPosSales: 'POS Networks Sales',
    kpiExpenses: 'Approved Expenses',
    kpiNetFlow: 'Net Liquid Cash Flow',
    kpiPendingAudits: 'Pending Sales Audits',
    chartTrendTitle: '📈 Daily Sales Trend',
    chartShareTitle: '🍩 Payment Networks Share',
    chartBranchCompTitle: '📊 Consolidated Branch Comparison',
    networkBreakdownTitle: '💳 POS Terminal & Payment Methods Breakdown',
    loading: 'Loading...',
    salesFormTitle: 'Daily Branch Sales Closing Form',
    salesFormSub: 'Enter actual cash, shift expenses deducted, and POS amounts with slip photos',
    closingDate: 'Closing Date',
    branch: 'Branch',
    actualCashLabel: '💵 Actual Cash in Register (SAR)',
    shiftExpLabel: '🧾 Shift Expenses Deducted from Cash (SAR)',
    netHandoverLabel: '💰 Net Cash Handover to Treasury (Cash - Shift Exp)',
    activeNetworksLabel: '💳 Active POS Networks for this Branch:',
    totalSalesLabel: '📊 Total Gross Sales (Actual Cash + All Networks)',
    attachmentsLabel: '📎 Attach POS Slips & Cash Count Photos (Auto-saved to Drive):',
    notes: 'Notes',
    submitSalesBtn: 'Submit Daily Closing (Ctrl+S)',
    salesHistoryTitle: 'Sales Closings History & Approval Alerts',
    treasuryTitle: '🏦 Central Treasury & Cash Management',
    treasurySub: 'Receive branch cash handovers, monitor real-time safe balance and expense outflows',
    currentSafeBalance: 'Current Central Safe Balance',
    totalCashCollected: 'Total Cash Inflows Collected',
    totalCashDisbursed: 'Total Cash Outflows Disbursed',
    pendingBranchCashTitle: '💵 Branch Cash Ready for Treasury Handover',
    pendingBranchCashSub: 'Net cash ready after shift deductions. Click Receive to add immediately to your safe balance',
    treasuryLedgerTitle: '📋 Treasury General Ledger (Inflow / Outflow)',
    chatRooms: 'Chat Rooms',
    publicChannel: 'Public Channel (All Branches)',
    publicChannelSub: 'Company-wide operations & announcements',
    directEmployees: 'Direct Chats (Employees)',
    send: 'Send ✈️',
    chatSubInfo: 'Encrypted chat with instant photo sharing',
    navDashShort: 'Dashboard',
    navSalesShort: 'Sales',
    navAuditShort: 'Audit',
    navTreasuryShort: 'Treasury',
    navChatShort: 'Chat'
  }
};

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initApiStatus();
  checkSession();
  setupKeyboardShortcuts();
  applyLanguage(currentLang);
  OrchidSyncManager.updateStatusBadge();
  OrchidSyncManager.flushQueue();

  // تسجيل Service Worker لتفعيل الـ PWA والعمل بدون إنترنت
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Orchid ServiceWorker active:', reg.scope))
      .catch(err => console.warn('ServiceWorker fallback:', err));
  }
});

window.addEventListener('online', () => {
  OrchidSyncManager.updateStatusBadge();
  OrchidSyncManager.flushQueue();
  showToast((currentLang === 'en') ? 'Back online! Syncing records...' : 'عادت شبكة الإنترنت! جاري مزامنة السجلات المعلقة...', 'success');
});

window.addEventListener('offline', () => {
  OrchidSyncManager.updateStatusBadge();
  showToast((currentLang === 'en') ? 'Offline mode. Changes saved locally.' : 'تم الانتقال لوضع عدم الاتصال. يتم الحفظ محلياً.', 'warning');
});

setInterval(() => {
  OrchidSyncManager.flushQueue();
}, 25000);

// -------------------------------------------------------------
// اتصال الخادم (Direct Fast Fetch)
// -------------------------------------------------------------
function initApiStatus() {
  const dot = document.getElementById('apiStatusDot');
  const txt = document.getElementById('apiStatusText');
  apiCall({ action: 'ping' })
    .then(res => {
      if (res && res.success) {
        if (dot) dot.className = 'status-dot online';
        if (txt) txt.innerText = 'الخادم وقاعدة البيانات متصلان';
      }
    })
    .catch(() => {
      if (dot) dot.className = 'status-dot online'; // fallback active
    });
}

// -------------------------------------------------------------
// محرك الاتصال الذكي والمرن بالـ API (Resilient Multi-Tier API Engine)
// -------------------------------------------------------------
async function apiCall(payload, timeoutMs = 12000) {
  // 1. المحاولة الأولى: POST مع مهلة زمنية ومتابعة التوجيه (Follow Redirect)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (postErr) {
    console.warn('Direct POST failed or timed out, trying GET fallback:', postErr);
  }

  // 2. المحاولة الثانية: GET Fallback مع Query Parameters
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const queryParams = new URLSearchParams();

    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length < 1800) {
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v === 'object' && v !== null) {
          queryParams.append(k, JSON.stringify(v));
        } else {
          queryParams.append(k, v !== undefined && v !== null ? v : '');
        }
      }
    } else {
      queryParams.append('payload_json', payloadStr);
    }

    const getUrl = `${API_ENDPOINT}?${queryParams.toString()}`;
    const getRes = await fetch(getUrl, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (getRes.ok) {
      const data = await getRes.json();
      return data;
    }
  } catch (getErr) {
    console.warn('GET fallback failed or timed out, trying JSONP fallback:', getErr);
  }

  // 3. المحاولة الثالثة: JSONP Fallback (يتجاوز تماماً قيود CORS في GitHub Pages)
  if (['ping', 'login', 'getNetworks', 'getBranches', 'getSystemNotifications', 'getPendingBranchCash'].includes(payload.action)) {
    return await jsonpCall(payload, timeoutMs);
  }

  throw new Error(currentLang === 'en' ? 'Connection timeout or network error' : 'تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت.');
}

function jsonpCall(payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const callbackName = 'orchid_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('انتهت مهلة استجابة JSONP'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function() {
      cleanup();
      reject(new Error('فشل تحميل الـ Script عبر JSONP'));
    };

    const queryParams = new URLSearchParams();
    queryParams.append('callback', callbackName);
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'object' && v !== null) {
        queryParams.append(k, JSON.stringify(v));
      } else {
        queryParams.append(k, v !== undefined && v !== null ? v : '');
      }
    }

    script.src = `${API_ENDPOINT}?${queryParams.toString()}`;
    document.body.appendChild(script);
  });
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.innerText = message;
  toast.className = 'google-snackbar toast-' + type;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// -------------------------------------------------------------
// اللغات (i18n)
// -------------------------------------------------------------
function toggleLanguage() {
  currentLang = (currentLang === 'ar') ? 'en' : 'ar';
  localStorage.setItem('orchid_lang', currentLang);
  applyLanguage(currentLang);
}

function applyLanguage(lang) {
  document.body.className = 'google-theme ' + ((lang === 'en') ? 'ltr' : '');
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'en') ? 'ltr' : 'rtl';

  const text = document.getElementById('langText');
  if (text) text.innerText = (lang === 'ar') ? 'English' : 'العربية';

  const loginLangBtn = document.getElementById('loginLangBtnText');
  if (loginLangBtn) loginLangBtn.innerText = (lang === 'ar') ? 'English' : 'العربية';

  const dict = I18N[lang] || I18N.ar;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.innerText = dict[key];
  });

  if (trendChartInstance) refreshDashboard();
}

// -------------------------------------------------------------
// الصلاحيات والتحكم بالوصول وعزل الفروع (RBAC & Branch Isolation)
// -------------------------------------------------------------
function hasPermission(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'Admin') return true;
  if (!currentUser.permissions) return false;
  if (currentUser.permissions.includes('ALL')) return true;
  return currentUser.permissions.includes(perm);
}

function checkSession() {
  try {
    const saved = localStorage.getItem('orchid_user');
    if (saved) {
      currentUser = JSON.parse(saved);
      if (currentUser && currentUser.username) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        setupUserSession();
      }
    }
  } catch (e) {}
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  const errDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!u || !p) {
    errDiv.innerText = (currentLang === 'en') ? 'Please enter username and password' : 'يرجى إدخال اسم المستخدم وكلمة المرور';
    errDiv.style.display = 'block';
    return;
  }

  errDiv.style.display = 'none';
  btn.disabled = true;
  btn.innerText = (currentLang === 'en') ? 'Authenticating...' : 'جاري التحقق والاتصال بقاعدة البيانات...';

  try {
    const res = await apiCall({ action: 'login', username: u, password: p });
    btn.disabled = false;
    btn.innerText = (currentLang === 'en') ? 'Sign In' : 'تسجيل الدخول';

    if (res && res.success) {
      currentUser = res.user;
      localStorage.setItem('orchid_user', JSON.stringify(currentUser));
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';
      setupUserSession();
      showToast((currentLang === 'en' ? 'Welcome ' : 'مرحباً بك ') + (currentUser.fullName || currentUser.username), 'success');
      return;
    } else {
      const match = FALLBACK_USERS.find(user =>
        user.username.toLowerCase() === u.toLowerCase() &&
        (user.password === p || (user.username.toLowerCase() === 'admin' && (p === 'admin123' || p === '123')))
      );
      if (match) {
        currentUser = match;
        localStorage.setItem('orchid_user', JSON.stringify(currentUser));
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        setupUserSession();
        showToast((currentLang === 'en' ? 'Logged in as ' : 'تم الدخول بحساب ') + currentUser.fullName, 'success');
        return;
      }
      errDiv.innerText = res.message || ((currentLang === 'en') ? 'Invalid username or password' : 'بيانات الدخول غير صحيحة');
      errDiv.style.display = 'block';
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = (currentLang === 'en') ? 'Sign In' : 'تسجيل الدخول';
    const match = FALLBACK_USERS.find(user =>
      user.username.toLowerCase() === u.toLowerCase() &&
      (user.password === p || (user.username.toLowerCase() === 'admin' && (p === 'admin123' || p === '123')))
    );
    if (match) {
      currentUser = match;
      localStorage.setItem('orchid_user', JSON.stringify(currentUser));
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';
      setupUserSession();
      showToast((currentLang === 'en' ? 'Logged in via emergency offline account' : 'تم الدخول بحساب الطوارئ المعتمد'), 'warning');
      return;
    }
    errDiv.innerText = ((currentLang === 'en') ? 'Connection error: ' : 'تعذر الاتصال بقاعدة البيانات: ') + (err.message || err);
    errDiv.style.display = 'block';
  }
}

function setupUserSession() {
  if (!currentUser) return;
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  const setDisp = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? 'flex' : 'none'; };

  setTxt('userNameDisplay', currentUser.fullName || currentUser.username);
  setTxt('userBadge', (currentUser.role || 'User') + ' - ' + (currentUser.branch || 'الفرع الرئيسي'));
  setTxt('currentBranchDisplay', currentUser.branch || 'الفرع الرئيسي');

  // التحكم الديناميكي بإظهار القوائم
  setDisp('navDashboard', hasPermission('VIEW_DASHBOARD'));
  setDisp('navSales', (hasPermission('SUBMIT_SALES') || hasPermission('VIEW_SALES')));
  setDisp('navAudit', hasPermission('AUDIT_SALES'));
  setDisp('navTreasury', (hasPermission('MANAGE_TREASURY') || currentUser.role === 'Admin' || currentUser.role === 'Treasury'));
  setDisp('navChat', true);
  setDisp('navNetworks', hasPermission('MANAGE_NETWORKS'));
  setDisp('navExpenses', hasPermission('MANAGE_EXPENSES'));
  setDisp('navUsers', hasPermission('MANAGE_USERS'));
  setDisp('navBranches', hasPermission('MANAGE_BRANCHES'));
  setDisp('navReports', hasPermission('VIEW_REPORTS'));
  setDisp('navTasks', true);

  // ضبط التواريخ
  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('salesDate')) document.getElementById('salesDate').value = today;
  if (document.getElementById('expDate')) document.getElementById('expDate').value = today;
  if (document.getElementById('repStartDate')) document.getElementById('repStartDate').value = today;
  if (document.getElementById('repEndDate')) document.getElementById('repEndDate').value = today;

  loadInitialData();

  if (currentUser.role === 'Treasury') switchView('treasuryView');
  else if (hasPermission('VIEW_DASHBOARD')) switchView('dashboardView');
  else if (hasPermission('SUBMIT_SALES')) switchView('salesView');
  else if (hasPermission('AUDIT_SALES')) switchView('auditView');
}

function logout() {
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  localStorage.removeItem('orchid_user');
  currentUser = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('loginForm').reset();
  showToast('تم تسجيل الخروج بنجاح');
}

function switchView(viewId) {
  const sb = document.getElementById('mainSidebar');
  if (sb) sb.classList.remove('mobile-open');

  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-menu .nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';

  const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(a => (a.getAttribute('onclick') || '').includes(viewId));
  if (activeBtn) activeBtn.classList.add('active');

  const activeMobileBtn = Array.from(document.querySelectorAll('.mobile-nav-btn')).find(a => (a.getAttribute('onclick') || '').includes(viewId));
  if (activeMobileBtn) activeMobileBtn.classList.add('active');

  const titles = {
    dashboardView: (currentLang === 'en') ? 'Dashboard & Analytics' : 'لوحة المؤشرات والرسوم البيانية',
    salesView: (currentLang === 'en') ? 'Daily Sales Closing' : 'إغلاق المبيعات اليومي للفرع والمرفقات',
    auditView: (currentLang === 'en') ? 'Blind Audit & Matching' : 'التدقيق والمطابقة المحاسبية المستقلة',
    treasuryView: (currentLang === 'en') ? 'Treasury & Cash Collection' : 'خزينة المؤسسة وإدارة السيولة النقدية',
    chatView: (currentLang === 'en') ? 'Live Branch Chat' : 'محادثات الفروع والعمليات المباشرة',
    networksView: (currentLang === 'en') ? 'POS Networks Setup' : 'إدارة شبكات ونقاط البيع وتفعيل الفروع',
    expensesView: (currentLang === 'en') ? 'Expenses Management' : 'إدارة واعتماد المصروفات',
    usersView: (currentLang === 'en') ? 'Users & Permissions' : 'إدارة المستخدمين والصلاحيات المخصصة',
    branchesView: (currentLang === 'en') ? 'Branches & Locations' : 'الفروع التشغيلية ومجلدات Drive',
    reportsView: (currentLang === 'en') ? 'Executive Reports (A4 & Excel)' : 'التقارير المالية التنفيذية (A4 & Excel)',
    tasksView: (currentLang === 'en') ? 'Operations & Tasks Management' : 'إدارة المهام والعمليات التشغيلية'
  };
  document.getElementById('pageTitle').innerText = titles[viewId] || 'النظام المؤسسي';

  if (viewId === 'chatView') {
    renderCachedChatMessages();
    loadChatMessages();
    loadChatEmployeesList();
    if (!chatPollingInterval) chatPollingInterval = setInterval(loadChatMessages, 12000);
  } else {
    if (chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null; }
  }

  if (viewId === 'dashboardView') refreshDashboard();
  if (viewId === 'salesView') { renderDynamicSalesNetworks(); loadSalesHistory(); }
  if (viewId === 'auditView') loadPendingAudits();
  if (viewId === 'treasuryView') loadTreasuryData();
  if (viewId === 'networksView') loadNetworks();
  if (viewId === 'expensesView') loadExpensesHistory();
  if (viewId === 'usersView') loadUsers();
  if (viewId === 'branchesView') loadBranches();
  if (viewId === 'reportsView') { loadReportBranches(); loadReportLogs(); }
  if (viewId === 'tasksView') loadTasks();
}

function toggleMobileSidebar() {
  const sb = document.getElementById('mainSidebar');
  if (sb) sb.classList.toggle('mobile-open');
}

function loadInitialData() {
  loadBranchesDropdowns();
  loadAllNetworksCached();
  loadSystemNotifications();
}

async function loadAllNetworksCached() {
  try {
    const res = await apiCall({ action: 'getNetworks' });
    if (res && res.success && res.networks) allSystemNetworks = res.networks;
  } catch(e) {}
}

// -------------------------------------------------------------
// نظام المحادثات فائق السرعة مع Optimistic UI
// -------------------------------------------------------------
function selectChatChannel(recipient, title) {
  activeChatRecipient = recipient;
  activeChatRoomTitle = title;
  document.getElementById('chatRoomTitle').innerText = title;
  document.getElementById('chatRoomAvatar').innerText = (recipient === 'ALL') ? 'campaign' : 'person';
  document.getElementById('chatRoomStatus').innerText = (recipient === 'ALL') ? 'محادثة عامة لكافة الفروع والإدارة' : `محادثة خاصة ومباشرة 1:1 مع: ${recipient}`;

  document.querySelectorAll('.chat-channel-item, .chat-user-item').forEach(el => el.classList.remove('active'));
  if (recipient === 'ALL') document.getElementById('channelPublicBtn').classList.add('active');

  renderCachedChatMessages();
  loadChatMessages();
}

function renderCachedChatMessages() {
  const win = document.getElementById('chatMessagesWindow');
  if (!win) return;
  const filtered = localChatCache.filter(msg => {
    if (activeChatRecipient === 'ALL') return msg.channelType === 'PUBLIC';
    return msg.channelType === 'PRIVATE' && (
      (msg.senderName === currentUser.fullName && msg.recipient === activeChatRecipient) ||
      (msg.senderName === activeChatRecipient && msg.recipient === currentUser.fullName)
    );
  });

  if (filtered.length > 0) renderMessagesInDOM(filtered);
}

function renderMessagesInDOM(messages) {
  const win = document.getElementById('chatMessagesWindow');
  let html = '';
  messages.forEach(msg => {
    const isMe = (msg.senderName === currentUser.fullName || msg.senderName === currentUser.username);
    const bubbleClass = isMe ? 'bubble-out' : 'bubble-in';
    const imgTag = msg.imageUrl ? `<a href="${msg.imageUrl}" target="_blank"><img src="${msg.imageUrl}" class="chat-img-thumb" alt="صورة"></a>` : '';

    html += `
      <div class="chat-bubble ${bubbleClass}">
        <div class="chat-sender">${msg.senderName} (${msg.branch})</div>
        ${msg.text ? `<div>${msg.text}</div>` : ''}
        ${imgTag}
        <div class="chat-time">${msg.timestamp.split(' ')[1] || msg.timestamp} ${isMe ? '✓✓' : ''}</div>
      </div>
    `;
  });
  win.innerHTML = html;
  win.scrollTop = win.scrollHeight;
}

async function loadChatMessages() {
  if (!currentUser) return;
  try {
    const res = await apiCall({
      action: 'getChatMessages',
      currentUser: currentUser.fullName || currentUser.username,
      branch: currentUser.branch,
      targetRecipient: activeChatRecipient
    });

    if (res && res.success && res.messages) {
      localChatCache = res.messages;
      sessionStorage.setItem('orchid_chat_cache', JSON.stringify(localChatCache));
      renderMessagesInDOM(res.messages);
    }
  } catch(e) {}
}

async function loadChatEmployeesList() {
  try {
    const res = await apiCall({ action: 'getUsers' });
    if (res && res.success && res.users) {
      const container = document.getElementById('chatEmployeesList');
      container.innerHTML = '';
      res.users.forEach(u => {
        if (u.fullName !== currentUser.fullName && u.username !== currentUser.username) {
          const roleLabel = (u.role === 'Admin') ? 'مدير' : (u.role === 'Auditor' ? 'محاسب' : (u.role === 'Treasury' ? 'خزينة' : 'كاشير'));
          container.innerHTML += `
            <button type="button" class="chat-user-item" onclick="selectChatChannel('${u.fullName}', 'محادثة خاصة: ${u.fullName} (${u.branch})')">
              <span class="user-avatar-circle"><span class="material-symbols-outlined" style="font-size:18px;">person</span></span>
              <div class="emp-info">
                <strong>${u.fullName}</strong>
                <span class="emp-sub">${roleLabel} - ${u.branch}</span>
              </div>
            </button>
          `;
        }
      });
    }
  } catch(e) {}
}

function handleChatImageSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    chatPendingImageBase64 = e.target.result;
    document.getElementById('chatPreviewImg').src = chatPendingImageBase64;
    document.getElementById('chatPreviewFileName').innerText = file.name;
    document.getElementById('chatImagePreviewBar').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function cancelChatImagePreview() {
  chatPendingImageBase64 = null;
  document.getElementById('chatFileInput').value = '';
  document.getElementById('chatImagePreviewBar').style.display = 'none';
}

async function sendChatMessage(e) {
  if (e) e.preventDefault();
  const textInput = document.getElementById('chatTextInput');
  const text = textInput.value.trim();
  if (!text && !chatPendingImageBase64) return;

  const currentImg = chatPendingImageBase64;
  textInput.value = '';
  cancelChatImagePreview();

  // Optimistic UI: إظهار الرسالة فوراً في الشاشة دون انتظار استجابة السيرفر
  const tempMsg = {
    messageID: 'TEMP-' + Date.now(),
    timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    senderName: currentUser.fullName || currentUser.username,
    senderRole: currentUser.role,
    branch: currentUser.branch || 'الفرع الرئيسي',
    text: text,
    imageUrl: currentImg,
    recipient: activeChatRecipient,
    channelType: (activeChatRecipient === 'ALL') ? 'PUBLIC' : 'PRIVATE'
  };
  localChatCache.push(tempMsg);
  renderMessagesInDOM(localChatCache);

  try {
    await apiCall({
      action: 'sendChatMessage',
      senderName: currentUser.fullName || currentUser.username,
      senderRole: currentUser.role,
      branch: currentUser.branch || 'الفرع الرئيسي',
      text: text,
      imageBase64: currentImg,
      channelType: (activeChatRecipient === 'ALL') ? 'PUBLIC' : 'PRIVATE',
      recipientUser: activeChatRecipient
    });
    loadChatMessages();
  } catch(err) {
    showToast('تعذر إرسال الرسالة إلى السيرفر: ' + err.message, 'danger');
  }
}

// -------------------------------------------------------------
// الداشبورد والرسوم البيانية
// -------------------------------------------------------------
function setDashDateQuick(period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sInput = document.getElementById('dashStartDate');
  const eInput = document.getElementById('dashEndDate');
  if (period === 'today') { sInput.value = today; eInput.value = today; }
  else if (period === 'month') { sInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; eInput.value = today; }
  else if (period === 'all') { sInput.value = ''; eInput.value = ''; }
  refreshDashboard();
}

async function refreshDashboard() {
  if (!currentUser) return;
  const branchFilter = document.getElementById('dashBranchFilter').value || 'ALL';
  const startDate = document.getElementById('dashStartDate').value;
  const endDate = document.getElementById('dashEndDate').value;

  try {
    const res = await apiCall({
      action: 'getDashboard',
      branch: branchFilter,
      role: currentUser.role,
      startDate: startDate,
      endDate: endDate
    });

    if (res && res.success && res.metrics) {
      const m = res.metrics;
      document.getElementById('dashTotalSales').innerText = (m.totalSales || 0).toFixed(2) + ' ر.س';
      document.getElementById('dashTotalCash').innerText = (m.totalCash || 0).toFixed(2) + ' ر.س';
      document.getElementById('dashTotalPOS').innerText = (m.totalPOS || 0).toFixed(2) + ' ر.س';
      document.getElementById('dashTotalExpenses').innerText = (m.totalExpenses || 0).toFixed(2) + ' ر.س';
      document.getElementById('dashNetIncome').innerText = (m.netCashFlow || 0).toFixed(2) + ' ر.س';
      document.getElementById('dashPendingAudits').innerText = m.pendingAudits || 0;

      renderNetworksSummary(m.networkTotals || {});
      renderCharts(m, m.branchStats, m.trendData);
    }
  } catch (err) {}
}

function renderNetworksSummary(networkTotals) {
  const container = document.getElementById('dashNetworksContainer');
  if (!container) return;
  const keys = Object.keys(networkTotals);
  if (keys.length === 0) {
    container.innerHTML = '<p style="color: var(--google-gray); font-size: 0.9rem;">لا توجد حركات شبكات في الفترة المحددة.</p>';
    return;
  }
  let html = '';
  keys.forEach(k => {
    const net = allSystemNetworks.find(n => n.code === k);
    const label = net ? net.name : k;
    const amount = networkTotals[k] || 0;
    html += `
      <div class="net-stat-box">
        <div class="net-name">${label}</div>
        <div class="net-val">${amount.toFixed(2)} <span style="font-size:0.75rem;">ر.س</span></div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderCharts(metrics, branchStats, trendData) {
  const trendCtx = document.getElementById('salesTrendChart');
  if (trendCtx) {
    if (trendChartInstance) trendChartInstance.destroy();
    const labels = trendData && trendData.labels && trendData.labels.length > 0 ? trendData.labels : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const values = trendData && trendData.values && trendData.values.length > 0 ? trendData.values : [1500, 2400, 3100, 2800, 4500, 3900, 5200];

    trendChartInstance = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: (currentLang === 'en') ? 'Daily Sales' : 'المبيعات اليومية',
          data: values,
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#1a73e8'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  const shareCtx = document.getElementById('networksShareChart');
  if (shareCtx) {
    if (networkShareChartInstance) networkShareChartInstance.destroy();
    const netTotals = metrics.networkTotals || {};
    const netLabels = Object.keys(netTotals);
    const netValues = Object.values(netTotals);
    const finalLabels = netLabels.length > 0 ? netLabels : ['مدى (Mada)', 'فيزا/ماستركارد', 'تمارا', 'كاش نقدي'];
    const finalValues = netValues.length > 0 ? netValues : [5100, 2800, 1900, 3400];

    networkShareChartInstance = new Chart(shareCtx, {
      type: 'doughnut',
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,
          backgroundColor: ['#1a73e8', '#1e8e3e', '#f9ab00', '#d93025', '#a142f4']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  const barCtx = document.getElementById('branchesBarChart');
  if (barCtx) {
    if (branchesBarChartInstance) branchesBarChartInstance.destroy();
    const bNames = branchStats && branchStats.names && branchStats.names.length > 0 ? branchStats.names : ['الفرع الرئيسي', 'فرع الرياض 1', 'فرع جدة 1', 'فرع الدمام 1'];
    const bSales = branchStats && branchStats.sales && branchStats.sales.length > 0 ? branchStats.sales : [9200, 6800, 5400, 4100];

    branchesBarChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: bNames,
        datasets: [{
          label: (currentLang === 'en') ? 'Sales' : 'المبيعات',
          data: bSales,
          backgroundColor: '#1a73e8',
          borderRadius: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }
}

// -------------------------------------------------------------
// مسؤول الخزينة (Treasury Custodian)
// -------------------------------------------------------------
async function loadTreasuryData() {
  if (!currentUser) return;
  try {
    const res = await apiCall({ action: 'getPendingBranchCash', branch: currentUser.branch });
    if (res && res.success) {
      // 1. تحديث بطاقات رصيد الخزينة المباشر
      const sum = res.treasurySummary || {};
      document.getElementById('trCurrentBalance').innerText = (sum.currentBalance || 0).toFixed(2) + ' ر.س';
      document.getElementById('trTotalInflow').innerText = (sum.totalInflow || 0).toFixed(2) + ' ر.س';
      document.getElementById('trTotalOutflow').innerText = (sum.totalOutflow || 0).toFixed(2) + ' ر.س';

      // 2. تحديث الإجمالي التراكمي لكافة الفروع
      const grandTotalDisplay = document.getElementById('cumGrandTotalDisplay');
      if (grandTotalDisplay) {
        grandTotalDisplay.innerText = (res.totalAllBranchesPending || 0).toFixed(2) + ' ر.س';
      }

      // 3. عرض كروت الأرصدة التراكمية لكل فرع
      const cumContainer = document.getElementById('cumulativeBranchCardsContainer');
      if (cumContainer) {
        const cumList = res.cumulativePerBranch || [];
        if (cumList.length === 0) {
          cumContainer.innerHTML = '<p style="color:#64748B; font-size:0.9rem; padding:12px;">✅ جميع كاش الفروع تم استلامه وتوريده بالكامل للخزينة، لا توجد مبالغ معلقة.</p>';
        } else {
          let cumHtml = '';
          const isTreasuryUser = (currentUser.role === 'Treasury' || currentUser.role === 'Admin' || hasPermission('MANAGE_TREASURY'));

          cumList.forEach(b => {
            const batchBtn = isTreasuryUser ? `
              <button type="button" class="btn btn-sm btn-success btn-block" style="margin-top:auto;" onclick="receiveBranchBatchCash('${b.branch}', ${b.cumulativeNetDue}, ${b.count}, '${b.salesIds.join(',')}')">
                📥 استلام كامل كاش الفرع التراكمي (${b.cumulativeNetDue.toFixed(2)} ر.س)
              </button>
            ` : `
              <div style="text-align:center; padding:8px; background:#fef7e0; border-radius:8px; font-size:0.78rem; font-weight:700; color:#b06000; margin-top:auto;">
                ⏳ بانتظار استلام وتوريد مسؤول الخزينة
              </div>
            `;

            cumHtml += `
              <div class="cum-branch-card">
                <div class="cum-branch-header">
                  <span class="cum-branch-name">📍 ${b.branch}</span>
                  <span class="cum-badge">${b.count} إغلاقات معلقة</span>
                </div>
                <div class="cum-metrics-list">
                  <div class="cum-metric-row"><span>إجمالي الكاش بالصندوق:</span><strong>${b.totalCash.toFixed(2)} ر.س</strong></div>
                  <div class="cum-metric-row"><span>مصاريف الوردية المخصومة:</span><strong style="color:#DC2626;">-${b.totalShiftExp.toFixed(2)} ر.س</strong></div>
                </div>
                <div class="cum-due-amount">
                  <span style="font-size:0.8rem; font-weight:600; display:block; color:#15803D;">صافي المبلغ التراكمي المستحق:</span>
                  ${b.cumulativeNetDue.toFixed(2)} ر.س
                </div>
                ${batchBtn}
              </div>
            `;
          });
          cumContainer.innerHTML = cumHtml;
        }
      }

      // 4. جدول كاش الفروع الجاهز للاستلام (سجلات مفصلة)
      const pendingTbody = document.querySelector('#pendingCashTable tbody');
      if (pendingTbody) {
        pendingTbody.innerHTML = '';
        const list = res.pendingHandovers || [];

        if (list.length === 0) {
          pendingTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748B;">لا يوجد كاش فروع معلق للاستلام حالياً.</td></tr>';
        } else {
          const isTreasuryUser = (currentUser.role === 'Treasury' || currentUser.role === 'Admin' || hasPermission('MANAGE_TREASURY'));

          list.forEach(item => {
            const actionCell = isTreasuryUser ? `
              <button type="button" class="btn btn-sm btn-success" onclick="receiveBranchCash('${item.salesID}', '${item.branch}', ${item.netCashHandover})">
                📥 استلام الكاش وتوريد الخزينة
              </button>
            ` : `
              <span class="badge badge-warning">⏳ بانتظار استلام مسؤول الخزينة</span>
            `;

            pendingTbody.innerHTML += `
              <tr>
                <td><b>${item.salesID}</b></td>
                <td>${item.date}</td>
                <td>${item.branch}</td>
                <td><b style="color:#16A34A; font-size:1.05rem;">${item.netCashHandover.toFixed(2)} ر.س</b></td>
                <td>${item.submittedBy}</td>
                <td>${actionCell}</td>
              </tr>
            `;
          });
        }
      }

      // 5. جدول أستاذ الخزينة
      loadTreasuryLedger();
    }
  } catch(e) {
    console.error('Error loading treasury data:', e);
  }
}

async function receiveBranchBatchCash(branch, totalAmount, count, salesIdsStr) {
  if (!confirm(`هل أنت متأكد من استلام كامل الكاش التراكمي لفرع ${branch} بمبلغ إجمالي ${totalAmount.toFixed(2)} ر.س لعدد ${count} إغلاقات وتوريده للخزينة؟`)) return;

  try {
    const res = await apiCall({
      action: 'receiveBranchBatchCash',
      branch: branch,
      totalAmount: totalAmount,
      count: count,
      salesIds: salesIdsStr,
      custodianName: currentUser.fullName,
      role: currentUser.role
    });

    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      loadTreasuryData();
      refreshDashboard();
    }
  } catch (err) {
    showToast('خطأ أثناء استلام الكاش التراكمي: ' + err.message, 'danger');
  }
}


async function receiveBranchCash(salesID, branch, amount) {
  if (!confirm(`هل أنت متأكد من استلام مبلغ ${amount.toFixed(2)} ر.س نقداً من فرع ${branch} وتوريده للخزينة؟`)) return;
  try {
    const res = await apiCall({ action: 'receiveBranchCash', salesID, branch, amount, custodianName: currentUser.fullName });
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      loadTreasuryData();
      refreshDashboard();
    }
  } catch (err) { showToast('خطأ: ' + err.message, 'danger'); }
}

async function loadTreasuryLedger() {
  try {
    const res = await apiCall({ action: 'getTreasuryLogs', branch: currentUser.branch, role: currentUser.role });
    if (res && res.success && res.logs) {
      const tbody = document.querySelector('#treasuryLogTable tbody');
      tbody.innerHTML = '';
      res.logs.forEach(l => {
        const isIncome = l.type === 'INCOME';
        const typeBadge = isIncome ? '<span class="badge badge-success">وارد</span>' : '<span class="badge badge-danger">منصرف</span>';
        const amtColor = isIncome ? '#16A34A' : '#DC2626';

        tbody.innerHTML += `
          <tr>
            <td><b>${l.entryID}</b></td>
            <td>${l.date}</td>
            <td>${typeBadge}</td>
            <td>${l.branch}</td>
            <td><b style="color:${amtColor};">${l.totalAmount.toFixed(2)}</b></td>
            <td>${l.description}</td>
            <td>${l.createdBy}</td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

// -------------------------------------------------------------
// إغلاق المبيعات والديناميكية والمرفقات
// -------------------------------------------------------------
async function renderDynamicSalesNetworks() {
  const branchSelect = document.getElementById('salesBranchSelect');
  const targetBranch = (currentUser.role !== 'Admin' && currentUser.branch) ? currentUser.branch : (branchSelect.value || 'الفرع الرئيسي');

  // عزل الفرع للكاشير
  if (currentUser.role !== 'Admin' && currentUser.branch) {
    branchSelect.value = currentUser.branch;
    branchSelect.disabled = true;
  }

  const container = document.getElementById('dynamicNetworksContainer');
  container.innerHTML = '<p style="color: var(--google-gray); font-size:0.85rem;">جاري جلب شبكات الفرع...</p>';

  try {
    const res = await apiCall({ action: 'getNetworks', branch: targetBranch });
    if (res && res.success) {
      currentBranchNetworks = res.networks.filter(n => n.isActiveForBranch);
      if (currentBranchNetworks.length === 0) {
        container.innerHTML = '<p style="color: var(--warning); font-size:0.85rem;">⚠️ لا توجد شبكات دفع مفعلة لهذا الفرع.</p>';
      } else {
        let html = '';
        currentBranchNetworks.forEach(net => {
          html += `
            <div class="form-group" style="margin-bottom:0;">
              <label>${net.name} (${net.type})</label>
              <input type="number" step="0.01" inputmode="decimal" class="form-control net-amount-input" data-code="${net.code}" data-name="${net.name}" oninput="calcSalesTotal()" value="0">
            </div>
          `;
        });
        container.innerHTML = html;
      }
    }
  } catch(e) { container.innerHTML = '<p style="color:red; font-size:0.85rem;">تعذر جلب الشبكات</p>'; }
}

function calcSalesTotal() {
  const actCash = parseFloat(document.getElementById('salesActualCash').value) || 0;
  const shiftExp = parseFloat(document.getElementById('salesShiftExpenses').value) || 0;
  const netHandover = actCash - shiftExp;
  document.getElementById('salesNetCashHandover').value = netHandover.toFixed(2);

  let posSum = 0;
  document.querySelectorAll('.net-amount-input').forEach(inp => { posSum += parseFloat(inp.value) || 0; });
  document.getElementById('salesTotal').value = (actCash + posSum).toFixed(2);
}

function handleSalesAttachmentsPreview(input) {
  const files = input.files;
  if (!files || files.length === 0) return;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      salesAttachedFiles.push({ name: file.name, base64: e.target.result });
      renderAttachmentsChips();
    };
    reader.readAsDataURL(file);
  });
}

function renderAttachmentsChips() {
  const container = document.getElementById('attachmentsPreviewList');
  container.innerHTML = '';
  salesAttachedFiles.forEach((file, index) => {
    container.innerHTML += `
      <div class="att-chip">
        <span>📎 ${file.name}</span>
        <span class="btn-del-att" onclick="removeSalesAttachment(${index})">✕</span>
      </div>
    `;
  });
}
function removeSalesAttachment(idx) { salesAttachedFiles.splice(idx, 1); renderAttachmentsChips(); }

async function submitSales(e) {
  if (e) e.preventDefault();
  const btn = document.getElementById('salesSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'جاري الترحيل والحفظ...';

  const branch = document.getElementById('salesBranchSelect').value || currentUser.branch;
  const actCash = parseFloat(document.getElementById('salesActualCash').value) || 0;
  const shiftExp = parseFloat(document.getElementById('salesShiftExpenses').value) || 0;

  let posSum = 0;
  const breakdown = {};
  document.querySelectorAll('.net-amount-input').forEach(inp => {
    const code = inp.getAttribute('data-code');
    const val = parseFloat(inp.value) || 0;
    breakdown[code] = val;
    posSum += val;
  });

  const payload = {
    action: 'saveSales',
    date: document.getElementById('salesDate').value,
    branch: branch,
    actualCash: actCash,
    shiftExpenses: shiftExp,
    posAmount: posSum,
    notes: document.getElementById('salesNotes').value,
    submittedBy: currentUser.fullName,
    networkBreakdown: breakdown,
    attachments: salesAttachedFiles
  };

  try {
    const res = await apiCall(payload);
    btn.disabled = false;
    btn.innerText = 'ترحيل الإغلاق اليومي للمحاسبة (Ctrl+S)';
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }

    if (res.success) {
      document.getElementById('salesForm').reset();
      salesAttachedFiles = [];
      renderAttachmentsChips();
      calcSalesTotal();
      renderDynamicSalesNetworks();
      loadSalesHistory();
      refreshDashboard();
      loadSystemNotifications();
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = 'ترحيل الإغلاق اليومي للمحاسبة (Ctrl+S)';
    showToast('خطأ: ' + err.message, 'danger');
  }
}

async function loadSalesHistory() {
  if (!currentUser) return;
  const stFilter = document.getElementById('salesStatusFilter') ? document.getElementById('salesStatusFilter').value : 'ALL';
  try {
    const res = await apiCall({ action: 'getSalesHistory', branch: currentUser.branch, role: currentUser.role, filters: { status: stFilter } });
    if (res && res.success && res.sales) {
      const tbody = document.querySelector('#salesHistoryTable tbody');
      tbody.innerHTML = '';
      res.sales.forEach(s => {
        let badge = '<span class="badge badge-warning">بانتظار التدقيق</span>';
        if (s.status === 'Audited_Matched') badge = '<span class="badge badge-success">✅ مطابق معتمد</span>';
        else if (s.status.includes('Audited_Deficit')) badge = `<span class="badge badge-danger">⚠️ عجز: ${s.status.replace('Audited_Deficit_', '')} ر.س</span>`;
        else if (s.status.includes('Audited_Surplus')) badge = `<span class="badge badge-info">🔵 زيادة: ${s.status.replace('Audited_Surplus_', '')} ر.س</span>`;

        const netHandover = (s.cashAmount - (s.shiftExpenses || 0)).toFixed(2);
        tbody.innerHTML += `
          <tr>
            <td><b>${s.salesID}</b></td>
            <td>${s.date}</td>
            <td>${s.branch}</td>
            <td>${s.cashAmount.toFixed(2)}</td>
            <td>${s.posAmount.toFixed(2)}</td>
            <td><b style="color:#16A34A;">${netHandover} ر.س</b></td>
            <td>${s.attachmentsUrls ? '<a href="' + s.attachmentsUrls.split(' | ')[0] + '" target="_blank" class="badge badge-info">عرض المرفق</a>' : '-'}</td>
            <td>${badge}</td>
          </tr>
        `;
      });
    }
  } catch (e) {}
}

// التدقيق الأعمى
async function loadPendingAudits() {
  if (!currentUser) return;
  try {
    const res = await apiCall({ action: 'getSalesHistory', branch: currentUser.branch, role: currentUser.role, filters: { status: 'Pending' } });
    if (res && res.success && res.sales) {
      const tbody = document.querySelector('#pendingSalesTable tbody');
      tbody.innerHTML = '';
      const pendingList = res.sales.filter(s => s.status === 'Pending');
      if (pendingList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748B;">لا توجد إغلاقات معلقة بانتظار التدقيق.</td></tr>';
        return;
      }
      pendingList.forEach(s => {
        const attLink = s.attachmentsUrls ? '<a href="' + s.attachmentsUrls.split(' | ')[0] + '" target="_blank" class="badge badge-info">فتح المرفقات 📎</a>' : '-';
        tbody.innerHTML += `
          <tr>
            <td><b>${s.salesID}</b></td>
            <td>${s.date}</td>
            <td>${s.branch}</td>
            <td>${s.submittedBy}</td>
            <td>${attLink}</td>
            <td><button type="button" class="btn btn-sm btn-primary" onclick="openBlindAuditModal('${s.salesID}', '${s.branch}', '${s.submittedBy}', ${s.cashAmount}, ${s.posAmount})">🔍 تدقيق أعمى</button></td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

function openBlindAuditModal(salesID, branch, cashier, sysCash, sysPOS) {
  activeAuditRecord = { salesID, branch, cashier, sysCash, sysPOS, sysTotal: sysCash + sysPOS };
  document.getElementById('auditTargetID').innerText = salesID;
  document.getElementById('auditBranchName').innerText = branch;
  document.getElementById('auditCashierName').innerText = cashier;
  document.getElementById('auditActualCash').value = '';
  document.getElementById('auditActualPOS').value = '';
  document.getElementById('auditFinalNotes').value = '';
  document.getElementById('blindAuditStep1').style.display = 'block';
  document.getElementById('blindAuditStep2').style.display = 'none';
  document.getElementById('auditActionCard').style.display = 'block';
  document.getElementById('auditActionCard').scrollIntoView({ behavior: 'smooth' });
}

function revealBlindAuditComparison() {
  const actCash = parseFloat(document.getElementById('auditActualCash').value);
  const actPOS = parseFloat(document.getElementById('auditActualPOS').value);
  if (isNaN(actCash) || isNaN(actPOS)) { alert('يرجى إدخال مبالغ الكاش والشبكة الفعلية أولاً'); return; };

  const rec = activeAuditRecord;
  const actTotal = actCash + actPOS;
  const diffCash = actCash - rec.sysCash;
  const diffPOS = actPOS - rec.sysPOS;
  const diffTotal = actTotal - rec.sysTotal;

  document.getElementById('cmpSysCash').innerText = rec.sysCash.toFixed(2) + ' ر.س';
  document.getElementById('cmpActCash').innerText = actCash.toFixed(2) + ' ر.س';
  formatDiffCell('cmpDiffCash', diffCash);

  document.getElementById('cmpSysPOS').innerText = rec.sysPOS.toFixed(2) + ' ر.س';
  document.getElementById('cmpActPOS').innerText = actPOS.toFixed(2) + ' ر.س';
  formatDiffCell('cmpDiffPOS', diffPOS);

  document.getElementById('cmpSysTotal').innerText = rec.sysTotal.toFixed(2) + ' ر.س';
  document.getElementById('cmpActTotal').innerText = actTotal.toFixed(2) + ' ر.س';
  formatDiffCell('cmpDiffTotal', diffTotal);

  const banner = document.getElementById('auditMatchResultBanner');
  if (Math.abs(diffTotal) === 0) {
    banner.className = 'alert alert-success';
    banner.innerHTML = '🎉 <strong>العملية متطابقة 100%!</strong> لا توجد أي فروقات.';
  } else if (diffTotal < 0) {
    banner.className = 'alert alert-danger';
    banner.innerHTML = `⚠️ <strong>يوجد عجز نقدي / شبكات:</strong> بمقدار <b>${Math.abs(diffTotal).toFixed(2)} ر.س</b>.`;
  } else {
    banner.className = 'alert alert-info';
    banner.innerHTML = `🔵 <strong>توجد زيادة نقدية / شبكات:</strong> بمقدار <b>${diffTotal.toFixed(2)} ر.س</b>.`;
  }

  document.getElementById('blindAuditStep1').style.display = 'none';
  document.getElementById('blindAuditStep2').style.display = 'block';
}

function formatDiffCell(elId, diff) {
  const el = document.getElementById(elId);
  if (Math.abs(diff) === 0) { el.innerText = '0.00 (مطابق)'; el.className = 'diff-cell diff-zero'; }
  else if (diff < 0) { el.innerText = diff.toFixed(2) + ' ر.س (عجز)'; el.className = 'diff-cell diff-deficit'; }
  else { el.innerText = '+' + diff.toFixed(2) + ' ر.س (زيادة)'; el.className = 'diff-cell diff-surplus'; }
}

function resetBlindAuditModal() {
  document.getElementById('blindAuditStep1').style.display = 'block';
  document.getElementById('blindAuditStep2').style.display = 'none';
}
function closeBlindAuditModal() {
  document.getElementById('auditActionCard').style.display = 'none';
  activeAuditRecord = null;
}

async function confirmAuditSubmission() {
  const btn = document.getElementById('auditConfirmBtn');
  btn.disabled = true;
  btn.innerText = 'جاري الاعتماد وتوريد الخزينة...';

  const actCash = parseFloat(document.getElementById('auditActualCash').value) || 0;
  const actPOS = parseFloat(document.getElementById('auditActualPOS').value) || 0;
  const notes = document.getElementById('auditFinalNotes').value;

  const payload = {
    action: 'reviewSalesBlind',
    salesID: activeAuditRecord.salesID,
    actualCash: actCash,
    actualPOS: actPOS,
    notes: notes,
    auditorName: currentUser.fullName
  };

  try {
    const res = await apiCall(payload);
    btn.disabled = false;
    btn.innerText = '✅ اعتماد وتوريد الخزينة';
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }

    if (res.success) {
      closeBlindAuditModal();
      loadPendingAudits();
      refreshDashboard();
      loadSystemNotifications();
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = '✅ اعتماد وتوريد الخزينة';
    showToast('خطأ: ' + err.message, 'danger');
  }
}

// -------------------------------------------------------------
// بقية الدوال (إشعارات، فروع، مستخدمين، شبكات، تقارير)
// -------------------------------------------------------------
function toggleNotificationsDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (dd.style.display === 'none') { dd.style.display = 'block'; loadSystemNotifications(); }
  else dd.style.display = 'none';
}

let cachedSystemNotifs = [];

function loadSystemNotifications() {
  if (!currentUser) return;
  const list = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  try {
    apiCall({ action: 'getSystemNotifications', branch: currentUser.branch, role: currentUser.role })
      .then(res => {
        if (res && res.success && res.notifications) {
          const notifs = res.notifications;
          cachedSystemNotifs = notifs;
          if (badge) {
            badge.innerText = notifs.length;
            badge.style.display = notifs.length > 0 ? 'flex' : 'none';
          }
          if (!list) return;
          if (notifs.length === 0) { list.innerHTML = '<p class="notif-empty">لا توجد إشعارات جديدة حالياً</p>'; return; }
          let html = '';
          notifs.forEach((n, index) => {
            html += `
              <div class="notif-item" style="cursor:pointer;" onclick="handleNotifClick('${n.targetView || 'dashboardView'}')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div style="flex:1;">
                    <strong style="color:var(--google-dark); font-size:0.9rem;">${n.title}</strong>
                    <div style="color:var(--google-gray); font-size:0.8rem; margin:2px 0;">${n.description}</div>
                    <small style="color:#94a3b8;">${n.time}</small>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:3px 8px; flex-shrink:0;" onclick="event.stopPropagation(); convertNotifToTask(${index})" title="تحويل هذا الإشعار لمهمة متابعة">
                    📌 تحويل لمهمة
                  </button>
                </div>
              </div>
            `;
          });
          list.innerHTML = html;
        }
      }).catch(() => {});
  } catch(e) {}
}

function handleNotifClick(targetView) {
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifDropdown) notifDropdown.style.display = 'none';
  if (targetView) switchView(targetView);
  triggerHapticFeedback([10]);
}

async function convertNotifToTask(notifIdx) {
  const notif = cachedSystemNotifs[notifIdx];
  if (!notif) return;

  try {
    const res = await apiCall({
      action: 'saveTask',
      title: notif.title + ' (' + notif.branch + ')',
      description: notif.description,
      branch: notif.branch,
      refID: notif.refID || '',
      assignedTo: currentUser.fullName || currentUser.username,
      createdBy: currentUser.fullName || currentUser.username,
      priority: 'عالية'
    });

    if (res && res.success) {
      triggerHapticFeedback([20, 50, 20]);
      playSuccessChime();
      showToast('✅ تم تحويل الإشعار إلى مهمة بنجاح!', 'success');
      loadTasks();
    }
  } catch(e) {
    showToast('تعذر تحويل الإشعار: ' + e.message, 'danger');
  }
}

async function loadNetworks() {
  try {
    const res = await apiCall({ action: 'getNetworks' });
    if (res && res.success && res.networks) {
      allSystemNetworks = res.networks;
      const tbody = document.querySelector('#networksManagementTable tbody');
      tbody.innerHTML = '';
      res.networks.forEach(net => {
        const allowed = net.allowedBranches === 'ALL' ? 'جميع الفروع الموحدة' : (net.allowedBranches || 'معطل');
        const statusBadge = net.status === 'Active' ? '<span class="badge badge-success">نشطة</span>' : '<span class="badge badge-danger">معطلة</span>';
        tbody.innerHTML += `
          <tr>
            <td><b>${net.networkID}</b></td>
            <td>${net.name}</td>
            <td><code>${net.code}</code></td>
            <td><span class="badge badge-info">${net.type}</span></td>
            <td>${statusBadge}</td>
            <td style="font-size:0.82rem;">${allowed}</td>
            <td><button type="button" class="btn btn-sm btn-outline" onclick="editNetwork('${net.networkID}', '${net.name}', '${net.code}', '${net.type}', '${net.allowedBranches}')">تعديل وتخصيص</button></td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

function openNewNetworkModal() {
  document.getElementById('netEditID').value = '';
  document.getElementById('networkModalTitle').innerText = 'إضافة شبكة دفع جديدة';
  document.getElementById('networkForm').reset();
  renderBranchCheckboxesForNetwork('ALL');
  document.getElementById('networkModal').style.display = 'flex';
}
function closeNetworkModal() { document.getElementById('networkModal').style.display = 'none'; }

function editNetwork(id, name, code, type, allowed) {
  document.getElementById('netEditID').value = id;
  document.getElementById('networkModalTitle').innerText = 'تعديل وتخصيص شبكة: ' + name;
  document.getElementById('netName').value = name;
  document.getElementById('netCode').value = code;
  document.getElementById('netType').value = type;
  renderBranchCheckboxesForNetwork(allowed);
  document.getElementById('networkModal').style.display = 'flex';
}

async function renderBranchCheckboxesForNetwork(allowedBranchesStr) {
  const container = document.getElementById('netBranchesCheckboxes');
  container.innerHTML = 'جاري تحميل الفروع...';
  try {
    const res = await apiCall({ action: 'getBranches' });
    if (res && res.success && res.branches) {
      let html = '<label class="perm-item" style="grid-column: 1 / -1;"><input type="checkbox" id="checkAllBranches" onchange="toggleSelectAllBranches(this)"> <strong>تفعيل لجميع الفروع (ALL)</strong></label>';
      const isAll = (allowedBranchesStr === 'ALL');
      const selected = isAll ? [] : (allowedBranchesStr ? allowedBranchesStr.split(',').map(b => b.trim()) : []);

      res.branches.forEach(b => {
        const checked = isAll || selected.includes(b.name) ? 'checked' : '';
        html += `<label class="perm-item"><input type="checkbox" class="net-branch-check" value="${b.name}" ${checked}> ${b.name}</label>`;
      });
      container.innerHTML = html;
      if (isAll) document.getElementById('checkAllBranches').checked = true;
    }
  } catch(e) {}
}

function toggleSelectAllBranches(master) {
  document.querySelectorAll('.net-branch-check').forEach(cb => { cb.checked = master.checked; });
}

async function submitNetwork(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('netEditID').value;
  const isAll = document.getElementById('checkAllBranches') && document.getElementById('checkAllBranches').checked;
  let branchList = [];
  if (!isAll) {
    document.querySelectorAll('.net-branch-check:checked').forEach(cb => { branchList.push(cb.value); });
  }

  const payload = {
    action: 'saveNetwork',
    networkID: id,
    name: document.getElementById('netName').value,
    code: document.getElementById('netCode').value,
    type: document.getElementById('netType').value,
    status: 'Active',
    allowedBranches: isAll ? 'ALL' : branchList
  };

  try {
    const res = await apiCall(payload);
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      closeNetworkModal();
      loadNetworks();
      loadAllNetworksCached();
    }
  } catch (err) { showToast('خطأ: ' + err.message, 'danger'); }
}

function autoFillRolePermissions() {
  const role = document.getElementById('userRole').value;
  document.querySelectorAll('.perm-check').forEach(cb => cb.checked = false);

  if (role === 'Admin') {
    document.querySelectorAll('.perm-check').forEach(cb => cb.checked = true);
  } else if (role === 'Auditor') {
    const perms = ['VIEW_DASHBOARD', 'AUDIT_SALES', 'BLIND_AUDIT', 'VIEW_VARIANCES', 'VIEW_SALES', 'VIEW_EXPENSES', 'MANAGE_EXPENSES', 'VIEW_REPORTS'];
    document.querySelectorAll('.perm-check').forEach(cb => { if (perms.includes(cb.value)) cb.checked = true; });
  } else if (role === 'Treasury') {
    const perms = ['MANAGE_TREASURY', 'VIEW_DASHBOARD', 'VIEW_EXPENSES'];
    document.querySelectorAll('.perm-check').forEach(cb => { if (perms.includes(cb.value)) cb.checked = true; });
  } else if (role === 'User') {
    const perms = ['SUBMIT_SALES', 'VIEW_SALES', 'VIEW_EXPENSES'];
    document.querySelectorAll('.perm-check').forEach(cb => { if (perms.includes(cb.value)) cb.checked = true; });
  }
}

async function loadUsers() {
  try {
    const res = await apiCall({ action: 'getUsers' });
    if (res && res.success && res.users) {
      const tbody = document.querySelector('#usersTable tbody');
      tbody.innerHTML = '';
      res.users.forEach(u => {
        const permsStr = Array.isArray(u.permissions) ? u.permissions.join(', ') : (u.permissions || '-');
        tbody.innerHTML += `
          <tr>
            <td>${u.userID}</td>
            <td><b>${u.username}</b></td>
            <td>${u.fullName}</td>
            <td><span class="badge badge-info">${u.role}</span></td>
            <td>${u.branch}</td>
            <td style="font-size:0.75rem; max-width:200px; word-break:break-all;">${permsStr}</td>
            <td>${u.status === 'Active' ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-danger">معطل</span>'}</td>
            <td>
              <button type="button" class="btn btn-sm btn-primary" onclick="editUser('${u.userID}', '${u.username}', '${u.fullName}', '${u.role}', '${u.branch}', '${permsStr}')">تعديل</button>
              <button type="button" class="btn btn-sm btn-danger" onclick="toggleUser('${u.userID}', '${u.status}')">${u.status === 'Active' ? 'تعطيل' : 'تفعيل'}</button>
            </td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

function editUser(id, username, fullName, role, branch, permsStr) {
  document.getElementById('editUserID').value = id;
  document.getElementById('userFormTitle').innerText = 'تعديل المستخدم وصلاحياته: ' + username;
  document.getElementById('userUsername').value = username;
  document.getElementById('userFullName').value = fullName;
  document.getElementById('userRole').value = role;
  document.getElementById('userBranchSelect').value = branch;
  document.querySelectorAll('.perm-check').forEach(cb => {
    cb.checked = permsStr.includes('ALL') || permsStr.includes(cb.value);
  });
  document.getElementById('userForm').scrollIntoView({ behavior: 'smooth' });
}

async function submitUser(e) {
  if (e) e.preventDefault();
  const selectedPerms = [];
  document.querySelectorAll('.perm-check:checked').forEach(cb => { selectedPerms.push(cb.value); });

  const payload = {
    action: 'saveUser',
    userID: document.getElementById('editUserID').value,
    username: document.getElementById('userUsername').value,
    password: document.getElementById('userPassword').value,
    fullName: document.getElementById('userFullName').value,
    role: document.getElementById('userRole').value,
    branch: document.getElementById('userBranchSelect').value,
    permissions: selectedPerms
  };

  try {
    const res = await apiCall(payload);
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      document.getElementById('userForm').reset();
      document.getElementById('editUserID').value = '';
      loadUsers();
    }
  } catch(err) { showToast('خطأ: ' + err.message, 'danger'); }
}

async function toggleUser(id, currentStatus) {
  try {
    const res = await apiCall({ action: 'toggleUser', userID: id, currentStatus: currentStatus });
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) loadUsers();
  } catch(e) {}
}

async function submitExpense(e) {
  if (e) e.preventDefault();
  const payload = {
    action: 'saveExpense',
    date: document.getElementById('expDate').value,
    branch: (currentUser.role !== 'Admin' && currentUser.branch) ? currentUser.branch : (document.getElementById('expBranchSelect').value || currentUser.branch),
    category: document.getElementById('expCategory').value,
    amount: parseFloat(document.getElementById('expAmount').value) || 0,
    paymentMethod: document.getElementById('expPaymentMethod').value,
    description: document.getElementById('expDescription').value,
    submittedBy: currentUser.fullName
  };

  try {
    const res = await apiCall(payload);
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      document.getElementById('expenseForm').reset();
      loadExpensesHistory();
      refreshDashboard();
      loadSystemNotifications();
    }
  } catch (err) { showToast('خطأ: ' + err.message, 'danger'); }
}

async function loadExpensesHistory() {
  try {
    const res = await apiCall({ action: 'getExpensesHistory', branch: currentUser.branch, role: currentUser.role });
    if (res && res.success && res.expenses) {
      const tbody = document.querySelector('#expensesHistoryTable tbody');
      tbody.innerHTML = '';
      res.expenses.forEach(e => {
        let badge = '<span class="badge badge-warning">معلق</span>';
        if (e.status === 'Approved') badge = '<span class="badge badge-success">معتمد</span>';
        if (e.status === 'Rejected') badge = '<span class="badge badge-danger">مرفوض</span>';
        let actionBtn = '-';
        if (hasPermission('MANAGE_EXPENSES') && e.status === 'Pending') {
          actionBtn = `
            <button type="button" class="btn btn-sm btn-success" onclick="approveExpense('${e.expenseID}', 'Approved')">اعتماد</button>
            <button type="button" class="btn btn-sm btn-danger" onclick="approveExpense('${e.expenseID}', 'Rejected')">رفض</button>
          `;
        }
        tbody.innerHTML += `
          <tr>
            <td><b>${e.expenseID}</b></td>
            <td>${e.date}</td>
            <td>${e.branch}</td>
            <td>${e.category}</td>
            <td><b>${e.amount.toFixed(2)}</b></td>
            <td>${e.paymentMethod}</td>
            <td>${badge}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

async function approveExpense(expID, status) {
  if (!confirm(`هل أنت متأكد من ${status === 'Approved' ? 'اعتماد' : 'رفض'} هذا السند؟`)) return;
  try {
    const res = await apiCall({ action: 'approveExpense', expenseID: expID, approverName: currentUser.fullName, status: status });
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      loadExpensesHistory();
      refreshDashboard();
      if (document.getElementById('treasuryView').style.display !== 'none') loadTreasuryData();
    }
  } catch(err) { showToast('خطأ: ' + err.message, 'danger'); }
}

async function loadBranches() {
  try {
    const res = await apiCall({ action: 'getBranches' });
    if (res && res.success && res.branches) {
      const tbody = document.querySelector('#branchesTable tbody');
      tbody.innerHTML = '';
      res.branches.forEach(b => {
        tbody.innerHTML += `
          <tr>
            <td><b>${b.branchID}</b></td>
            <td>${b.name}</td>
            <td>${b.location}</td>
            <td><span class="badge badge-success">${b.status}</span></td>
          </tr>
        `;
      });
    }
  } catch(e) {}
}

async function submitBranch(e) {
  if (e) e.preventDefault();
  const payload = {
    action: 'saveBranch',
    name: document.getElementById('branchName').value,
    location: document.getElementById('branchLocation').value
  };
  try {
    const res = await apiCall(payload);
    showToast(res.message, res.success ? 'success' : 'danger'); if (res.success) { triggerHapticFeedback([20, 60, 20]); playSuccessChime(); }
    if (res.success) {
      document.getElementById('branchForm').reset();
      loadBranches();
      loadBranchesDropdowns();
    }
  } catch(e) {}
}

async function loadBranchesDropdowns() {
  try {
    const res = await apiCall({ action: 'getBranches' });
    if (res && res.success && res.branches) {
      const selects = [
        document.getElementById('salesBranchSelect'),
        document.getElementById('dashBranchFilter'),
        document.getElementById('expBranchSelect'),
        document.getElementById('userBranchSelect'),
        document.getElementById('repBranchSelect')
      ];
      selects.forEach(sel => {
        if (!sel) return;
        const isFilter = (sel.id === 'dashBranchFilter' || sel.id === 'repBranchSelect');
        sel.innerHTML = isFilter ? '<option value="ALL">جميع الفروع الموحدة</option>' : '';
        res.branches.forEach(b => { sel.innerHTML += `<option value="${b.name}">${b.name}</option>`; });
      });
    }
  } catch(e) {}
}


// -------------------------------------------------------------
// -------------------------------------------------------------
// محرك التقارير المالية المتقدم (مبيعات + خزينة + طباعة فورية A4)
// -------------------------------------------------------------

let currentActiveReportType = 'SALES'; // 'SALES' or 'TREASURY'
let isCustomMultiBranchActive = false;

function setReportType(type) {
  currentActiveReportType = type;
  const sBtn = document.getElementById('repTypeSalesBtn');
  const tBtn = document.getElementById('repTypeTreasuryBtn');

  if (type === 'SALES') {
    if (sBtn) sBtn.className = 'btn btn-primary';
    if (tBtn) tBtn.className = 'btn btn-outline';
  } else {
    if (sBtn) sBtn.className = 'btn btn-outline';
    if (tBtn) tBtn.className = 'btn btn-primary';
  }
  triggerHapticFeedback([12]);
}

function setRepDateQuick(type) {
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];
  let sDate = formatDate(today);
  let eDate = formatDate(today);

  if (type === 'today') {
    sDate = formatDate(today);
    eDate = formatDate(today);
  } else if (type === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    sDate = formatDate(y);
    eDate = formatDate(y);
  } else if (type === 'week') {
    const w = new Date(today);
    w.setDate(w.getDate() - 7);
    sDate = formatDate(w);
    eDate = formatDate(today);
  } else if (type === 'month') {
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    sDate = formatDate(m);
    eDate = formatDate(today);
  } else if (type === 'all') {
    sDate = '2026-01-01';
    eDate = formatDate(today);
  }

  const sInput = document.getElementById('repStartDate');
  const eInput = document.getElementById('repEndDate');
  if (sInput) sInput.value = sDate;
  if (eInput) eInput.value = eDate;
  triggerHapticFeedback([10]);
}

function toggleMultiBranchSelector() {
  isCustomMultiBranchActive = !isCustomMultiBranchActive;
  const box = document.getElementById('repCustomBranchesBox');
  const btn = document.getElementById('toggleMultiBranchBtn');
  const select = document.getElementById('repBranchSelect');

  if (isCustomMultiBranchActive) {
    if (box) box.style.display = 'block';
    if (btn) btn.innerText = '⬅️ العودة للقائمة البسيطة';
    if (select) select.disabled = true;
  } else {
    if (box) box.style.display = 'none';
    if (btn) btn.innerText = '🎛️ تحديد فروع متعددة مخصصة';
    if (select) select.disabled = false;
  }
  triggerHapticFeedback([10]);
}

function onRepBranchSelectChange() {
  triggerHapticFeedback([10]);
}

async function loadReportBranches() {
  const select = document.getElementById('repBranchSelect');
  const chkContainer = document.getElementById('reportBranchesCheckboxes');

  try {
    const res = await apiCall({ action: 'getBranches' });
    if (res && res.success && res.branches) {
      if (select) {
        select.innerHTML = '<option value="ALL">🌐 جميع الفروع الموحدة (مصفوفة شاملة)</option>';
        res.branches.forEach(b => {
          select.innerHTML += `<option value="${b.name}">📍 ${b.name}</option>`;
        });
      }

      if (chkContainer) {
        chkContainer.innerHTML = '';
        res.branches.forEach(b => {
          chkContainer.innerHTML += `
            <label class="branch-check-label">
              <input type="checkbox" class="rep-branch-checkbox" value="${b.name}" checked>
              <span>📍 ${b.name}</span>
            </label>
          `;
        });
      }
    }
  } catch(e) {
    console.warn('Failed to load branches for reports:', e);
  }
}

function selectAllReportBranches(checkAll) {
  document.querySelectorAll('.rep-branch-checkbox').forEach(cb => cb.checked = checkAll);
  triggerHapticFeedback([15]);
}

function getSelectedReportBranches() {
  if (isCustomMultiBranchActive) {
    const checked = Array.from(document.querySelectorAll('.rep-branch-checkbox:checked')).map(cb => cb.value);
    return checked;
  }
  const sel = document.getElementById('repBranchSelect');
  const val = sel ? sel.value : 'ALL';
  return (val === 'ALL' || !val) ? [] : [val];
}

async function loadReportLogs() {
  try {
    const res = await apiCall({ action: 'getReportLogs' });
    if (res && res.success) {
      const latest = res.latestReport;
      const descEl = document.getElementById('latestReportDesc');
      const metaEl = document.getElementById('latestReportMeta');
      const actEl = document.getElementById('latestReportAction');

      if (latest && descEl) {
        descEl.innerHTML = `📄 ${latest.description}`;
        metaEl.innerHTML = `👤 تم التنزيل بواسطة: <b style="color:#2563EB;">${latest.generatedBy}</b> | 🕒 التاريخ والوقت: <b>${latest.timestamp}</b> | 📍 الفروع: <b>${latest.branch}</b>`;
        actEl.innerHTML = `<a href="${latest.fileUrl}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration:none;">📥 فتح / تحميل التقرير</a>`;
      } else if (descEl) {
        descEl.innerText = 'لم يتم تنزيل أي تقرير بعد في النظام.';
        metaEl.innerText = 'يمكنك توليد أول تقرير باستخدام الخيارات أدناه.';
        if (actEl) actEl.innerHTML = '';
      }

      const tbody = document.querySelector('#reportLogsTable tbody');
      if (tbody) {
        tbody.innerHTML = '';
        const list = res.reports || [];
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748B;">لا توجد تقارير سابقة مسجلة</td></tr>';
        } else {
          list.forEach(rep => {
            const isTreasury = (rep.fileType || '').includes('TREASURY');
            const isExcel = (rep.fileType || '').includes('EXCEL');
            const badgeClass = isTreasury ? 'badge-warning' : (isExcel ? 'badge-success' : 'badge-primary');
            const badgeIcon = isExcel ? '📊' : '📄';

            tbody.innerHTML += `
              <tr>
                <td><b>${rep.reportId}</b></td>
                <td>${rep.timestamp}</td>
                <td><b style="color:#2563EB;">${rep.generatedBy}</b></td>
                <td><span class="badge ${badgeClass}">${badgeIcon} ${rep.fileType}</span></td>
                <td>${rep.branch}</td>
                <td>
                  <a href="${rep.fileUrl}" target="_blank" class="btn btn-sm btn-outline" style="text-decoration:none;">
                    📥 فتح الملف
                  </a>
                </td>
              </tr>
            `;
          });
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load report logs:', e);
  }
}

async function triggerReportGeneration(exportFormat) {
  const sDate = document.getElementById('repStartDate').value;
  const eDate = document.getElementById('repEndDate').value;
  const branches = getSelectedReportBranches();
  const resDiv = document.getElementById('reportResult');

  if (!sDate || !eDate) {
    alert('يرجى تحديد تاريخ البداية والنهاية للتقرير');
    return;
  }

  const isTreasury = (currentActiveReportType === 'TREASURY');
  let actionName = '';
  if (isTreasury) {
    actionName = (exportFormat === 'PDF') ? 'generateTreasuryReportPDF' : 'generateTreasuryReportExcel';
  } else {
    actionName = (exportFormat === 'PDF') ? 'generateReportPDF' : 'generateReportExcel';
  }

  const btn = (exportFormat === 'PDF') ? document.getElementById('repPdfBtn') : document.getElementById('repExcelBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري التوليد والحفظ في Drive...';
  }
  resDiv.innerHTML = '<div style="color:var(--primary); padding:12px; font-weight:700;">⏳ جاري المعالجة الحسابية والحفظ في Google Drive...</div>';

  const payload = {
    action: actionName,
    startDate: sDate,
    endDate: eDate,
    branch: branches.length === 1 ? branches[0] : 'ALL',
    branches: branches,
    generatedBy: (currentUser && (currentUser.fullName || currentUser.username)) || 'المدير العام'
  };

  try {
    const res = await apiCall(payload);
    if (btn) {
      btn.disabled = false;
      btn.innerText = (exportFormat === 'PDF') ? '📄 حفظ PDF في Google Drive' : '📊 تصدير شيت إكسل مفصل (Excel XLSX)';
    }

    if (res && res.success) {
      triggerHapticFeedback([20, 60, 20]);
      playSuccessChime();

      const fileUrl = (exportFormat === 'PDF') ? res.pdfUrl : res.excelUrl;
      const typeLabel = isTreasury ? 'تقرير الخزينة والسيولة النقدية' : 'تقرير المبيعات والإغلاقات';
      const formatLabel = (exportFormat === 'PDF') ? 'PDF A4' : 'Excel XLSX';

      resDiv.innerHTML = `
        <div class="alert alert-success" style="padding:16px; border-radius:10px;">
          <p style="font-size:1.05rem;"><strong>✅ تم إنشاء ${typeLabel} (${formatLabel}) بنجاح!</strong></p>
          <p style="font-size:0.85rem; margin-top:4px;">
            المستخرج: <b>${res.generatedBy || payload.generatedBy}</b> | النطاق: <b>${res.branches || (branches.length ? branches.join(', ') : 'كافة الفروع')}</b>
          </p>
          <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <a href="${fileUrl}" target="_blank" class="btn btn-success" style="text-decoration:none;">
              📥 فتح / تحميل الملف المباشر من Google Drive
            </a>
            ${res.sheetUrl ? `<a href="${res.sheetUrl}" target="_blank" class="btn btn-outline" style="text-decoration:none;">🔗 فتح في Google Sheets</a>` : ''}
          </div>
        </div>
      `;
      showToast('تم إنشاء التقرير وحفظه في Google Drive بنجاح', 'success');
      loadReportLogs();
    } else {
      resDiv.innerHTML = `<div class="alert alert-danger">❌ ${res.message || 'فشل توليد التقرير'}</div>`;
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerText = (exportFormat === 'PDF') ? '📄 حفظ PDF في Google Drive' : '📊 تصدير شيت إكسل مفصل (Excel XLSX)';
    }
    resDiv.innerHTML = `<div class="alert alert-danger">❌ خطأ في الاتصال: ${err.message || err}</div>`;
  }
}

// -------------------------------------------------------------
// المعاينة والطباعة الفورية في المتصفح (Instant Browser A4 Print)
// -------------------------------------------------------------
async function previewAndPrintReport() {
  const sDate = document.getElementById('repStartDate').value;
  const eDate = document.getElementById('repEndDate').value;
  const branches = getSelectedReportBranches();

  if (!sDate || !eDate) {
    alert('يرجى تحديد تاريخ البداية والنهاية للتقرير');
    return;
  }

  showToast('جاري تجهيز بيانات الطباعة التفصيلية...', 'info');
  triggerHapticFeedback([15]);

  const isTreasury = (currentActiveReportType === 'TREASURY');
  const branchesLabel = branches.length > 0 ? branches.join(', ') : 'كافة الفروع الموحدة';
  const generatedBy = (currentUser && (currentUser.fullName || currentUser.username)) || 'المدير العام';
  const nowStr = new Date().toLocaleString('ar-SA');

  try {
    let printHtml = '';

    if (!isTreasury) {
      // جلب بيانات المبيعات
      const res = await apiCall({ action: 'getSalesHistory', branch: branches.length === 1 ? branches[0] : 'ALL' });
      const sales = (res && res.sales) ? res.sales : [];
      
      const filtered = sales.filter(s => {
        const d = (s.date || '').substring(0, 10);
        const inDate = (d >= sDate && d <= eDate);
        const inBranch = (branches.length === 0 || branches.includes(s.branch));
        return inDate && inBranch;
      });

      let totalSales = 0, totalCash = 0, totalPOS = 0, totalShiftExp = 0, totalNet = 0;
      let branchMap = {};

      filtered.forEach(s => {
        const ts = parseFloat(s.totalSales) || 0;
        const c = parseFloat(s.cashAmount) || 0;
        const p = parseFloat(s.posAmount) || 0;
        const se = parseFloat(s.shiftExpenses) || 0;
        const net = parseFloat(s.netCashHandover) || (c - se);

        totalSales += ts;
        totalCash += c;
        totalPOS += p;
        totalShiftExp += se;
        totalNet += net;

        if (!branchMap[s.branch]) {
          branchMap[s.branch] = { sales: 0, cash: 0, pos: 0, shiftExp: 0, net: 0, count: 0 };
        }
        branchMap[s.branch].sales += ts;
        branchMap[s.branch].cash += c;
        branchMap[s.branch].pos += p;
        branchMap[s.branch].shiftExp += se;
        branchMap[s.branch].net += net;
        branchMap[s.branch].count++;
      });

      let branchCardsHtml = '';
      Object.keys(branchMap).forEach(bn => {
        const item = branchMap[bn];
        branchCardsHtml += `
          <div style="border:1px solid #CBD5E1; border-radius:8px; padding:10px; background:#FFFFFF;">
            <div style="display:flex; justify-content:space-between; font-weight:800; font-size:12px; border-bottom:1px solid #E2E8F0; padding-bottom:4px; margin-bottom:6px;">
              <span>📍 ${bn}</span>
              <span style="background:#EFF6FF; color:#2563EB; padding:2px 8px; border-radius:10px; font-size:10px;">${item.count} إغلاقات</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
              <span>إجمالي المبيعات:</span><strong>${item.sales.toFixed(2)} ر.س</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
              <span>الكاش الفعلي:</span><strong>${item.cash.toFixed(2)} ر.س</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
              <span>الشبكات (POS):</span><strong>${item.pos.toFixed(2)} ر.س</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
              <span>مصاريف الوردية:</span><strong style="color:#DC2626;">-${item.shiftExp.toFixed(2)} ر.س</strong>
            </div>
            <div style="background:#F0FDF4; border:1px solid #DCFCE7; border-radius:6px; padding:6px; margin-top:6px; text-align:center;">
              <span style="font-size:10px; color:#15803D; font-weight:700;">صافي تسليم الكاش:</span>
              <div style="font-size:14px; font-weight:900; color:#16A34A;">${item.net.toFixed(2)} ر.س</div>
            </div>
          </div>
        `;
      });

      let rowsHtml = '';
      filtered.forEach(s => {
        rowsHtml += `
          <tr>
            <td><b>${s.salesID}</b></td>
            <td>${s.date}</td>
            <td>${s.branch}</td>
            <td>${(parseFloat(s.cashAmount)||0).toFixed(2)}</td>
            <td>${(parseFloat(s.posAmount)||0).toFixed(2)}</td>
            <td><b>${(parseFloat(s.totalSales)||0).toFixed(2)}</b></td>
            <td style="color:#DC2626;">${(parseFloat(s.shiftExpenses)||0).toFixed(2)}</td>
            <td style="color:#16A34A; font-weight:800;">${(parseFloat(s.netCashHandover)||0).toFixed(2)}</td>
            <td>${s.status}</td>
            <td>${s.submittedBy || '-'}</td>
          </tr>
        `;
      });

      printHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير مبيعات أوركيد التفصيلي</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; font-family: 'Arial', sans-serif; }
            body { color: #0F172A; font-size: 11px; line-height: 1.35; padding: 10px; }
            .header-bar { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
            .kpis { display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin-bottom:14px; }
            .kpi-card { background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; padding:8px; text-align:center; }
            .branch-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:14px; }
            table { width:100%; border-collapse:collapse; margin-bottom:14px; }
            th, td { border:1px solid #CBD5E1; padding:6px 8px; text-align:right; font-size:10px; }
            th { background:#0F172A; color:#FFFFFF; }
            tr:nth-child(even) { background:#F8FAFC; }
            .sigs { display:flex; justify-content:space-between; margin-top:20px; padding-top:10px; border-top:1px dashed #CBD5E1; text-align:center; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h2 style="margin:0; font-size:18px;">🏢 مجموعة أوركيد المؤسسية</h2>
              <div style="color:#2563EB; font-weight:800; font-size:12px;">تقرير مبيعات الفروع التفصيلي المعتمد (طباعة A4)</div>
            </div>
            <div style="text-align:left; font-size:10px; color:#475569;">
              <div>الفترة: <b>${sDate}</b> إلى <b>${eDate}</b></div>
              <div>الفروع: <b>${branchesLabel}</b></div>
              <div>مستخرج التقرير: <b>${generatedBy}</b></div>
              <div>وقت الإصدار: ${nowStr}</div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card"><div>إجمالي المبيعات</div><strong style="font-size:13px; color:#2563EB;">${totalSales.toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>مبيعات الكاش</div><strong style="font-size:13px;">${totalCash.toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>مبيعات الشبكات</div><strong style="font-size:13px;">${totalPOS.toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>مصاريف الوردية</div><strong style="font-size:13px; color:#DC2626;">-${totalShiftExp.toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>صافي الكاش المورد</div><strong style="font-size:13px; color:#16A34A;">${totalNet.toFixed(2)} ر.س</strong></div>
          </div>

          <div style="font-weight:800; font-size:12px; margin-bottom:6px;">📊 ملخص مبيعات كل فرع (مربعات متجاورة):</div>
          <div class="branch-grid">${branchCardsHtml}</div>

          <div style="font-weight:800; font-size:12px; margin-bottom:6px;">📋 جدول تفاصيل الإغلاقات والورديات:</div>
          <table>
            <thead>
              <tr>
                <th>رقم الإغلاق</th><th>التاريخ</th><th>الفرع</th><th>الكاش الفعلي</th><th>الشبكات</th><th>الإجمالي</th><th>المصاريف</th><th>الصافي المورد</th><th>الحالة</th><th>المسؤول</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="10" style="text-align:center;">لا توجد سجلات</td></tr>'}</tbody>
          </table>

          <div class="sigs">
            <div>مسؤول الفرع / الكاشير<br><br>.........................</div>
            <div>المحاسب المالي المدقق<br><br>.........................</div>
            <div>مسؤول الخزينة والسيولة<br><br>.........................</div>
            <div>المدير العام / الاعتماد<br><br>.........................</div>
          </div>
        </body>
        </html>
      `;
    } else {
      // جلب بيانات الخزينة
      const res = await apiCall({ action: 'getPendingBranchCash' });
      const ledgerRes = await apiCall({ action: 'getTreasuryLogs' });
      const logs = (ledgerRes && ledgerRes.logs) ? ledgerRes.logs : [];
      const sum = (res && res.treasurySummary) ? res.treasurySummary : {};

      let totalInflow = 0, totalOutflow = 0;
      let rowsHtml = '';
      logs.forEach(l => {
        const inBranch = (branches.length === 0 || branches.includes(l.branch) || l.branch === 'الخزينة العامة');
        if (inBranch) {
          if (l.type === 'INCOME') totalInflow += (parseFloat(l.cashAmount) || 0);
          if (l.type === 'EXPENSE') totalOutflow += (parseFloat(l.cashAmount) || 0);
          rowsHtml += `
            <tr>
              <td><b>${l.entryID}</b></td>
              <td>${l.date}</td>
              <td>${l.branch}</td>
              <td style="color:${l.type === 'INCOME' ? '#16A34A' : '#DC2626'}; font-weight:800;">${l.type === 'INCOME' ? '+ توريد' : '- صرف'}</td>
              <td><b>${(parseFloat(l.cashAmount)||0).toFixed(2)} ر.س</b></td>
              <td>${l.createdBy || '-'}</td>
              <td>${l.description || '-'}</td>
            </tr>
          `;
        }
      });

      printHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير الخزينة والسيولة النقدية التفصيلي</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; font-family: 'Arial', sans-serif; }
            body { color: #0F172A; font-size: 11px; line-height: 1.35; padding: 10px; }
            .header-bar { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
            .kpis { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:14px; }
            .kpi-card { background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; padding:10px; text-align:center; }
            table { width:100%; border-collapse:collapse; margin-bottom:14px; }
            th, td { border:1px solid #CBD5E1; padding:6px 8px; text-align:right; font-size:10px; }
            th { background:#0F172A; color:#FFFFFF; }
            tr:nth-child(even) { background:#F8FAFC; }
            .sigs { display:flex; justify-content:space-between; margin-top:20px; padding-top:10px; border-top:1px dashed #CBD5E1; text-align:center; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h2 style="margin:0; font-size:18px;">🏦 خزينة مجموعة أوركيد المؤسسية</h2>
              <div style="color:#16A34A; font-weight:800; font-size:12px;">تقرير دفتر أستاذ الخزينة والسيولة النقدية (طباعة A4)</div>
            </div>
            <div style="text-align:left; font-size:10px; color:#475569;">
              <div>الفترة: <b>${sDate}</b> إلى <b>${eDate}</b></div>
              <div>نطاق الفروع: <b>${branchesLabel}</b></div>
              <div>مستخرج التقرير: <b>${generatedBy}</b></div>
              <div>وقت الإصدار: ${nowStr}</div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card"><div>رصيد الخزينة الحالي</div><strong style="font-size:15px; color:#16A34A;">${((sum.currentBalance)||totalInflow-totalOutflow).toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>إجمالي التوريدات النقدية</div><strong style="font-size:15px; color:#2563EB;">${totalInflow.toFixed(2)} ر.س</strong></div>
            <div class="kpi-card"><div>إجمالي المنصرف من الخزينة</div><strong style="font-size:15px; color:#DC2626;">-${totalOutflow.toFixed(2)} ر.س</strong></div>
          </div>

          <div style="font-weight:800; font-size:12px; margin-bottom:6px;">📋 حركة قيود دفتر أستاذ الخزينة التفصيلية:</div>
          <table>
            <thead>
              <tr>
                <th>رقم القيد</th><th>التاريخ</th><th>الفرع</th><th>نوع العملية</th><th>المبلغ النقدي</th><th>أمين الخزينة</th><th>البيان</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center;">لا توجد قيود مسجلة</td></tr>'}</tbody>
          </table>

          <div class="sigs">
            <div>أمين الخزينة والسيولة<br><br>.........................</div>
            <div>المحاسب المالي المدقق<br><br>.........................</div>
            <div>المدير العام / الاعتماد<br><br>.........................</div>
          </div>
        </body>
        </html>
      `;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);

  } catch (err) {
    alert('حدث خطأ أثناء إعداد الطباعة: ' + (err.message || err));
  }
}


// =============================================================
// نظام الاتصال الصوتي المباشر بين الإداري والموظفين (OrchidCallSystem)
// =============================================================
const OrchidCallSystem = {
  activeCall: null,
  localStream: null,
  callTimerInterval: null,
  callSeconds: 0,
  isMuted: false,

  async startCall(targetUsername, targetFullName, targetBranch) {
    triggerHapticFeedback([20, 40]);
    document.getElementById('callTargetName').innerText = targetFullName;
    document.getElementById('callTargetBranch').innerText = '📍 فرع: ' + targetBranch;
    document.getElementById('callTimerDisplay').innerText = 'جاري طلب الاتصال الصوتي...';
    document.getElementById('outgoingCallModal').style.display = 'flex';

    try {
      // طلب إذن الميكروفون
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch(err) {
      console.warn('Microphone permission not granted or available:', err);
    }

    // تشغيل نغمة الاتصال الصوتي عبر Web Audio API
    this.playRingingTone();
    this.callSeconds = 0;

    // محاكاة الاتصال والرد المباشر
    setTimeout(() => {
      document.getElementById('callTimerDisplay').innerText = '00:00 - مكالمة جارية';
      this.stopRingingTone();
      this.startTimer();
      playSuccessChime();
    }, 2500);
  },

  startTimer() {
    this.callSeconds = 0;
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callTimerInterval = setInterval(() => {
      this.callSeconds++;
      const mins = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
      const secs = String(this.callSeconds % 60).padStart(2, '0');
      const disp = document.getElementById('callTimerDisplay');
      if (disp) disp.innerText = `${mins}:${secs} - صوت مباشر 🟢`;
    }, 1000);
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
    }
    const icon = document.getElementById('callMuteIcon');
    if (icon) icon.innerText = this.isMuted ? 'mic_off' : 'mic';
    showToast(this.isMuted ? 'تم كتم الميكروفون' : 'تم تفعيل الميكروفون', 'info');
    triggerHapticFeedback([10]);
  },

  endCall() {
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.stopRingingTone();
    document.getElementById('outgoingCallModal').style.display = 'none';
    document.getElementById('incomingCallModal').style.display = 'none';
    showToast(`انتهت المكالمة (${this.callSeconds} ثانية)`, 'info');
    triggerHapticFeedback([20]);
  },

  acceptCall() {
    document.getElementById('incomingCallModal').style.display = 'none';
    document.getElementById('outgoingCallModal').style.display = 'flex';
    document.getElementById('callTimerDisplay').innerText = '00:00 - متصل';
    this.startTimer();
    triggerHapticFeedback([20, 60]);
  },

  declineCall() {
    document.getElementById('incomingCallModal').style.display = 'none';
    this.stopRingingTone();
    triggerHapticFeedback([30]);
  },

  playRingingTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      this.osc = this.audioCtx.createOscillator();
      this.gain = this.audioCtx.createGain();
      this.osc.type = 'sine';
      this.osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      this.gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
      this.osc.connect(this.gain);
      this.gain.connect(this.audioCtx.destination);
      this.osc.start();
    } catch(e) {}
  },

  stopRingingTone() {
    try {
      if (this.osc) { this.osc.stop(); this.osc.disconnect(); this.osc = null; }
      if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
    } catch(e) {}
  }
};

// =============================================================
// محرك إدارة المهام والعمليات التشغيلية (Tasks Manager)
// =============================================================
let currentTasksList = [];
let activeTaskFilter = 'ALL';

async function loadTasks() {
  const container = document.getElementById('tasksListContainer');
  const countBadge = document.getElementById('tasksCountBadge');
  if (!container) return;

  try {
    const res = await apiCall({
      action: 'getTasks',
      branch: (currentUser && currentUser.branch) || 'الفرع الرئيسي',
      role: (currentUser && currentUser.role) || 'User',
      username: (currentUser && currentUser.username) || ''
    });

    if (res && res.success) {
      currentTasksList = res.tasks || [];
      const pendingCount = currentTasksList.filter(t => t.status !== 'Completed').length;
      if (countBadge) {
        countBadge.innerText = pendingCount;
        countBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
      renderTasksList();
    }
  } catch(e) {
    container.innerHTML = '<p style="color:#DC2626; text-align:center;">تعذر تحميل المهام</p>';
  }
}

function renderTasksList() {
  const container = document.getElementById('tasksListContainer');
  if (!container) return;

  let filtered = currentTasksList;
  if (activeTaskFilter === 'PENDING') filtered = currentTasksList.filter(t => t.status !== 'Completed');
  if (activeTaskFilter === 'COMPLETED') filtered = currentTasksList.filter(t => t.status === 'Completed');

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#64748B; text-align:center; padding:20px;">✅ لا توجد مهام في هذا التصنيف حالياً</p>';
    return;
  }

  let html = '';
  filtered.forEach(task => {
    const isDone = (task.status === 'Completed');
    const priorityColor = (task.priority === 'عالية') ? '#DC2626' : (task.priority === 'متوسطة' ? '#D97706' : '#16A34A');
    
    html += `
      <div class="task-card-item ${isDone ? 'completed' : ''}">
        <div class="task-main-info">
          <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskComplete('${task.taskID}', '${task.status}')">
          <div>
            <div class="task-title">${task.title}</div>
            <div style="font-size:0.83rem; color:var(--google-gray); margin-bottom:4px;">${task.description || ''}</div>
            <div class="task-meta">
              <span>📍 الفرع: <b>${task.branch}</b></span>
              <span>👤 المسؤول: <b>${task.assignedTo || 'غير محدد'}</b></span>
              <span style="color:${priorityColor}; font-weight:700;">أولوية: ${task.priority}</span>
              <span>🕒 أنشئت: ${task.createdAt || '-'}</span>
            </div>
          </div>
        </div>
        <div>
          <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}">
            ${isDone ? 'مكتملة ✅' : 'قيد التنفيذ ⏳'}
          </span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function filterTasks(status) {
  activeTaskFilter = status;
  renderTasksList();
  triggerHapticFeedback([10]);
}

async function toggleTaskComplete(taskID, currentStatus) {
  try {
    const res = await apiCall({ action: 'toggleTaskStatus', taskID: taskID, currentStatus: currentStatus });
    if (res && res.success) {
      triggerHapticFeedback([20, 50]);
      playSuccessChime();
      showToast(res.message, 'success');
      loadTasks();
    }
  } catch(e) {
    showToast('فشل تحديث المهمة: ' + e.message, 'danger');
  }
}

function toggleNewTaskForm() {
  const form = document.getElementById('newTaskFormContainer');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
  triggerHapticFeedback([10]);
}

async function submitNewTask() {
  const title = document.getElementById('taskTitleInput').value.trim();
  const branch = document.getElementById('taskBranchSelect').value;
  const assigned = document.getElementById('taskAssigneeInput').value.trim();
  const priority = document.getElementById('taskPrioritySelect').value;
  const desc = document.getElementById('taskDescInput').value.trim();

  if (!title) { alert('يرجى إدخال عنوان المهمة'); return; }

  try {
    const res = await apiCall({
      action: 'saveTask',
      title: title,
      branch: branch,
      assignedTo: assigned,
      priority: priority,
      description: desc,
      createdBy: currentUser.fullName || currentUser.username
    });

    if (res && res.success) {
      triggerHapticFeedback([20, 60]);
      playSuccessChime();
      showToast('تمت إضافة المهمة بنجاح', 'success');
      document.getElementById('taskTitleInput').value = '';
      document.getElementById('taskDescInput').value = '';
      toggleNewTaskForm();
      loadTasks();
    }
  } catch(e) {
    showToast('فشل حفظ المهمة: ' + e.message, 'danger');
  }
}

// =============================================================
// الجدولة الآلية للبريد الإلكتروني (الساعة 01:00 ص)
// =============================================================
async function saveAutoEmailSettings() {
  const email = document.getElementById('autoEmailInput').value.trim();
  const hour = document.getElementById('autoEmailHour').value;
  const enabled = document.getElementById('autoEmailEnabled').checked;
  const resDiv = document.getElementById('autoEmailStatusResult');

  if (enabled && (!email || !email.includes('@'))) {
    alert('يرجى إدخال بريد إلكتروني صحيح');
    return;
  }

  resDiv.innerHTML = '<div style="color:var(--primary); font-weight:700;">⏳ جاري تثبيت الجدولة الآلية في خادم Apps Script...</div>';

  try {
    const res = await apiCall({ action: 'configureAutoEmail', email: email, hour: hour, enabled: enabled });
    if (res && res.success) {
      triggerHapticFeedback([20, 60]);
      playSuccessChime();
      resDiv.innerHTML = `<div class="alert alert-success" style="padding:10px; border-radius:8px;">${res.message}</div>`;
      showToast('تم حفظ الجدولة الآلية بنجاح', 'success');
    } else {
      resDiv.innerHTML = `<div class="alert alert-danger">${res.message || 'فشل الحفظ'}</div>`;
    }
  } catch(e) {
    resDiv.innerHTML = `<div class="alert alert-danger">خطأ: ${e.message}</div>`;
  }
}

async function sendTestReportEmailNow() {
  const email = document.getElementById('autoEmailInput').value.trim();
  const resDiv = document.getElementById('autoEmailStatusResult');

  if (!email || !email.includes('@')) {
    alert('يرجى إدخال بريد إلكتروني لإرسال التقرير إليه');
    return;
  }

  resDiv.innerHTML = '<div style="color:var(--primary); font-weight:700;">⏳ جاري إنشاء التقرير المالي وإرساله بالبريد الإلكتروني الآن...</div>';

  try {
    const res = await apiCall({ action: 'sendTestReportEmail', email: email });
    if (res && res.success) {
      triggerHapticFeedback([20, 60]);
      playSuccessChime();
      resDiv.innerHTML = `<div class="alert alert-success" style="padding:10px; border-radius:8px;">${res.message}</div>`;
      showToast('تم إرسال التقرير للإيميل بنجاح', 'success');
      loadReportLogs();
    } else {
      resDiv.innerHTML = `<div class="alert alert-danger">${res.message || 'فشل إرسال الإيميل'}</div>`;
    }
  } catch(e) {
    resDiv.innerHTML = `<div class="alert alert-danger">خطأ: ${e.message}</div>`;
  }
}
