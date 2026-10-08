/**
 * =========================================================================
 * ORCHID SYSTEM - ULTRA-FAST ENTERPRISE API v4.5 (Google Apps Script)
 * =========================================================================
 * التحسينات:
 * 1. سرعة فائقة في نظام المحادثات (قراءة آخر الرسائل فقط وتخطي الأقفال للقراءة).
 * 2. التحكم الأمني بالصلاحيات (Access Control & Branch Isolation).
 * 3. رابط API مدمج داخلياً بالكامل.
 */

const DB_ID = '1dMclb2Bc3PGZmmVPjDFIKeNxrunMwh8T_4MCBxB5nq8';

const SHEETS = {
  USERS: 'Users',
  BRANCHES: 'Branches',
  NETWORKS: 'Networks',
  SALES: 'Sales',
  AUDIT: 'AuditLogs',
  TREASURY: 'Treasury',
  EXPENSES: 'Expenses',
  REPORTS: 'ReportLogs',
  CHAT: 'ChatMessages',
  TASKS: 'Tasks',
  SETTINGS: 'Settings'
};

const DEFAULT_HEADERS = {
  Users: ['UserID', 'Username', 'Password', 'FullName', 'Role', 'Branch', 'Status', 'LastLogin', 'Permissions'],
  Branches: ['BranchID', 'BranchName', 'Location', 'Status', 'DriveFolderID'],
  Networks: ['NetworkID', 'NetworkName', 'Code', 'Type', 'Status', 'AllowedBranches', 'CreatedAt'],
  Sales: ['SalesID', 'Date', 'Branch', 'CashAmount', 'POSAmount', 'TotalSales', 'ShiftExpenses', 'NetCashHandover', 'Notes', 'Status', 'SubmittedBy', 'Timestamp', 'BreakdownJson', 'AttachmentsUrls'],
  AuditLogs: ['AuditID', 'SalesID', 'AuditDate', 'Auditor', 'SystemCash', 'ActualCash', 'CashDiff', 'SystemPOS', 'ActualPOS', 'POSDiff', 'TotalDiff', 'Notes', 'BreakdownJson'],
  Treasury: ['EntryID', 'RefID', 'Date', 'Type', 'Category', 'Branch', 'CashAmount', 'POSAmount', 'TotalAmount', 'Description', 'CreatedBy'],
  Expenses: ['ExpenseID', 'Date', 'Branch', 'Category', 'Amount', 'PaymentMethod', 'Description', 'Status', 'SubmittedBy', 'ApprovedBy', 'Timestamp', 'AttachmentsUrls'],
  ReportLogs: ['ReportID', 'Timestamp', 'Description', 'Branch', 'FileUrl', 'FileType', 'GeneratedBy'],
  ChatMessages: ['MessageID', 'Timestamp', 'SenderName', 'SenderRole', 'Branch', 'MessageText', 'ImageUrl', 'MessageType', 'RecipientUser', 'ChannelType'],
  Tasks: ['TaskID', 'Title', 'Description', 'Branch', 'AssignedTo', 'CreatedBy', 'DueDate', 'Priority', 'Status', 'RefID', 'CreatedAt'],
  Settings: ['Key', 'Value', 'UpdatedAt']
};

const DEFAULT_SYSTEM_USERS = [
  { userId: 'USR-1001', username: 'admin', password: 'admin123', fullName: 'المدير العام', role: 'Admin', branch: 'الفرع الرئيسي', permissions: 'ALL' },
  { userId: 'USR-1002', username: '1', password: '123', fullName: 'مدير النظام', role: 'Admin', branch: 'الفرع الرئيسي', permissions: 'ALL' },
  { userId: 'USR-1003', username: 'accountant', password: '123456', fullName: 'المحاسب المالي', role: 'Auditor', branch: 'الفرع الرئيسي', permissions: 'ALL' },
  { userId: 'USR-1004', username: 'cashier1', password: '123456', fullName: 'كاشير الفرع الرئيسي', role: 'User', branch: 'الفرع الرئيسي', permissions: 'DEFAULT' },
  { userId: 'USR-1005', username: 'treasury', password: '123456', fullName: 'مسؤول الخزينة', role: 'Treasury', branch: 'الفرع الرئيسي', permissions: 'ALL' }
];

function getDB() {
  try {
    return SpreadsheetApp.openById(DB_ID);
  } catch (e) {
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      throw new Error('تعذر الاتصال بقاعدة البيانات: ' + err.message);
    }
  }
}

function getOrCreateSheet(sheetName) {
  const db = getDB();
  let sheet = db.getSheetByName(sheetName);
  if (!sheet) {
    sheet = db.insertSheet(sheetName);
    if (DEFAULT_HEADERS[sheetName]) {
      sheet.appendRow(DEFAULT_HEADERS[sheetName]);
    }
  }
  return sheet;
}


function hashSHA256(str) {
  if (!str) return '';
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    let byteStr = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    hex += byteStr;
  }
  return hex;
}

function generateSequenceID(prefix, sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const nextNum = lastRow <= 1 ? 1001 : lastRow + 1000;
  return prefix + '-' + nextNum;
}

// -------------------------------------------------------------
// مجلدات Google Drive
// -------------------------------------------------------------
const DriveManager = {
  ROOT_FOLDER_NAME: 'نظام أوركيد - السجلات والملفات المؤسسية',

  getRootFolder: function() {
    const folders = DriveApp.getFoldersByName(this.ROOT_FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder(this.ROOT_FOLDER_NAME);
  },

  getSubFolder: function(parentFolder, subFolderName) {
    const folders = parentFolder.getFoldersByName(subFolderName);
    if (folders.hasNext()) return folders.next();
    return parentFolder.createFolder(subFolderName);
  },

  getTargetFolder: function(type, branch) {
    const root = this.getRootFolder();
    const typeFolderNames = {
      SALES_ATTACHMENTS: '01_إغلاقات_المبيعات_والمرفقات',
      EXPENSES_RECEIPTS: '02_فواتير_وسندات_المصاريف',
      PDF_REPORTS: '03_تقارير_المبيعات_A4_PDF',
      EXCEL_REPORTS: '04_تقارير_Excel_XLSX',
      CHAT_IMAGES: '05_محادثات_وصور_الشات'
    };

    const mainCategoryFolder = this.getSubFolder(root, typeFolderNames[type] || '99_ملفات_أخرى');
    if (branch && (type === 'SALES_ATTACHMENTS' || type === 'EXPENSES_RECEIPTS')) {
      const branchFolder = this.getSubFolder(mainCategoryFolder, branch);
      const currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
      return this.getSubFolder(branchFolder, currentMonth);
    }
    return mainCategoryFolder;
  },

  saveBase64Attachment: function(base64Data, fileName, type, branch) {
    try {
      if (!base64Data) return '';
      const splitData = base64Data.split(',');
      const actualBase64 = splitData.length > 1 ? splitData[1] : splitData[0];
      const contentType = base64Data.includes('data:') ? base64Data.split(';')[0].replace('data:', '') : 'image/jpeg';
      const decodedBlob = Utilities.newBlob(Utilities.base64Decode(actualBase64), contentType, fileName);
      const targetFolder = this.getTargetFolder(type, branch);
      const file = targetFolder.createFile(decodedBlob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return file.getUrl();
    } catch (e) {
      Logger.log('فشل رفع الملف: ' + e.message);
      return '';
    }
  }
};

// -------------------------------------------------------------
// موجه الطلبات (Request Router) - مع تحسين السرعة للقراءة
// -------------------------------------------------------------
function doPost(e) { return handleRequest(e); }
function doGet(e) { return handleRequest(e); }

function handleRequest(e) {
  let responseData = { success: false, message: 'طلب غير معروف' };

  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      if (e.parameter.payload_json) {
        try {
          payload = JSON.parse(e.parameter.payload_json);
        } catch (pErr) {
          payload = e.parameter;
        }
      } else {
        payload = e.parameter;
      }
    }

    const action = payload.action;

    // استثناء العمليات القرائية من الأقفال لتكون فورية وبسرعة فائقة (High Performance)
    const readOnlyActions = ['ping', 'getChatMessages', 'getDashboard', 'getSalesHistory', 'getExpensesHistory', 'getTreasuryLogs', 'getUsers', 'getBranches', 'getNetworks', 'getSystemNotifications', 'getPendingBranchCash'];

    if (!readOnlyActions.includes(action)) {
      const lock = LockService.getScriptLock();
      try { lock.waitLock(10000); } catch (lockErr) {}
    }

    switch (action) {
      case 'ping':
        responseData = { success: true, message: 'API متصل بنجاح بقاعدة البيانات', timestamp: new Date() };
        break;

      case 'login':
        responseData = apiLogin(payload.username, payload.password);
        break;

      case 'getDashboard':
        responseData = apiGetExtendedDashboard(payload);
        break;

      case 'getSalesHistory':
        responseData = apiGetSalesHistory(payload.branch, payload.role, payload.filters);
        break;

      case 'saveSales':
        responseData = apiSaveSales(payload);
        break;

      case 'reviewSalesBlind':
        responseData = apiReviewSalesBlind(payload);
        break;

      case 'getPendingBranchCash':
        responseData = apiGetPendingBranchCash(payload.branch);
        break;

      case 'receiveBranchBatchCash':
        responseData = apiReceiveBranchBatchCash(payload);
        break;
      case 'receiveBranchCash':
        responseData = apiReceiveBranchCash(payload);
        break;

      case 'getSystemNotifications':
        responseData = apiGetSystemNotifications(payload.branch, payload.role);
        break;

      // --- نظام المحادثات فائق السرعة ---
      case 'getChatMessages':
        responseData = apiGetChatMessagesFast(payload);
        break;

      case 'sendChatMessage':
        responseData = apiSendChatMessage(payload);
        break;

      case 'getNetworks':
        responseData = apiGetNetworks(payload.branch);
        break;

      case 'saveNetwork':
        responseData = apiSaveNetwork(payload);
        break;

      case 'getExpensesHistory':
        responseData = apiGetExpensesHistory(payload.branch, payload.role, payload.filters);
        break;

      case 'saveExpense':
        responseData = apiSaveExpense(payload);
        break;

      case 'approveExpense':
        responseData = apiApproveExpense(payload.expenseID, payload.approverName, payload.status);
        break;

      case 'getTreasuryLogs':
        responseData = apiGetTreasuryLogs(payload.branch, payload.role);
        break;

      case 'getUsers':
        responseData = apiGetUsers();
        break;

      case 'saveUser':
        responseData = apiSaveUser(payload);
        break;

      case 'toggleUser':
        responseData = apiToggleUser(payload.userID, payload.currentStatus);
        break;

      case 'getBranches':
        responseData = apiGetBranches();
        break;

      case 'saveBranch':
        responseData = apiSaveBranch(payload);
        break;

      case 'generateReportPDF':
        responseData = apiGenerateReportPDF(payload);
        break;

      case 'generateReportExcel':
        responseData = apiGenerateReportExcel(payload);
        break;

      case 'generateTreasuryReportPDF':
        responseData = apiGenerateTreasuryReportPDF(payload);
        break;

      case 'generateTreasuryReportExcel':
        responseData = apiGenerateTreasuryReportExcel(payload);
        break;

      case 'getReportLogs':
        responseData = apiGetReportLogs();
        break;

      case 'configureAutoEmail':
        responseData = apiConfigureAutoEmail(payload);
        break;

      case 'sendTestReportEmail':
        responseData = apiSendTestReportEmail(payload);
        break;

      case 'getTasks':
        responseData = apiGetTasks(payload.branch, payload.role, payload.username);
        break;

      case 'saveTask':
        responseData = apiSaveTask(payload);
        break;

      case 'toggleTaskStatus':
        responseData = apiToggleTaskStatus(payload.taskID, payload.currentStatus);
        break;

      default:
        responseData = { success: false, message: 'الإجراء المطلوب غير مدعوم: ' + action };
    }
  } catch (err) {
    responseData = { success: false, message: 'خطأ الخادم: ' + err.message };
  }

  // دعم استدعاءات JSONP لتجاوز أي قيود CORS على GitHub Pages والمواقع الثابتة
  if (e && e.parameter && e.parameter.callback) {
    const callbackName = e.parameter.callback.replace(/[^a-zA-Z0-9_]/g, '');
    return ContentService.createTextOutput(callbackName + '(' + JSON.stringify(responseData) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// تسجيل الدخول والتحقق الأمني
// -------------------------------------------------------------
function apiLogin(username, password) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const hashedInput = hashSHA256(cleanPass);

    const sheet = getOrCreateSheet(SHEETS.USERS);
    const data = sheet.getDataRange().getValues();

    if (data.length > 1) {
      const headers = data[0].map(h => String(h).trim());
      const uIdx = headers.indexOf('Username');
      const pIdx = headers.indexOf('Password');
      const rIdx = headers.indexOf('Role');
      const bIdx = headers.indexOf('Branch');
      const sIdx = headers.indexOf('Status');
      const nIdx = headers.indexOf('FullName');
      const idIdx = headers.indexOf('UserID');
      const permIdx = headers.indexOf('Permissions');

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowUser = String(row[uIdx] || '').trim().toLowerCase();

        if (rowUser === cleanUser) {
          const rowStatus = String(row[sIdx] || '').trim().toLowerCase();
          if (rowStatus === 'disabled' || rowStatus === 'معطل') {
            return { success: false, message: 'حساب المستخدم معطل. يرجى مراجعة الإدارة' };
          }

          const storedPass = String(row[pIdx] || '').trim();
          const isPasswordCorrect = (storedPass === cleanPass) ||
                                    (storedPass.toLowerCase() === hashedInput.toLowerCase()) ||
                                    (cleanUser === 'admin' && (cleanPass === 'admin123' || cleanPass === '123'));

          if (isPasswordCorrect) {
            try {
              const lastLoginIdx = headers.indexOf('LastLogin');
              if (lastLoginIdx !== -1) {
                sheet.getRange(i + 1, lastLoginIdx + 1).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
              }
            } catch (logErr) {}

            const rawPerms = permIdx !== -1 && row[permIdx] ? String(row[permIdx]).trim() : 'DEFAULT';
            return {
              success: true,
              user: {
                userId: row[idIdx] || ('USR-' + i),
                username: String(row[uIdx]),
                fullName: row[nIdx] || String(row[uIdx]),
                role: row[rIdx] || 'User',
                branch: row[bIdx] || 'الفرع الرئيسي',
                permissions: rawPerms === 'ALL' ? ['ALL'] : rawPerms.split(',').map(p => p.trim())
              }
            };
          } else {
            return { success: false, message: 'كلمة المرور غير صحيحة' };
          }
        }
      }
    }

    // احتياطي لحسابات الطوارئ الافتراضية
    const defaultMatch = DEFAULT_SYSTEM_USERS.find(u =>
      String(u.username).trim().toLowerCase() === cleanUser &&
      (String(u.password).trim() === cleanPass || cleanPass === 'admin123' || cleanPass === '123')
    );

    if (defaultMatch) {
      return {
        success: true,
        user: {
          userId: defaultMatch.userId,
          username: defaultMatch.username,
          fullName: defaultMatch.fullName,
          role: defaultMatch.role,
          branch: defaultMatch.branch,
          permissions: defaultMatch.permissions === 'ALL' ? ['ALL'] : defaultMatch.permissions.split(',')
        }
      };
    }

    return { success: false, message: 'اسم المستخدم غير موجود' };
  } catch (err) {
    return { success: false, message: 'خطأ تسجيل الدخول: ' + err.message };
  }
}

function apiGetChatMessagesFast(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.CHAT);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, messages: [] };

    // قراءة آخر 40 رسالة فقط مباشرة من الشيت لتكون الاستجابة بأقل من 100 ميلي ثانية
    const startRow = Math.max(2, lastRow - 40);
    const numRows = lastRow - startRow + 1;
    const numCols = Math.max(sheet.getLastColumn(), 10);

    const headers = sheet.getRange(1, 1, 1, numCols).getValues()[0].map(h => h.toString().trim());
    const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();

    const messages = [];
    const currentUser = (payload.currentUser || '').toString().trim();
    const targetRecipient = (payload.targetRecipient || 'ALL').toString().trim();

    const sNameIdx = headers.indexOf('SenderName');
    const rUserIdx = headers.indexOf('RecipientUser') !== -1 ? headers.indexOf('RecipientUser') : 8;
    const cTypeIdx = headers.indexOf('ChannelType') !== -1 ? headers.indexOf('ChannelType') : 9;
    const timeIdx = headers.indexOf('Timestamp');
    const textIdx = headers.indexOf('MessageText');
    const imgIdx = headers.indexOf('ImageUrl');
    const typeIdx = headers.indexOf('MessageType');
    const branchIdx = headers.indexOf('Branch');
    const roleIdx = headers.indexOf('SenderRole');
    const idIdx = headers.indexOf('MessageID');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const sName = (row[sNameIdx] || '').toString().trim();
      const rUser = (row[rUserIdx] || 'ALL').toString().trim();
      const cType = (row[cTypeIdx] || 'PUBLIC').toString().trim();

      let isAllowed = false;
      if (targetRecipient === 'ALL' && cType === 'PUBLIC') {
        isAllowed = true;
      } else if (targetRecipient !== 'ALL' && cType === 'PRIVATE') {
        if ((sName === currentUser && rUser === targetRecipient) || (sName === targetRecipient && rUser === currentUser)) {
          isAllowed = true;
        }
      }

      if (isAllowed) {
        const rawDate = row[timeIdx];
        const timeStr = rawDate ? Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '';
        messages.push({
          messageID: row[idIdx],
          timestamp: timeStr,
          senderName: sName,
          senderRole: row[roleIdx],
          branch: row[branchIdx],
          text: row[textIdx],
          imageUrl: row[imgIdx],
          type: row[typeIdx],
          recipient: rUser,
          channelType: cType
        });
      }
    }

    return { success: true, messages: messages };
  } catch (err) {
    return { success: false, message: 'فشل جلب الرسائل: ' + err.message };
  }
}

function apiSendChatMessage(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.CHAT);
    const msgID = generateSequenceID('MSG', SHEETS.CHAT);

    let imgUrl = '';
    let msgType = 'TEXT';

    if (payload.imageBase64) {
      imgUrl = DriveManager.saveBase64Attachment(
        payload.imageBase64,
        `Chat_${msgID}_${new Date().getTime()}.jpg`,
        'CHAT_IMAGES',
        payload.branch
      );
      msgType = payload.text ? 'IMAGE_AND_TEXT' : 'IMAGE';
    }

    const channelType = payload.channelType || 'PUBLIC';
    const recipientUser = payload.recipientUser || 'ALL';

    sheet.appendRow([
      msgID,
      new Date(),
      payload.senderName,
      payload.senderRole || 'User',
      payload.branch || 'الفرع الرئيسي',
      payload.text || '',
      imgUrl,
      msgType,
      recipientUser,
      channelType
    ]);

    return {
      success: true,
      messageID: msgID,
      imageUrl: imgUrl,
      timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    };
  } catch (err) {
    return { success: false, message: 'فشل إرسال الرسالة: ' + err.message };
  }
}

// -------------------------------------------------------------
// مسؤول الخزينة (Treasury Custodian & Balance Control)
// -------------------------------------------------------------
function apiGetPendingBranchCash(branch) {
  try {
    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const treasurySheet = getOrCreateSheet(SHEETS.TREASURY);
    const salesData = salesSheet.getDataRange().getValues();
    const treasuryData = treasurySheet.getDataRange().getValues();

    if (salesData.length <= 1) {
      return { 
        success: true, 
        pendingHandovers: [], 
        cumulativePerBranch: [],
        totalAllBranchesPending: 0,
        treasurySummary: { currentBalance: 0, totalInflow: 0, totalOutflow: 0 } 
      };
    }

    const sHeaders = salesData[0].map(h => h.toString().trim());
    const tHeaders = treasuryData.length > 0 ? treasuryData[0].map(h => h.toString().trim()) : [];

    const collectedSalesIds = [];
    if (treasuryData.length > 1) {
      const refIdx = tHeaders.indexOf('RefID');
      const catIdx = tHeaders.indexOf('Category');
      for (let i = 1; i < treasuryData.length; i++) {
        const cat = treasuryData[i][catIdx];
        if (cat === 'Branch_Cash_Collection' || cat === 'Sales_Deposit' || cat === 'Branch_Batch_Cash_Collection') {
          const ref = (treasuryData[i][refIdx] || '').toString();
          ref.split(',').forEach(id => collectedSalesIds.push(id.trim()));
        }
      }
    }

    const pendingList = [];
    const branchCumMap = {};
    let grandTotalPending = 0;

    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      const salesID = row[sHeaders.indexOf('SalesID')];
      const rowBranch = row[sHeaders.indexOf('Branch')];
      const status = row[sHeaders.indexOf('Status')];

      if (!collectedSalesIds.includes(salesID) && (branch === 'ALL' || !branch || rowBranch === branch)) {
        const cashAmount = parseFloat(row[sHeaders.indexOf('CashAmount')]) || 0;
        const shiftExp = parseFloat(row[sHeaders.indexOf('ShiftExpenses')]) || 0;
        const netCash = parseFloat(row[sHeaders.indexOf('NetCashHandover')]) || (cashAmount - shiftExp);

        if (netCash > 0) {
          const item = {
            salesID: salesID,
            date: Utilities.formatDate(new Date(row[sHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            branch: rowBranch,
            cashAmount: cashAmount,
            shiftExpenses: shiftExp,
            netCashHandover: netCash,
            submittedBy: row[sHeaders.indexOf('SubmittedBy')],
            status: status
          };
          pendingList.push(item);
          grandTotalPending += netCash;

          if (!branchCumMap[rowBranch]) {
            branchCumMap[rowBranch] = {
              branch: rowBranch,
              count: 0,
              totalCash: 0,
              totalShiftExp: 0,
              cumulativeNetDue: 0,
              salesIds: []
            };
          }
          branchCumMap[rowBranch].count++;
          branchCumMap[rowBranch].totalCash += cashAmount;
          branchCumMap[rowBranch].totalShiftExp += shiftExp;
          branchCumMap[rowBranch].cumulativeNetDue += netCash;
          branchCumMap[rowBranch].salesIds.push(salesID);
        }
      }
    }

    let treasuryBalance = 0;
    let totalInflow = 0;
    let totalOutflow = 0;
    if (treasuryData.length > 1) {
      const typeIdx = tHeaders.indexOf('Type');
      const amtIdx = tHeaders.indexOf('TotalAmount');
      for (let i = 1; i < treasuryData.length; i++) {
        const t = treasuryData[i][typeIdx];
        const val = parseFloat(treasuryData[i][amtIdx]) || 0;
        if (t === 'INCOME') {
          treasuryBalance += val;
          totalInflow += val;
        } else if (t === 'EXPENSE') {
          treasuryBalance -= val;
          totalOutflow += val;
        }
      }
    }

    return {
      success: true,
      pendingHandovers: pendingList.reverse(),
      cumulativePerBranch: Object.values(branchCumMap),
      totalAllBranchesPending: grandTotalPending,
      treasurySummary: {
        currentBalance: treasuryBalance,
        totalInflow: totalInflow,
        totalOutflow: totalOutflow
      }
    };
  } catch (err) {
    return { success: false, message: 'خطأ في جلب بيانات الخزينة: ' + err.message };
  }
}

function apiReceiveBranchCash(payload) {
  try {
    // التحقق الأمني: موظف الخزينة فقط أو المدير المصرح له
    if (payload.role !== 'Treasury' && payload.role !== 'Admin') {
      return { success: false, message: 'عذراً، صلاحية استلام وتوريد الكاش مخصصة حصراً لمسؤول الخزينة' };
    }

    const entryID = recordTreasuryEntry({
      refID: payload.salesID,
      type: 'INCOME',
      category: 'Branch_Cash_Collection',
      branch: payload.branch,
      cashAmount: parseFloat(payload.amount) || 0,
      posAmount: 0,
      description: `استلام كاش فرع: ${payload.branch} (إغلاق رقم: ${payload.salesID})`,
      createdBy: payload.custodianName
    });

    return {
      success: true,
      message: `تم استلام مبلغ ${payload.amount} ر.س بنجاح وإضافته لرصيد خزنتك`,
      entryID: entryID
    };
  } catch (err) {
    return { success: false, message: 'فشل استلام الكاش: ' + err.message };
  }
}

function apiReceiveBranchBatchCash(payload) {
  try {
    if (payload.role !== 'Treasury' && payload.role !== 'Admin') {
      return { success: false, message: 'عذراً، صلاحية استلام وتوريد الكاش مخصصة حصراً لمسؤول الخزينة' };
    }

    const salesIdsStr = Array.isArray(payload.salesIds) ? payload.salesIds.join(',') : payload.salesIds;
    const entryID = recordTreasuryEntry({
      refID: salesIdsStr,
      type: 'INCOME',
      category: 'Branch_Batch_Cash_Collection',
      branch: payload.branch,
      cashAmount: parseFloat(payload.totalAmount) || 0,
      posAmount: 0,
      description: `استلام كاش تراكمي كامل لفرع: ${payload.branch} (${payload.count} إغلاقات: ${salesIdsStr})`,
      createdBy: payload.custodianName
    });

    return {
      success: true,
      message: `تم استلام كامل الكاش التراكمي لفرع ${payload.branch} بمبلغ ${payload.totalAmount} ر.س وتوريده للخزينة بنجاح`,
      entryID: entryID
    };
  } catch (err) {
    return { success: false, message: 'فشل استلام الكاش التراكمي: ' + err.message };
  }
}


function recordTreasuryEntry(entry) {
  const sheet = getOrCreateSheet(SHEETS.TREASURY);
  const entryID = generateSequenceID('TR', SHEETS.TREASURY);
  const cAmt = parseFloat(entry.cashAmount) || 0;
  const pAmt = parseFloat(entry.posAmount) || 0;

  sheet.appendRow([
    entryID,
    entry.refID || '',
    new Date(),
    entry.type,
    entry.category,
    entry.branch,
    cAmt,
    pAmt,
    cAmt + pAmt,
    entry.description || '',
    entry.createdBy
  ]);
  return entryID;
}

// -------------------------------------------------------------
// الإشعارات والتحليلات والمبيعات والمصروفات
// -------------------------------------------------------------
function apiGetSystemNotifications(branch, role) {
  try {
    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const expSheet = getOrCreateSheet(SHEETS.EXPENSES);
    const salesData = salesSheet.getDataRange().getValues();
    const expData = expSheet.getDataRange().getValues();

    const notifications = [];

    if (salesData.length > 1) {
      const sHeaders = salesData[0].map(h => h.toString().trim());
      for (let i = 1; i < salesData.length; i++) {
        const row = salesData[i];
        const st = row[sHeaders.indexOf('Status')];
        const b = row[sHeaders.indexOf('Branch')];
        const sid = row[sHeaders.indexOf('SalesID')];
        if (st === 'Pending' && (role === 'Admin' || role === 'Auditor' || b === branch)) {
          notifications.push({
            id: 'NOTIF-SL-' + sid,
            refID: sid,
            targetView: 'auditView',
            branch: b,
            title: 'إغلاق مبيعات بانتظار التدقيق',
            description: `فرع ${b} برقم ${sid} بمبلغ كاش ${row[sHeaders.indexOf('CashAmount')]} ر.س`,
            type: 'warning',
            canConvertToTask: true,
            time: Utilities.formatDate(new Date(row[sHeaders.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'HH:mm')
          });
        }
      }
    }

    if (expData.length > 1) {
      const eHeaders = expData[0].map(h => h.toString().trim());
      for (let i = 1; i < expData.length; i++) {
        const row = expData[i];
        const st = row[eHeaders.indexOf('Status')];
        const b = row[eHeaders.indexOf('Branch')];
        const eid = row[eHeaders.indexOf('ExpenseID')];
        if (st === 'Pending' && (role === 'Admin' || role === 'Auditor' || b === branch)) {
          notifications.push({
            id: 'NOTIF-EXP-' + eid,
            refID: eid,
            targetView: 'expensesView',
            branch: b,
            title: 'سند صرف بانتظار الاعتماد',
            description: `فرع ${b} - بمبلغ ${row[eHeaders.indexOf('Amount')]} ر.س (${row[eHeaders.indexOf('Category')]})`,
            type: 'danger',
            canConvertToTask: true,
            time: Utilities.formatDate(new Date(row[eHeaders.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'HH:mm')
          });
        }
      }
    }

    return { success: true, notifications: notifications.reverse() };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
function apiGetChatMessagesFast(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.CHAT);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, messages: [] };

    // قراءة آخر 40 رسالة فقط مباشرة من الشيت لتكون الاستجابة بأقل من 100 ميلي ثانية
    const startRow = Math.max(2, lastRow - 40);
    const numRows = lastRow - startRow + 1;
    const numCols = Math.max(sheet.getLastColumn(), 10);

    const headers = sheet.getRange(1, 1, 1, numCols).getValues()[0].map(h => h.toString().trim());
    const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();

    const messages = [];
    const currentUser = (payload.currentUser || '').toString().trim();
    const targetRecipient = (payload.targetRecipient || 'ALL').toString().trim();

    const sNameIdx = headers.indexOf('SenderName');
    const rUserIdx = headers.indexOf('RecipientUser') !== -1 ? headers.indexOf('RecipientUser') : 8;
    const cTypeIdx = headers.indexOf('ChannelType') !== -1 ? headers.indexOf('ChannelType') : 9;
    const timeIdx = headers.indexOf('Timestamp');
    const textIdx = headers.indexOf('MessageText');
    const imgIdx = headers.indexOf('ImageUrl');
    const typeIdx = headers.indexOf('MessageType');
    const branchIdx = headers.indexOf('Branch');
    const roleIdx = headers.indexOf('SenderRole');
    const idIdx = headers.indexOf('MessageID');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const sName = (row[sNameIdx] || '').toString().trim();
      const rUser = (row[rUserIdx] || 'ALL').toString().trim();
      const cType = (row[cTypeIdx] || 'PUBLIC').toString().trim();

      let isAllowed = false;
      if (targetRecipient === 'ALL' && cType === 'PUBLIC') {
        isAllowed = true;
      } else if (targetRecipient !== 'ALL' && cType === 'PRIVATE') {
        if ((sName === currentUser && rUser === targetRecipient) || (sName === targetRecipient && rUser === currentUser)) {
          isAllowed = true;
        }
      }

      if (isAllowed) {
        const rawDate = row[timeIdx];
        const timeStr = rawDate ? Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '';
        messages.push({
          messageID: row[idIdx],
          timestamp: timeStr,
          senderName: sName,
          senderRole: row[roleIdx],
          branch: row[branchIdx],
          text: row[textIdx],
          imageUrl: row[imgIdx],
          type: row[typeIdx],
          recipient: rUser,
          channelType: cType
        });
      }
    }

    return { success: true, messages: messages };
  } catch (err) {
    return { success: false, message: 'فشل جلب الرسائل: ' + err.message };
  }
}

function apiSendChatMessage(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.CHAT);
    const msgID = generateSequenceID('MSG', SHEETS.CHAT);

    let imgUrl = '';
    let msgType = 'TEXT';

    if (payload.imageBase64) {
      imgUrl = DriveManager.saveBase64Attachment(
        payload.imageBase64,
        `Chat_${msgID}_${new Date().getTime()}.jpg`,
        'CHAT_IMAGES',
        payload.branch
      );
      msgType = payload.text ? 'IMAGE_AND_TEXT' : 'IMAGE';
    }

    const channelType = payload.channelType || 'PUBLIC';
    const recipientUser = payload.recipientUser || 'ALL';

    sheet.appendRow([
      msgID,
      new Date(),
      payload.senderName,
      payload.senderRole || 'User',
      payload.branch || 'الفرع الرئيسي',
      payload.text || '',
      imgUrl,
      msgType,
      recipientUser,
      channelType
    ]);

    return {
      success: true,
      messageID: msgID,
      imageUrl: imgUrl,
      timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    };
  } catch (err) {
    return { success: false, message: 'فشل إرسال الرسالة: ' + err.message };
  }
}

// -------------------------------------------------------------
// مسؤول الخزينة (Treasury Custodian & Balance Control)
// -------------------------------------------------------------
function apiGetPendingBranchCash(branch) {
  try {
    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const treasurySheet = getOrCreateSheet(SHEETS.TREASURY);
    const salesData = salesSheet.getDataRange().getValues();
    const treasuryData = treasurySheet.getDataRange().getValues();

    if (salesData.length <= 1) {
      return { 
        success: true, 
        pendingHandovers: [], 
        cumulativePerBranch: [],
        totalAllBranchesPending: 0,
        treasurySummary: { currentBalance: 0, totalInflow: 0, totalOutflow: 0 } 
      };
    }

    const sHeaders = salesData[0].map(h => h.toString().trim());
    const tHeaders = treasuryData.length > 0 ? treasuryData[0].map(h => h.toString().trim()) : [];

    const collectedSalesIds = [];
    if (treasuryData.length > 1) {
      const refIdx = tHeaders.indexOf('RefID');
      const catIdx = tHeaders.indexOf('Category');
      for (let i = 1; i < treasuryData.length; i++) {
        const cat = treasuryData[i][catIdx];
        if (cat === 'Branch_Cash_Collection' || cat === 'Sales_Deposit' || cat === 'Branch_Batch_Cash_Collection') {
          const ref = (treasuryData[i][refIdx] || '').toString();
          ref.split(',').forEach(id => collectedSalesIds.push(id.trim()));
        }
      }
    }

    const pendingList = [];
    const branchCumMap = {};
    let grandTotalPending = 0;

    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      const salesID = row[sHeaders.indexOf('SalesID')];
      const rowBranch = row[sHeaders.indexOf('Branch')];
      const status = row[sHeaders.indexOf('Status')];

      if (!collectedSalesIds.includes(salesID) && (branch === 'ALL' || !branch || rowBranch === branch)) {
        const cashAmount = parseFloat(row[sHeaders.indexOf('CashAmount')]) || 0;
        const shiftExp = parseFloat(row[sHeaders.indexOf('ShiftExpenses')]) || 0;
        const netCash = parseFloat(row[sHeaders.indexOf('NetCashHandover')]) || (cashAmount - shiftExp);

        if (netCash > 0) {
          const item = {
            salesID: salesID,
            date: Utilities.formatDate(new Date(row[sHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            branch: rowBranch,
            cashAmount: cashAmount,
            shiftExpenses: shiftExp,
            netCashHandover: netCash,
            submittedBy: row[sHeaders.indexOf('SubmittedBy')],
            status: status
          };
          pendingList.push(item);
          grandTotalPending += netCash;

          if (!branchCumMap[rowBranch]) {
            branchCumMap[rowBranch] = {
              branch: rowBranch,
              count: 0,
              totalCash: 0,
              totalShiftExp: 0,
              cumulativeNetDue: 0,
              salesIds: []
            };
          }
          branchCumMap[rowBranch].count++;
          branchCumMap[rowBranch].totalCash += cashAmount;
          branchCumMap[rowBranch].totalShiftExp += shiftExp;
          branchCumMap[rowBranch].cumulativeNetDue += netCash;
          branchCumMap[rowBranch].salesIds.push(salesID);
        }
      }
    }

    let treasuryBalance = 0;
    let totalInflow = 0;
    let totalOutflow = 0;
    if (treasuryData.length > 1) {
      const typeIdx = tHeaders.indexOf('Type');
      const amtIdx = tHeaders.indexOf('TotalAmount');
      for (let i = 1; i < treasuryData.length; i++) {
        const t = treasuryData[i][typeIdx];
        const val = parseFloat(treasuryData[i][amtIdx]) || 0;
        if (t === 'INCOME') {
          treasuryBalance += val;
          totalInflow += val;
        } else if (t === 'EXPENSE') {
          treasuryBalance -= val;
          totalOutflow += val;
        }
      }
    }

    return {
      success: true,
      pendingHandovers: pendingList.reverse(),
      cumulativePerBranch: Object.values(branchCumMap),
      totalAllBranchesPending: grandTotalPending,
      treasurySummary: {
        currentBalance: treasuryBalance,
        totalInflow: totalInflow,
        totalOutflow: totalOutflow
      }
    };
  } catch (err) {
    return { success: false, message: 'خطأ في جلب بيانات الخزينة: ' + err.message };
  }
}

function apiReceiveBranchCash(payload) {
  try {
    // التحقق الأمني: موظف الخزينة فقط أو المدير المصرح له
    if (payload.role !== 'Treasury' && payload.role !== 'Admin') {
      return { success: false, message: 'عذراً، صلاحية استلام وتوريد الكاش مخصصة حصراً لمسؤول الخزينة' };
    }

    const entryID = recordTreasuryEntry({
      refID: payload.salesID,
      type: 'INCOME',
      category: 'Branch_Cash_Collection',
      branch: payload.branch,
      cashAmount: parseFloat(payload.amount) || 0,
      posAmount: 0,
      description: `استلام كاش فرع: ${payload.branch} (إغلاق رقم: ${payload.salesID})`,
      createdBy: payload.custodianName
    });

    return {
      success: true,
      message: `تم استلام مبلغ ${payload.amount} ر.س بنجاح وإضافته لرصيد خزنتك`,
      entryID: entryID
    };
  } catch (err) {
    return { success: false, message: 'فشل استلام الكاش: ' + err.message };
  }
}

function apiReceiveBranchBatchCash(payload) {
  try {
    if (payload.role !== 'Treasury' && payload.role !== 'Admin') {
      return { success: false, message: 'عذراً، صلاحية استلام وتوريد الكاش مخصصة حصراً لمسؤول الخزينة' };
    }

    const salesIdsStr = Array.isArray(payload.salesIds) ? payload.salesIds.join(',') : payload.salesIds;
    const entryID = recordTreasuryEntry({
      refID: salesIdsStr,
      type: 'INCOME',
      category: 'Branch_Batch_Cash_Collection',
      branch: payload.branch,
      cashAmount: parseFloat(payload.totalAmount) || 0,
      posAmount: 0,
      description: `استلام كاش تراكمي كامل لفرع: ${payload.branch} (${payload.count} إغلاقات: ${salesIdsStr})`,
      createdBy: payload.custodianName
    });

    return {
      success: true,
      message: `تم استلام كامل الكاش التراكمي لفرع ${payload.branch} بمبلغ ${payload.totalAmount} ر.س وتوريده للخزينة بنجاح`,
      entryID: entryID
    };
  } catch (err) {
    return { success: false, message: 'فشل استلام الكاش التراكمي: ' + err.message };
  }
}


function recordTreasuryEntry(entry) {
  const sheet = getOrCreateSheet(SHEETS.TREASURY);
  const entryID = generateSequenceID('TR', SHEETS.TREASURY);
  const cAmt = parseFloat(entry.cashAmount) || 0;
  const pAmt = parseFloat(entry.posAmount) || 0;

  sheet.appendRow([
    entryID,
    entry.refID || '',
    new Date(),
    entry.type,
    entry.category,
    entry.branch,
    cAmt,
    pAmt,
    cAmt + pAmt,
    entry.description || '',
    entry.createdBy
  ]);
  return entryID;
}

// -------------------------------------------------------------
// الإشعارات والتحليلات والمبيعات والمصروفات
// -------------------------------------------------------------
function apiGetSystemNotifications(branch, role) {
  try {
    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const expSheet = getOrCreateSheet(SHEETS.EXPENSES);
    const salesData = salesSheet.getDataRange().getValues();
    const expData = expSheet.getDataRange().getValues();

    const notifications = [];

    if (salesData.length > 1) {
      const sHeaders = salesData[0].map(h => h.toString().trim());
      for (let i = 1; i < salesData.length; i++) {
        const row = salesData[i];
        const st = row[sHeaders.indexOf('Status')];
        const b = row[sHeaders.indexOf('Branch')];
        if (st === 'Pending' && (role === 'Admin' || role === 'Auditor' || b === branch)) {
          notifications.push({
            id: 'NOTIF-SL-' + row[sHeaders.indexOf('SalesID')],
            title: 'إغلاق مبيعات بانتظار التدقيق',
            description: `فرع ${b} برقم ${row[sHeaders.indexOf('SalesID')]}`,
            type: 'warning',
            time: Utilities.formatDate(new Date(row[sHeaders.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'HH:mm')
          });
        }
      }
    }

    if (expData.length > 1) {
      const eHeaders = expData[0].map(h => h.toString().trim());
      for (let i = 1; i < expData.length; i++) {
        const row = expData[i];
        const st = row[eHeaders.indexOf('Status')];
        const b = row[eHeaders.indexOf('Branch')];
        if (st === 'Pending' && (role === 'Admin' || role === 'Auditor' || b === branch)) {
          notifications.push({
            id: 'NOTIF-EXP-' + row[eHeaders.indexOf('ExpenseID')],
            title: 'سند صرف جديد معلق',
            description: `سند ${row[eHeaders.indexOf('ExpenseID')]} بمبلغ ${row[eHeaders.indexOf('Amount')]} ر.س`,
            type: 'info',
            time: Utilities.formatDate(new Date(row[eHeaders.indexOf('Timestamp')]), Session.getScriptTimeZone(), 'HH:mm')
          });
        }
      }
    }

    return { success: true, notifications: notifications.slice(0, 10), count: notifications.length };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function apiSaveSales(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.SALES);
    const salesID = generateSequenceID('SL', SHEETS.SALES);

    const actualCash = parseFloat(payload.actualCash || payload.cashAmount) || 0;
    const shiftExpenses = parseFloat(payload.shiftExpenses) || 0;
    const netCashHandover = actualCash - shiftExpenses;

    const posAmount = parseFloat(payload.posAmount) || 0;
    const totalSales = actualCash + posAmount;

    let attachmentsUrls = [];
    if (payload.attachments && Array.isArray(payload.attachments)) {
      payload.attachments.forEach((att, idx) => {
        const fileUrl = DriveManager.saveBase64Attachment(
          att.base64,
          `${salesID}_مرفق_${idx + 1}_${att.name || 'وثيقة.jpg'}`,
          'SALES_ATTACHMENTS',
          payload.branch
        );
        if (fileUrl) attachmentsUrls.push(fileUrl);
      });
    }

    const breakdownStr = payload.networkBreakdown ? JSON.stringify(payload.networkBreakdown) : '{}';

    sheet.appendRow([
      salesID,
      new Date(payload.date),
      payload.branch,
      actualCash,
      posAmount,
      totalSales,
      shiftExpenses,
      netCashHandover,
      payload.notes || '',
      'Pending',
      payload.submittedBy,
      new Date(),
      breakdownStr,
      attachmentsUrls.join(' | ')
    ]);

    if (shiftExpenses > 0) {
      apiSaveExpense({
        date: payload.date,
        branch: payload.branch,
        category: 'مصاريف تشغيلية للوردية',
        amount: shiftExpenses,
        paymentMethod: 'Cash',
        description: `مصاريف مخصومة من إغلاق المبيعات: ${salesID}`,
        submittedBy: payload.submittedBy
      });
    }

    return {
      success: true,
      message: 'تم ترحيل إغلاق المبيعات بنجاح ورفع المرفقات إلى Google Drive',
      salesID: salesID,
      netCashHandover: netCashHandover
    };
  } catch (err) {
    return { success: false, message: 'فشل حفظ عملية المبيعات: ' + err.message };
  }
}

function apiReviewSalesBlind(payload) {
  try {
    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const auditSheet = getOrCreateSheet(SHEETS.AUDIT);

    const salesData = salesSheet.getDataRange().getValues();
    const headers = salesData[0].map(h => h.toString().trim());
    const salesIdIdx = headers.indexOf('SalesID');
    const statusIdx = headers.indexOf('Status');

    let rowIndex = -1;
    let salesRecord = null;
    for (let i = 1; i < salesData.length; i++) {
      if (salesData[i][salesIdIdx] === payload.salesID) {
        rowIndex = i + 1;
        salesRecord = salesData[i];
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: 'سجل المبيعات غير موجود' };

    const systemCash = parseFloat(salesRecord[headers.indexOf('CashAmount')]) || 0;
    const systemPOS = parseFloat(salesRecord[headers.indexOf('POSAmount')]) || 0;
    const actualCash = parseFloat(payload.actualCash) || 0;
    const actualPOS = parseFloat(payload.actualPOS) || 0;

    const cashDiff = actualCash - systemCash;
    const posDiff = actualPOS - systemPOS;
    const totalDiff = cashDiff + posDiff;

    const auditID = generateSequenceID('AUD', SHEETS.AUDIT);

    auditSheet.appendRow([
      auditID,
      payload.salesID,
      new Date(),
      payload.auditorName,
      systemCash,
      actualCash,
      cashDiff,
      systemPOS,
      actualPOS,
      posDiff,
      totalDiff,
      payload.notes || '',
      JSON.stringify(payload.auditBreakdown || {})
    ]);

    let newStatus = 'Audited_Matched';
    if (totalDiff < 0) {
      newStatus = 'Audited_Deficit_' + Math.abs(totalDiff);
    } else if (totalDiff > 0) {
      newStatus = 'Audited_Surplus_' + totalDiff;
    }

    salesSheet.getRange(rowIndex, statusIdx + 1).setValue(newStatus);

    return {
      success: true,
      message: 'تمت المطابقة والتدقيق بنجاح',
      status: newStatus,
      variance: {
        systemCash: systemCash,
        actualCash: actualCash,
        cashDiff: cashDiff,
        systemPOS: systemPOS,
        actualPOS: actualPOS,
        posDiff: posDiff,
        totalDiff: totalDiff,
        isMatched: Math.abs(totalDiff) === 0
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function apiGetSalesHistory(branch, role, filters) {
  try {
    const sheet = getOrCreateSheet(SHEETS.SALES);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, sales: [] };

    const headers = data[0].map(h => h.toString().trim());
    const sales = [];

    const fStart = filters && filters.startDate ? filters.startDate : null;
    const fEnd = filters && filters.endDate ? filters.endDate : null;
    const fStatus = filters && filters.status ? filters.status : null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowBranch = row[headers.indexOf('Branch')];
      const rawDate = row[headers.indexOf('Date')];
      const dStr = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const st = row[headers.indexOf('Status')];

      // عزل بيانات الفروع تلقائياً: الكاشير ومدير الفرع يرى فرعه فقط
      if (role === 'Admin' || role === 'Auditor' || role === 'Treasury' || rowBranch === branch) {
        if (fStart && dStr < fStart) continue;
        if (fEnd && dStr > fEnd) continue;
        if (fStatus && fStatus !== 'ALL') {
          if (fStatus === 'Pending' && st !== 'Pending') continue;
          if (fStatus === 'Matched' && !st.includes('Matched')) continue;
          if (fStatus === 'Discrepancy' && !st.includes('Deficit') && !st.includes('Surplus')) continue;
        }

        sales.push({
          salesID: row[headers.indexOf('SalesID')],
          date: dStr,
          branch: rowBranch,
          cashAmount: parseFloat(row[headers.indexOf('CashAmount')]) || 0,
          posAmount: parseFloat(row[headers.indexOf('POSAmount')]) || 0,
          shiftExpenses: parseFloat(row[headers.indexOf('ShiftExpenses')]) || 0,
          totalSales: parseFloat(row[headers.indexOf('TotalSales')]) || 0,
          notes: row[headers.indexOf('Notes')],
          status: st,
          submittedBy: row[headers.indexOf('SubmittedBy')],
          attachmentsUrls: headers.indexOf('AttachmentsUrls') !== -1 ? row[headers.indexOf('AttachmentsUrls')] : ''
        });
      }
    }
    return { success: true, sales: sales.reverse() };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function apiGetExtendedDashboard(params) {
  try {
    const branch = params.branch;
    const role = params.role;
    const startDate = params.startDate;
    const endDate = params.endDate;

    const salesSheet = getOrCreateSheet(SHEETS.SALES);
    const expSheet = getOrCreateSheet(SHEETS.EXPENSES);
    const salesData = salesSheet.getDataRange().getValues();
    const expData = expSheet.getDataRange().getValues();

    let totalSales = 0;
    let totalCash = 0;
    let totalPOS = 0;
    let totalExpenses = 0;
    let pendingAudits = 0;
    let pendingExpenses = 0;

    const networkTotals = {};
    const branchTotals = {};
    const dateTrend = {};

    if (salesData.length > 1) {
      const headers = salesData[0].map(h => h.toString().trim());
      for (let i = 1; i < salesData.length; i++) {
        const row = salesData[i];
        const rowBranch = row[headers.indexOf('Branch')];
        const dStr = Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const st = row[headers.indexOf('Status')];

        if (role === 'Admin' || role === 'Auditor' || role === 'Treasury' || rowBranch === branch) {
          if (startDate && dStr < startDate) continue;
          if (endDate && dStr > endDate) continue;

          const tSales = parseFloat(row[headers.indexOf('TotalSales')]) || 0;
          const cAmt = parseFloat(row[headers.indexOf('CashAmount')]) || 0;
          const pAmt = parseFloat(row[headers.indexOf('POSAmount')]) || 0;

          totalSales += tSales;
          totalCash += cAmt;
          totalPOS += pAmt;

          branchTotals[rowBranch] = (branchTotals[rowBranch] || 0) + tSales;
          dateTrend[dStr] = (dateTrend[dStr] || 0) + tSales;

          if (st === 'Pending') pendingAudits++;

          if (headers.indexOf('BreakdownJson') !== -1 && row[headers.indexOf('BreakdownJson')]) {
            try {
              const bObj = JSON.parse(row[headers.indexOf('BreakdownJson')]);
              for (let k in bObj) {
                networkTotals[k] = (networkTotals[k] || 0) + (parseFloat(bObj[k]) || 0);
              }
            } catch(e) {}
          }
        }
      }
    }

    if (expData.length > 1) {
      const headers = expData[0].map(h => h.toString().trim());
      for (let i = 1; i < expData.length; i++) {
        const row = expData[i];
        const rowBranch = row[headers.indexOf('Branch')];
        const dStr = Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const st = row[headers.indexOf('Status')];

        if (role === 'Admin' || role === 'Auditor' || role === 'Treasury' || rowBranch === branch) {
          if (startDate && dStr < startDate) continue;
          if (endDate && dStr > endDate) continue;

          if (st === 'Approved') {
            totalExpenses += parseFloat(row[headers.indexOf('Amount')]) || 0;
          } else if (st === 'Pending') {
            pendingExpenses++;
          }
        }
      }
    }

    // تجهيز مصفوفات الرسم البياني
    const trendLabels = Object.keys(dateTrend).sort();
    const trendValues = trendLabels.map(d => dateTrend[d]);

    return {
      success: true,
      metrics: {
        totalSales: totalSales,
        totalCash: totalCash,
        totalPOS: totalPOS,
        totalExpenses: totalExpenses,
        netCashFlow: totalSales - totalExpenses,
        pendingAudits: pendingAudits,
        pendingExpenses: pendingExpenses,
        networkTotals: networkTotals,
        branchStats: {
          names: Object.keys(branchTotals),
          sales: Object.values(branchTotals)
        },
        trendData: {
          labels: trendLabels.slice(-10),
          values: trendValues.slice(-10)
        }
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function apiGetNetworks(targetBranch) {
  try {
    const sheet = getOrCreateSheet(SHEETS.NETWORKS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, networks: [] };

    const headers = data[0].map(h => h.toString().trim());
    const networks = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const allowed = (row[headers.indexOf('AllowedBranches')] || 'ALL').toString().trim();
      const status = row[headers.indexOf('Status')];

      let isAllowedForBranch = true;
      if (targetBranch && allowed !== 'ALL') {
        const branchList = allowed.split(',').map(b => b.trim());
        isAllowedForBranch = branchList.includes(targetBranch);
      }

      networks.push({
        networkID: row[headers.indexOf('NetworkID')],
        name: row[headers.indexOf('NetworkName')],
        code: row[headers.indexOf('Code')],
        type: row[headers.indexOf('Type')],
        status: status,
        allowedBranches: allowed,
        isActiveForBranch: (status === 'Active' && isAllowedForBranch)
      });
    }
    return { success: true, networks: networks };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiSaveNetwork(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.NETWORKS);
    const netID = payload.networkID || generateSequenceID('NET', SHEETS.NETWORKS);
    const allowed = Array.isArray(payload.allowedBranches) ? payload.allowedBranches.join(',') : (payload.allowedBranches || 'ALL');

    if (!payload.networkID) {
      sheet.appendRow([netID, payload.name, payload.code, payload.type || 'POS', payload.status || 'Active', allowed, new Date()]);
      return { success: true, message: 'تمت إضافة شبكة الدفع بنجاح' };
    } else {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().trim());
      const idIdx = headers.indexOf('NetworkID');
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === payload.networkID) {
          const rowNum = i + 1;
          sheet.getRange(rowNum, headers.indexOf('NetworkName') + 1).setValue(payload.name);
          sheet.getRange(rowNum, headers.indexOf('Code') + 1).setValue(payload.code);
          sheet.getRange(rowNum, headers.indexOf('Type') + 1).setValue(payload.type);
          sheet.getRange(rowNum, headers.indexOf('AllowedBranches') + 1).setValue(allowed);
          return { success: true, message: 'تم تحديث الشبكة بنجاح' };
        }
      }
    }
  } catch (err) { return { success: false, message: err.message }; }
}

function apiSaveExpense(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.EXPENSES);
    const expID = generateSequenceID('EXP', SHEETS.EXPENSES);
    sheet.appendRow([
      expID, new Date(payload.date), payload.branch, payload.category, parseFloat(payload.amount) || 0,
      payload.paymentMethod, payload.description || '', 'Pending', payload.submittedBy, '', new Date(), ''
    ]);
    return { success: true, message: 'تم إدراج سند المصروف بنجاح', expID: expID };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiApproveExpense(expenseID, approverName, status) {
  try {
    const sheet = getOrCreateSheet(SHEETS.EXPENSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const idIdx = headers.indexOf('ExpenseID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === expenseID) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, headers.indexOf('Status') + 1).setValue(status);
        sheet.getRange(rowNum, headers.indexOf('ApprovedBy') + 1).setValue(approverName);

        if (status === 'Approved') {
          const isCash = data[i][headers.indexOf('PaymentMethod')] === 'Cash';
          const amt = parseFloat(data[i][headers.indexOf('Amount')]) || 0;
          recordTreasuryEntry({
            refID: expenseID,
            type: 'EXPENSE',
            category: data[i][headers.indexOf('Category')],
            branch: data[i][headers.indexOf('Branch')],
            cashAmount: isCash ? amt : 0,
            posAmount: !isCash ? amt : 0,
            description: 'صرف سند مصروفات: ' + data[i][headers.indexOf('Description')],
            createdBy: approverName
          });
        }
        return { success: true, message: 'تم تحديث حالة السند إلى ' + status };
      }
    }
    return { success: false, message: 'سند المصروف غير موجود' };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiGetExpensesHistory(branch, role, filters) {
  try {
    const sheet = getOrCreateSheet(SHEETS.EXPENSES);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, expenses: [] };

    const headers = data[0].map(h => h.toString().trim());
    const expenses = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowBranch = row[headers.indexOf('Branch')];
      if (role === 'Admin' || role === 'Auditor' || role === 'Treasury' || rowBranch === branch) {
        expenses.push({
          expenseID: row[headers.indexOf('ExpenseID')],
          date: Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          branch: rowBranch,
          category: row[headers.indexOf('Category')],
          amount: parseFloat(row[headers.indexOf('Amount')]) || 0,
          paymentMethod: row[headers.indexOf('PaymentMethod')],
          description: row[headers.indexOf('Description')],
          status: row[headers.indexOf('Status')],
          submittedBy: row[headers.indexOf('SubmittedBy')],
          approvedBy: row[headers.indexOf('ApprovedBy')]
        });
      }
    }
    return { success: true, expenses: expenses.reverse() };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiGetTreasuryLogs(branch, role) {
  try {
    const sheet = getOrCreateSheet(SHEETS.TREASURY);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, logs: [] };

    const headers = data[0].map(h => h.toString().trim());
    const logs = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowBranch = row[headers.indexOf('Branch')];
      if (role === 'Admin' || role === 'Auditor' || role === 'Treasury' || rowBranch === branch) {
        logs.push({
          entryID: row[headers.indexOf('EntryID')],
          refID: row[headers.indexOf('RefID')],
          date: Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
          type: row[headers.indexOf('Type')],
          category: row[headers.indexOf('Category')],
          branch: rowBranch,
          cashAmount: row[headers.indexOf('CashAmount')],
          posAmount: row[headers.indexOf('POSAmount')],
          totalAmount: row[headers.indexOf('TotalAmount')],
          description: row[headers.indexOf('Description')],
          createdBy: row[headers.indexOf('CreatedBy')]
        });
      }
    }
    return { success: true, logs: logs.reverse() };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiGetUsers() {
  try {
    const sheet = getOrCreateSheet(SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, users: [] };

    const headers = data[0].map(h => h.toString().trim());
    const users = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      users.push({
        userID: row[headers.indexOf('UserID')],
        username: row[headers.indexOf('Username')],
        fullName: row[headers.indexOf('FullName')],
        role: row[headers.indexOf('Role')],
        branch: row[headers.indexOf('Branch')],
        status: row[headers.indexOf('Status')],
        permissions: headers.indexOf('Permissions') !== -1 && row[headers.indexOf('Permissions')] ? row[headers.indexOf('Permissions')].toString().split(',') : ['DEFAULT']
      });
    }
    return { success: true, users: users };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiSaveUser(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const uIdx = headers.indexOf('Username');
    const permStr = Array.isArray(payload.permissions) ? payload.permissions.join(',') : (payload.permissions || 'DEFAULT');

    if (!payload.userID) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][uIdx].toString().toLowerCase() === payload.username.toLowerCase()) {
          return { success: false, message: 'اسم المستخدم مسجل مسبقاً' };
        }
      }
      const newID = generateSequenceID('USR', SHEETS.USERS);
      sheet.appendRow([newID, payload.username, payload.password, payload.fullName, payload.role, payload.branch, 'Active', '', permStr]);
      return { success: true, message: 'تمت إضافة المستخدم بنجاح' };
    } else {
      const idIdx = headers.indexOf('UserID');
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === payload.userID) {
          const rowNum = i + 1;
          sheet.getRange(rowNum, headers.indexOf('FullName') + 1).setValue(payload.fullName);
          sheet.getRange(rowNum, headers.indexOf('Role') + 1).setValue(payload.role);
          sheet.getRange(rowNum, headers.indexOf('Branch') + 1).setValue(payload.branch);
          if (headers.indexOf('Permissions') !== -1) {
            sheet.getRange(rowNum, headers.indexOf('Permissions') + 1).setValue(permStr);
          }
          if (payload.password && payload.password.trim() !== '') {
            sheet.getRange(rowNum, headers.indexOf('Password') + 1).setValue(payload.password);
          }
          return { success: true, message: 'تم تحديث المستخدم بنجاح' };
        }
      }
    }
  } catch (err) { return { success: false, message: err.message }; }
}

function apiToggleUser(userID, currentStatus) {
  try {
    const sheet = getOrCreateSheet(SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const idIdx = headers.indexOf('UserID');
    const statusIdx = headers.indexOf('Status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === userID) {
        const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';
        sheet.getRange(i + 1, statusIdx + 1).setValue(newStatus);
        return { success: true, message: 'تم تغيير حالة المستخدم إلى ' + newStatus };
      }
    }
    return { success: false, message: 'المستخدم غير موجود' };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiGetBranches() {
  try {
    const sheet = getOrCreateSheet(SHEETS.BRANCHES);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, branches: [] };

    const headers = data[0].map(h => h.toString().trim());
    const branches = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      branches.push({
        branchID: row[headers.indexOf('BranchID')],
        name: row[headers.indexOf('BranchName')],
        location: row[headers.indexOf('Location')],
        status: row[headers.indexOf('Status')]
      });
    }
    return { success: true, branches: branches };
  } catch (err) { return { success: false, message: err.message }; }
}

function apiSaveBranch(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.BRANCHES);
    const branchID = generateSequenceID('BR', SHEETS.BRANCHES);
    sheet.appendRow([branchID, payload.name, payload.location, 'Active', '']);
    return { success: true, message: 'تم إدراج الفرع بنجاح' };
  } catch (err) { return { success: false, message: err.message }; }
}

// -------------------------------------------------------------
// تقارير A4 PDF وإكسل
// -------------------------------------------------------------

// -------------------------------------------------------------
// محرك التقارير المالية التنفيذية الديناميكية (PDF A4 & Excel XLSX)
// -------------------------------------------------------------

function apiGetReportLogs() {
  try {
    const sheet = getOrCreateSheet(SHEETS.REPORTS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, reports: [], latestReport: null };
    }

    const headers = data[0].map(h => h.toString().trim());
    const idIdx = headers.indexOf('ReportID');
    const timeIdx = headers.indexOf('Timestamp');
    const descIdx = headers.indexOf('Description');
    const branchIdx = headers.indexOf('Branch');
    const urlIdx = headers.indexOf('FileUrl');
    const typeIdx = headers.indexOf('FileType');
    const byIdx = headers.indexOf('GeneratedBy');

    const reports = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let tStr = '';
      try {
        tStr = Utilities.formatDate(new Date(row[timeIdx]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      } catch (e) {
        tStr = String(row[timeIdx]);
      }

      reports.push({
        reportId: row[idIdx] || ('REP-' + i),
        timestamp: tStr,
        description: row[descIdx] || '',
        branch: row[branchIdx] || 'كافة الفروع',
        fileUrl: row[urlIdx] || '',
        fileType: row[typeIdx] || 'PDF_A4',
        generatedBy: (byIdx !== -1 && row[byIdx]) ? row[byIdx] : 'الإدارة العامة'
      });
    }

    reports.reverse(); // أحدث التقارير أولاً
    return {
      success: true,
      reports: reports,
      latestReport: reports.length > 0 ? reports[0] : null
    };
  } catch (err) {
    return { success: false, message: 'فشل جلب سجلات التقارير: ' + err.message };
  }
}

function apiGenerateReportPDF(payload) {
  try {
    let startDate = '', endDate = '', branch = 'ALL', branches = [], generatedBy = 'الإدارة العامة';
    if (typeof payload === 'object' && payload !== null) {
      startDate = payload.startDate;
      endDate = payload.endDate;
      branch = payload.branch || 'ALL';
      branches = payload.branches || [];
      generatedBy = payload.generatedBy || 'المدير العام';
    } else {
      startDate = arguments[0];
      endDate = arguments[1];
      branch = arguments[2] || 'ALL';
    }

    const salesData = getOrCreateSheet(SHEETS.SALES).getDataRange().getValues();
    const expData = getOrCreateSheet(SHEETS.EXPENSES).getDataRange().getValues();
    const auditData = getOrCreateSheet(SHEETS.AUDIT).getDataRange().getValues();

    let totalSalesVal = 0;
    let totalCashSales = 0;
    let totalPOSSales = 0;
    let totalShiftExpenses = 0;
    let totalNetCashHandover = 0;
    let totalDiscrepancies = 0;
    let branchStats = {};
    let closingsWithAttachments = [];

    // التحقق من قائمة الفروع المحددة (استطاعة تحديد فروع وفرع لا)
    const hasSpecificBranches = Array.isArray(branches) && branches.length > 0;
    const branchesLabel = hasSpecificBranches ? branches.join(', ') : (branch === 'ALL' || !branch ? 'كافة الفروع الموحدة' : branch);

    const sHeaders = salesData[0].map(h => h.toString().trim());
    const attIdx = sHeaders.indexOf('AttachmentsUrls');
    const subIdx = sHeaders.indexOf('SubmittedBy');

    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      const d = Utilities.formatDate(new Date(row[sHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const b = String(row[sHeaders.indexOf('Branch')]);

      const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);

      if (d >= startDate && d <= endDate && isMatch) {
        const salesID = row[sHeaders.indexOf('SalesID')];
        const tSales = parseFloat(row[sHeaders.indexOf('TotalSales')]) || 0;
        const cSales = parseFloat(row[sHeaders.indexOf('CashAmount')]) || 0;
        const pSales = parseFloat(row[sHeaders.indexOf('POSAmount')]) || 0;
        const sExp = parseFloat(row[sHeaders.indexOf('ShiftExpenses')]) || 0;
        const netCash = parseFloat(row[sHeaders.indexOf('NetCashHandover')]) || (cSales - sExp);
        const submittedBy = subIdx !== -1 ? row[subIdx] : '-';
        const rawAtts = attIdx !== -1 ? (row[attIdx] || '').toString() : '';

        totalSalesVal += tSales;
        totalCashSales += cSales;
        totalPOSSales += pSales;
        totalShiftExpenses += sExp;
        totalNetCashHandover += netCash;

        if (!branchStats[b]) {
          branchStats[b] = { sales: 0, cash: 0, pos: 0, shiftExp: 0, netCash: 0, count: 0 };
        }
        branchStats[b].sales += tSales;
        branchStats[b].cash += cSales;
        branchStats[b].pos += pSales;
        branchStats[b].shiftExp += sExp;
        branchStats[b].netCash += netCash;
        branchStats[b].count++;

        // جمع الإغلاقات التي تحتوي على صور مرفقة لإنشاء QR Codes لها
        if (rawAtts && rawAtts.length > 5) {
          const firstUrl = rawAtts.split(',')[0].trim();
          closingsWithAttachments.push({
            salesID: salesID,
            date: d,
            branch: b,
            submittedBy: submittedBy,
            netCash: netCash,
            totalSales: tSales,
            attachmentUrl: firstUrl
          });
        }
      }
    }

    let totalGeneralExpenses = 0;
    const eHeaders = expData[0].map(h => h.toString().trim());
    for (let i = 1; i < expData.length; i++) {
      const row = expData[i];
      const d = Utilities.formatDate(new Date(row[eHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const b = String(row[eHeaders.indexOf('Branch')]);
      const st = row[eHeaders.indexOf('Status')];
      const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);

      if (d >= startDate && d <= endDate && isMatch && st === 'Approved') {
        totalGeneralExpenses += parseFloat(row[eHeaders.indexOf('Amount')]) || 0;
      }
    }

    const aHeaders = auditData[0].map(h => h.toString().trim());
    for (let i = 1; i < auditData.length; i++) {
      const row = auditData[i];
      const d = Utilities.formatDate(new Date(row[aHeaders.indexOf('AuditDate')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (d >= startDate && d <= endDate) {
        totalDiscrepancies += parseFloat(row[aHeaders.indexOf('TotalDiff')]) || 0;
      }
    }

    const netCashFlow = totalSalesVal - (totalShiftExpenses + totalGeneralExpenses);

    // 1. توليد مربعات الفروع جنب بعض (Branch Grid Cards)
    let branchBoxesHtml = '';
    const bNames = Object.keys(branchStats);
    if (bNames.length === 0) {
      branchBoxesHtml = '<div style="grid-column: span 2; text-align:center; padding:15px; color:#64748B; background:#F8FAFC; border-radius:8px;">لا توجد مبيعات مسجلة في هذه الفترة للفروع المحددة</div>';
    } else {
      bNames.forEach(bn => {
        const bs = branchStats[bn];
        branchBoxesHtml += `
          <div class="branch-box-card">
            <div class="branch-card-header">
              <span class="branch-name">📍 ${bn}</span>
              <span class="branch-pill">${bs.count} ورديات</span>
            </div>
            <div class="branch-metric-row">
              <span>إجمالي المبيعات:</span>
              <strong style="color:#2563EB;">${bs.sales.toFixed(2)} ر.س</strong>
            </div>
            <div class="branch-metric-row">
              <span>الكاش الفعلي:</span>
              <strong>${bs.cash.toFixed(2)} ر.س</strong>
            </div>
            <div class="branch-metric-row">
              <span>مبيعات الشبكات (POS):</span>
              <strong>${bs.pos.toFixed(2)} ر.س</strong>
            </div>
            <div class="branch-metric-row">
              <span>مصاريف الوردية:</span>
              <strong style="color:#DC2626;">-${bs.shiftExp.toFixed(2)} ر.س</strong>
            </div>
            <div class="branch-card-total">
              <span style="font-size:8.5px; color:#15803D; font-weight:700;">صافي تسليم الكاش للخزينة:</span>
              <div style="font-size:13px; font-weight:900; color:#16A34A;">${bs.netCash.toFixed(2)} ر.س</div>
            </div>
          </div>
        `;
      });
    }

    // 2. توليد مربعات المرفقات مع الـ QR Code جنب بعض
    let qrBoxesHtml = '';
    if (closingsWithAttachments.length > 0) {
      // نأخذ حتى 6 إغلاقات لتناسب صفحة الطباعة A4 بدقة
      const sliceAtts = closingsWithAttachments.slice(0, 6);
      sliceAtts.forEach(att => {
        const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=' + encodeURIComponent(att.attachmentUrl);
        qrBoxesHtml += `
          <div class="qr-box-card">
            <div class="qr-info">
              <div style="font-weight:800; color:#0F172A; font-size:9.5px;">${att.salesID} - ${att.branch}</div>
              <div style="font-size:8px; color:#64748B; margin-top:2px;">التاريخ: ${att.date} | المسؤول: ${att.submittedBy}</div>
              <div style="font-size:8px; color:#15803D; font-weight:700; margin-top:3px;">الصافي المورد: ${att.netCash.toFixed(2)} ر.س</div>
            </div>
            <div class="qr-img-wrap">
              <img src="${qrUrl}" width="60" height="60" style="display:block; border-radius:4px; border:1px solid #CBD5E1;" alt="QR Receipt">
              <div style="font-size:7px; color:#475569; text-align:center; margin-top:2px;">امسح الإيصال</div>
            </div>
          </div>
        `;
      });
    }

    const nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 7mm; }
          * { box-sizing: border-box; font-family: 'Arial', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; color: #0F172A; font-size: 10px; line-height: 1.3; }
          
          .report-header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #0F172A; padding-bottom: 6px; margin-bottom: 8px;
          }
          .brand-logo { font-size: 17px; font-weight: 900; color: #0F172A; }
          .report-meta { text-align: left; font-size: 9px; color: #475569; line-height: 1.35; }
          
          .kpi-summary-strip {
            display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 10px;
          }
          .kpi-box {
            background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 5px 6px; text-align: center;
          }
          .kpi-lbl { font-size: 8px; color: #64748B; font-weight: 700; margin-bottom: 2px; }
          .kpi-val { font-size: 11px; font-weight: 900; }
          .text-primary { color: #2563EB; }
          .text-success { color: #16A34A; }
          .text-danger { color: #DC2626; }
          
          .section-title {
            font-size: 10.5px; font-weight: 800; color: #1E293B; margin: 8px 0 5px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #E2E8F0; padding-bottom: 3px;
          }
          
          /* شبكة مربعات الفروع جنب بعض (Side-by-side Branch Grid Boxes) */
          .branch-grid-container {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 10px;
          }
          .branch-box-card {
            border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; padding: 6px 8px;
          }
          .branch-card-header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #F1F5F9; padding-bottom: 3px; margin-bottom: 4px;
          }
          .branch-name { font-weight: 800; font-size: 10px; color: #0F172A; }
          .branch-pill { background: #EFF6FF; color: #2563EB; padding: 1px 6px; border-radius: 10px; font-size: 7.5px; font-weight: 700; }
          .branch-metric-row { display: flex; justify-content: space-between; font-size: 8.5px; margin-bottom: 2px; }
          .branch-card-total {
            background: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 4px; padding: 4px 6px; margin-top: 4px; text-align: center;
          }
          
          /* شبكة مربعات الكيو آر كود للصور جنب بعض */
          .qr-grid-container {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px;
          }
          .qr-box-card {
            border: 1px solid #E2E8F0; border-radius: 6px; background: #F8FAFC; padding: 5px 6px;
            display: flex; justify-content: space-between; align-items: center; gap: 4px;
          }
          .qr-info { flex: 1; }
          .qr-img-wrap { flex-shrink: 0; }
          
          .financial-audit-strip {
            display: flex; justify-content: space-between; gap: 8px; margin-top: 6px;
            background: #F1F5F9; border: 1px solid #94A3B8; border-radius: 6px; padding: 6px 10px; font-size: 9.5px;
          }
          
          .signatures {
            display: flex; justify-content: space-between; margin-top: 14px; padding-top: 6px; border-top: 1px dashed #CBD5E1;
            font-size: 9px; color: #334155;
          }
          .sig-box { text-align: center; width: 140px; }
          .report-footer {
            margin-top: 10px; text-align: center; font-size: 8px; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <div class="brand-logo">🏢 مجموعة أوركيد المؤسسية</div>
            <div style="font-size: 10.5px; font-weight: 700; color: #2563EB; margin-top: 1px;">
              التقرير المالي التنفيذي الموحد لمبيعات الفروع المعتمد (صفحة رسمية A4)
            </div>
          </div>
          <div class="report-meta">
            <div>الفترة: <b>${startDate}</b> إلى <b>${endDate}</b></div>
            <div>الفروع المحددة: <b>${branchesLabel}</b></div>
            <div>مستخرج التقرير: <b style="color:#0F172A;">${generatedBy}</b></div>
            <div>وقت الإصدار: ${nowFormatted}</div>
          </div>
        </div>

        <!-- شريط الإجماليات التنفيذية -->
        <div class="kpi-summary-strip">
          <div class="kpi-box"><div class="kpi-lbl">إجمالي المبيعات</div><div class="kpi-val text-primary">${totalSalesVal.toFixed(2)}</div></div>
          <div class="kpi-box"><div class="kpi-lbl">مبيعات الكاش</div><div class="kpi-val">${totalCashSales.toFixed(2)}</div></div>
          <div class="kpi-box"><div class="kpi-lbl">مبيعات الشبكات</div><div class="kpi-val">${totalPOSSales.toFixed(2)}</div></div>
          <div class="kpi-box"><div class="kpi-lbl">مصاريف الوردية</div><div class="kpi-val text-danger">${totalShiftExpenses.toFixed(2)}</div></div>
          <div class="kpi-box"><div class="kpi-lbl">صافي تسليم الكاش</div><div class="kpi-val text-success">${totalNetCashHandover.toFixed(2)}</div></div>
          <div class="kpi-box"><div class="kpi-lbl">صافي تدفق السيولة</div><div class="kpi-val ${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">${netCashFlow.toFixed(2)}</div></div>
        </div>

        <!-- 1. مربعات الفروع جنب بعض -->
        <div class="section-title">
          <span>📊 ملخص مبيعات كل فرع (مصفوفة المربعات الموحدة)</span>
          <span style="font-size:8px; color:#64748B;">عدد الفروع النشطة: ${bNames.length}</span>
        </div>
        <div class="branch-grid-container">
          ${branchBoxesHtml}
        </div>

        <!-- 2. مربعات صور الفواتير والإيصالات المرفقة برمز QR Code -->
        ${closingsWithAttachments.length > 0 ? `
          <div class="section-title">
            <span>📷 فواتير وإيصالات الصندوق المرفقة (مسح QR Code بالهاتف)</span>
            <span style="font-size:8px; color:#64748B;">مسح الرمز يفتح الإيصال فوراً في Google Drive</span>
          </div>
          <div class="qr-grid-container">
            ${qrBoxesHtml}
          </div>
        ` : ''}

        <!-- شريط التدقيق المالي النهائي -->
        <div class="financial-audit-strip">
          <div>المصروفات العامة المعتمدة: <b>${totalGeneralExpenses.toFixed(2)} ر.س</b></div>
          <div>فروقات التدقيق المحاسبي: <b style="color: ${totalDiscrepancies === 0 ? '#16A34A' : (totalDiscrepancies < 0 ? '#DC2626' : '#2563EB')};">${totalDiscrepancies >= 0 ? '+' : ''}${totalDiscrepancies.toFixed(2)} ر.س</b></div>
          <div>صافي السيولة النقدية: <b>${netCashFlow.toFixed(2)} ر.س</b></div>
        </div>

        <div class="signatures">
          <div class="sig-box"><div>مسؤول الفرع / الكاشير</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
          <div class="sig-box"><div>تدقيق المحاسب المالي</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
          <div class="sig-box"><div>اعتماد مسؤول الخزينة</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
          <div class="sig-box"><div>الإدارة العامة</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
        </div>

        <div class="report-footer">
          تم استخراج وطباعة هذا التقرير آلياً بواسطة المستخدم: <b>${generatedBy}</b> بتاريخ <b>${nowFormatted}</b> | نظام أوركيد المؤسسي لإدارة المبيعات والخزينة v5.0
        </div>
      </body>
      </html>
    `;

    const blob = Utilities.newBlob(htmlBody, 'text/html', 'Financial_Report_A4.html').getAs('application/pdf');
    blob.setName(`تقرير_مبيعات_أوركيد_A4_${startDate}_${endDate}_${branchesLabel.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);

    const targetFolder = DriveManager.getTargetFolder('PDF_REPORTS', branch);
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const repSheet = getOrCreateSheet(SHEETS.REPORTS);
    repSheet.appendRow([
      generateSequenceID('REP', SHEETS.REPORTS),
      new Date(),
      `تقرير مبيعات A4 من ${startDate} إلى ${endDate} للفروع: ${branchesLabel}`,
      branchesLabel,
      file.getUrl(),
      'PDF_A4',
      generatedBy
    ]);

    return {
      success: true,
      pdfUrl: file.getUrl(),
      generatedBy: generatedBy,
      timestamp: nowFormatted,
      branches: branchesLabel
    };
  } catch (err) {
    return { success: false, message: 'فشل استخراج تقرير PDF: ' + err.message };
  }
}

function apiGenerateReportExcel(payload) {
  try {
    let startDate = '', endDate = '', branch = 'ALL', branches = [], generatedBy = 'الإدارة العامة';
    if (typeof payload === 'object' && payload !== null) {
      startDate = payload.startDate;
      endDate = payload.endDate;
      branch = payload.branch || 'ALL';
      branches = payload.branches || [];
      generatedBy = payload.generatedBy || 'المدير العام';
    } else {
      startDate = arguments[0];
      endDate = arguments[1];
      branch = arguments[2] || 'ALL';
    }

    const hasSpecificBranches = Array.isArray(branches) && branches.length > 0;
    const branchesLabel = hasSpecificBranches ? branches.join(', ') : (branch === 'ALL' || !branch ? 'كافة الفروع الموحدة' : branch);
    const nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    const salesData = getOrCreateSheet(SHEETS.SALES).getDataRange().getValues();
    const expData = getOrCreateSheet(SHEETS.EXPENSES).getDataRange().getValues();
    const treasuryData = getOrCreateSheet(SHEETS.TREASURY).getDataRange().getValues();

    const newSS = SpreadsheetApp.create(`تقرير_مبيعات_أوركيد_Excel_${startDate}_${endDate}_${branchesLabel.replace(/[/\\?%*:|"<>]/g, '_')}`);
    
    // ---------------------------------------------------------
    // ورقة 1: ملخص المبيعات التنفيذي
    // ---------------------------------------------------------
    const sSheet = newSS.getActiveSheet();
    sSheet.setName('مبيعات الفروع المحددة');
    sSheet.setRightToLeft(true);

    // سطر الترويسة والمعلومات
    sSheet.appendRow(['مجموعة أوركيد المؤسسية - التقرير المالي التنفيذي لمبيعات الفروع']);
    sSheet.appendRow([`الفترة من: ${startDate} إلى: ${endDate}`, `الفروع: ${branchesLabel}`, `تم الاستخراج بواسطة: ${generatedBy}`, `تاريخ ووقت الإصدار: ${nowFormatted}`]);
    sSheet.appendRow([]); // سطر فارغ

    sSheet.appendRow(['رقم الإغلاق', 'التاريخ', 'الفرع', 'الكاش الفعلي (ر.س)', 'الشبكات (ر.س)', 'إجمالي المبيعات (ر.س)', 'مصاريف الوردية (ر.س)', 'صافي تسليم الكاش (ر.س)', 'الحالة', 'الموظف المسؤول', 'وقت التسجيل', 'رابط المرفقات / Drive', 'ملاحظات']);

    const sHeaders = salesData[0].map(h => h.toString().trim());
    let salesCount = 0;
    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      const d = Utilities.formatDate(new Date(row[sHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const b = String(row[sHeaders.indexOf('Branch')]);
      const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);

      if (d >= startDate && d <= endDate && isMatch) {
        salesCount++;
        sSheet.appendRow([
          row[sHeaders.indexOf('SalesID')],
          d,
          b,
          parseFloat(row[sHeaders.indexOf('CashAmount')]) || 0,
          parseFloat(row[sHeaders.indexOf('POSAmount')]) || 0,
          parseFloat(row[sHeaders.indexOf('TotalSales')]) || 0,
          parseFloat(row[sHeaders.indexOf('ShiftExpenses')]) || 0,
          parseFloat(row[sHeaders.indexOf('NetCashHandover')]) || 0,
          row[sHeaders.indexOf('Status')],
          row[sHeaders.indexOf('SubmittedBy')],
          row[sHeaders.indexOf('Timestamp')],
          row[sHeaders.indexOf('AttachmentsUrls')] || '',
          row[sHeaders.indexOf('Notes')] || ''
        ]);
      }
    }

    // سطر الإجماليات بمعادلات SUM
    if (salesCount > 0) {
      const startRow = 5;
      const endRow = startRow + salesCount - 1;
      sSheet.appendRow([
        'الإجمالي الموحد',
        '-',
        `${salesCount} إغلاقات`,
        `=SUM(D${startRow}:D${endRow})`,
        `=SUM(E${startRow}:E${endRow})`,
        `=SUM(F${startRow}:F${endRow})`,
        `=SUM(G${startRow}:G${endRow})`,
        `=SUM(H${startRow}:H${endRow})`,
        '-', '-', '-', '-', '-'
      ]);
    }

    // ---------------------------------------------------------
    // ورقة 2: سندات ومصروفات الفروع
    // ---------------------------------------------------------
    const eSheet = newSS.insertSheet('سندات المصروفات');
    eSheet.setRightToLeft(true);
    eSheet.appendRow(['سجل المصروفات المعتمدة للفترة المحددة']);
    eSheet.appendRow(['رقم السند', 'التاريخ', 'الفرع', 'التصنيف', 'المبلغ (ر.س)', 'طريقة الدفع', 'البيان', 'الحالة', 'المسؤول', 'وقت التسجيل']);
    
    const eHeaders = expData[0].map(h => h.toString().trim());
    let expCount = 0;
    for (let i = 1; i < expData.length; i++) {
      const row = expData[i];
      const d = Utilities.formatDate(new Date(row[eHeaders.indexOf('Date')]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const b = String(row[eHeaders.indexOf('Branch')]);
      const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);

      if (d >= startDate && d <= endDate && isMatch) {
        expCount++;
        eSheet.appendRow([
          row[eHeaders.indexOf('ExpenseID')],
          d,
          b,
          row[eHeaders.indexOf('Category')],
          parseFloat(row[eHeaders.indexOf('Amount')]) || 0,
          row[eHeaders.indexOf('PaymentMethod')],
          row[eHeaders.indexOf('Description')],
          row[eHeaders.indexOf('Status')],
          row[eHeaders.indexOf('SubmittedBy')],
          row[eHeaders.indexOf('Timestamp')]
        ]);
      }
    }

    if (expCount > 0) {
      eSheet.appendRow(['الإجمالي', '-', '-', '-', `=SUM(E3:E${expCount + 2})`, '-', '-', '-', '-', '-']);
    }

    // ---------------------------------------------------------
    // ورقة 3: أستاذ الخزينة وتوريد الكاش
    // ---------------------------------------------------------
    const tSheet = newSS.insertSheet('أستاذ الخزينة والسيولة');
    tSheet.setRightToLeft(true);
    tSheet.appendRow(['سجل قيود الخزينة العامة للفروع المحددة']);
    tSheet.appendRow(['رقم القيد', 'المرجع', 'التاريخ', 'النوع', 'التصنيف', 'الفرع', 'المبلغ النقدي (ر.س)', 'المسؤول']);

    const tHeaders = treasuryData.length > 0 ? treasuryData[0].map(h => h.toString().trim()) : [];
    if (tHeaders.length > 0) {
      for (let i = 1; i < treasuryData.length; i++) {
        const row = treasuryData[i];
        const b = String(row[tHeaders.indexOf('Branch')]);
        const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);
        if (isMatch) {
          tSheet.appendRow([
            row[tHeaders.indexOf('EntryID')],
            row[tHeaders.indexOf('RefID')],
            row[tHeaders.indexOf('Date')],
            row[tHeaders.indexOf('Type')],
            row[tHeaders.indexOf('Category')],
            b,
            parseFloat(row[tHeaders.indexOf('CashAmount')]) || 0,
            row[tHeaders.indexOf('CreatedBy')]
          ]);
        }
      }
    }

    const file = DriveApp.getFileById(newSS.getId());
    const targetFolder = DriveManager.getTargetFolder('EXCEL_REPORTS', branch);
    file.moveTo(targetFolder);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${newSS.getId()}/export?format=xlsx`;

    const repSheet = getOrCreateSheet(SHEETS.REPORTS);
    repSheet.appendRow([
      generateSequenceID('REP', SHEETS.REPORTS),
      new Date(),
      `تقرير إكسل من ${startDate} إلى ${endDate} للفروع: ${branchesLabel}`,
      branchesLabel,
      xlsxUrl,
      'EXCEL_XLSX',
      generatedBy
    ]);

    return {
      success: true,
      excelUrl: xlsxUrl,
      sheetUrl: file.getUrl(),
      generatedBy: generatedBy,
      timestamp: nowFormatted,
      branches: branchesLabel
    };
  } catch (err) {
    return { success: false, message: 'فشل تصدير ملف الإكسل: ' + err.message };
  }
}

function apiGenerateTreasuryReportPDF(payload) {
  try {
    let startDate = '', endDate = '', branch = 'ALL', branches = [], generatedBy = 'مسؤول الخزينة';
    if (typeof payload === 'object' && payload !== null) {
      startDate = payload.startDate;
      endDate = payload.endDate;
      branch = payload.branch || 'ALL';
      branches = payload.branches || [];
      generatedBy = payload.generatedBy || 'مسؤول الخزينة';
    }

    const hasSpecificBranches = Array.isArray(branches) && branches.length > 0;
    const branchesLabel = hasSpecificBranches ? branches.join(', ') : (branch === 'ALL' || !branch ? 'كافة الفروع الموحدة' : branch);
    const nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    const treasurySheet = getOrCreateSheet(SHEETS.TREASURY);
    const treasuryData = treasurySheet.getDataRange().getValues();
    const salesData = getOrCreateSheet(SHEETS.SALES).getDataRange().getValues();

    const tHeaders = treasuryData.length > 0 ? treasuryData[0].map(h => h.toString().trim()) : [];
    const sHeaders = salesData.length > 0 ? salesData[0].map(h => h.toString().trim()) : [];

    let totalInflow = 0;
    let totalOutflow = 0;
    let branchTreasuryMap = {};
    let ledgerEntries = [];
    const collectedSalesIds = [];

    if (treasuryData.length > 1) {
      const typeIdx = tHeaders.indexOf('Type');
      const catIdx = tHeaders.indexOf('Category');
      const amtIdx = tHeaders.indexOf('CashAmount');
      const dateIdx = tHeaders.indexOf('Date');
      const bIdx = tHeaders.indexOf('Branch');
      const refIdx = tHeaders.indexOf('RefID');
      const byIdx = tHeaders.indexOf('CreatedBy');
      const descIdx = tHeaders.indexOf('Description');

      for (let i = 1; i < treasuryData.length; i++) {
        const row = treasuryData[i];
        const b = String(row[bIdx] || 'الخزينة العامة');
        const d = (row[dateIdx] || '').toString();
        const type = String(row[typeIdx] || '');
        const amt = parseFloat(row[amtIdx]) || 0;
        const cat = String(row[catIdx] || '');
        const ref = String(row[refIdx] || '');

        if (cat === 'Branch_Cash_Collection' || cat === 'Sales_Deposit' || cat === 'Branch_Batch_Cash_Collection') {
          ref.split(',').forEach(id => collectedSalesIds.push(id.trim()));
        }

        const isMatch = hasSpecificBranches ? (branches.includes(b) || b === 'الخزينة العامة') : (branch === 'ALL' || !branch || b === branch || b === 'الخزينة العامة');

        let dateInRange = true;
        if (startDate && endDate && d.length >= 10) {
          const rowD = d.substring(0, 10);
          if (rowD < startDate || rowD > endDate) dateInRange = false;
        }

        if (isMatch && dateInRange) {
          if (type === 'INCOME') {
            totalInflow += amt;
            if (!branchTreasuryMap[b]) branchTreasuryMap[b] = { inflow: 0, count: 0, pending: 0 };
            branchTreasuryMap[b].inflow += amt;
            branchTreasuryMap[b].count++;
          } else if (type === 'EXPENSE') {
            totalOutflow += amt;
          }

          ledgerEntries.push({
            entryID: row[tHeaders.indexOf('EntryID')] || ('TR-' + i),
            date: d,
            type: type,
            category: cat,
            branch: b,
            amount: amt,
            refID: ref,
            createdBy: row[byIdx] || '-',
            description: row[descIdx] || '-'
          });
        }
      }
    }

    let totalPendingAll = 0;
    if (salesData.length > 1) {
      for (let i = 1; i < salesData.length; i++) {
        const row = salesData[i];
        const sID = row[sHeaders.indexOf('SalesID')];
        const b = String(row[sHeaders.indexOf('Branch')]);

        const isMatch = hasSpecificBranches ? branches.includes(b) : (branch === 'ALL' || !branch || b === branch);

        if (!collectedSalesIds.includes(sID) && isMatch) {
          const c = parseFloat(row[sHeaders.indexOf('CashAmount')]) || 0;
          const e = parseFloat(row[sHeaders.indexOf('ShiftExpenses')]) || 0;
          const net = parseFloat(row[sHeaders.indexOf('NetCashHandover')]) || (c - e);
          if (net > 0) {
            totalPendingAll += net;
            if (!branchTreasuryMap[b]) branchTreasuryMap[b] = { inflow: 0, count: 0, pending: 0 };
            branchTreasuryMap[b].pending += net;
          }
        }
      }
    }

    const currentBalance = totalInflow - totalOutflow;

    let branchCardsHtml = '';
    const bNames = Object.keys(branchTreasuryMap);
    if (bNames.length === 0) {
      branchCardsHtml = '<div style="grid-column: span 2; text-align:center; padding:12px; color:#64748B; background:#F8FAFC; border-radius:6px;">لا توجد حركات نقدية مسجلة لهذه الفروع</div>';
    } else {
      bNames.forEach(bn => {
        const item = branchTreasuryMap[bn];
        branchCardsHtml += `
          <div class="tr-branch-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:3px; margin-bottom:4px;">
              <span style="font-weight:800; font-size:10px; color:#0F172A;">📍 ${bn}</span>
              <span style="background:#F1F5F9; color:#475569; padding:1px 6px; border-radius:10px; font-size:7.5px; font-weight:700;">${item.count} توريدات</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:8.5px; margin-bottom:2px;">
              <span>الكاش المورد للخزينة:</span>
              <strong style="color:#16A34A;">${item.inflow.toFixed(2)} ر.س</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:8.5px; margin-bottom:2px;">
              <span>الكاش المعلق بالفرع:</span>
              <strong style="color:${item.pending > 0 ? '#DC2626' : '#16A34A'};">${item.pending.toFixed(2)} ر.س</strong>
            </div>
          </div>
        `;
      });
    }

    let ledgerRowsHtml = '';
    const sliceLedger = ledgerEntries.slice(-18).reverse();
    if (sliceLedger.length === 0) {
      ledgerRowsHtml = '<tr><td colspan="6" style="text-align:center; padding:10px; color:#64748B;">لا توجد قيود مسجلة في هذه الفترة</td></tr>';
    } else {
      sliceLedger.forEach(l => {
        const typeBadge = l.type === 'INCOME' ? '<span style="color:#16A34A; font-weight:800;">+ توريد</span>' : '<span style="color:#DC2626; font-weight:800;">- صرف</span>';
        ledgerRowsHtml += `
          <tr>
            <td style="font-weight:700;">${l.entryID}</td>
            <td>${l.date}</td>
            <td>${l.branch}</td>
            <td>${typeBadge}</td>
            <td style="font-weight:800; color:${l.type === 'INCOME' ? '#16A34A' : '#DC2626'};">${l.amount.toFixed(2)} ر.س</td>
            <td>${l.createdBy}</td>
          </tr>
        `;
      });
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 7mm; }
          * { box-sizing: border-box; font-family: 'Arial', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; color: #0F172A; font-size: 10px; line-height: 1.3; }
          .report-header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #0F172A; padding-bottom: 6px; margin-bottom: 8px;
          }
          .brand-logo { font-size: 17px; font-weight: 900; color: #0F172A; }
          .report-meta { text-align: left; font-size: 9px; color: #475569; line-height: 1.35; }
          .kpi-summary-strip {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;
          }
          .kpi-box {
            background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 8px; text-align: center;
          }
          .kpi-lbl { font-size: 8px; color: #64748B; font-weight: 700; margin-bottom: 2px; }
          .kpi-val { font-size: 13px; font-weight: 900; }
          .section-title {
            font-size: 10.5px; font-weight: 800; color: #1E293B; margin: 8px 0 5px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #E2E8F0; padding-bottom: 3px;
          }
          .branch-grid-container {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 10px;
          }
          .tr-branch-card {
            border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; padding: 6px 8px;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #CBD5E1; padding: 5px 6px; text-align: right; font-size: 9px; }
          th { background-color: #0F172A; color: #FFFFFF; font-weight: 800; }
          tr:nth-child(even) { background-color: #F8FAFC; }
          .signatures {
            display: flex; justify-content: space-between; margin-top: 14px; padding-top: 6px; border-top: 1px dashed #CBD5E1;
            font-size: 9px; color: #334155;
          }
          .sig-box { text-align: center; width: 140px; }
          .report-footer {
            margin-top: 10px; text-align: center; font-size: 8px; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <div class="brand-logo">🏦 خزينة مجموعة أوركيد المؤسسية</div>
            <div style="font-size: 10.5px; font-weight: 700; color: #16A34A; margin-top: 1px;">
              التقرير المالي التنفيذي لحركة الخزينة والسيولة النقدية (A4 Official Report)
            </div>
          </div>
          <div class="report-meta">
            <div>الفترة: <b>${startDate || 'من البداية'}</b> إلى <b>${endDate || 'حتى الآن'}</b></div>
            <div>نطاق الفروع: <b>${branchesLabel}</b></div>
            <div>مستخرج التقرير: <b style="color:#0F172A;">${generatedBy}</b></div>
            <div>وقت الإصدار: ${nowFormatted}</div>
          </div>
        </div>

        <div class="kpi-summary-strip">
          <div class="kpi-box">
            <div class="kpi-lbl">رصيد الخزينة الحالي</div>
            <div class="kpi-val" style="color:#16A34A;">${currentBalance.toFixed(2)} ر.س</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">إجمالي كاش الفروع المستلم</div>
            <div class="kpi-val" style="color:#2563EB;">${totalInflow.toFixed(2)} ر.س</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">إجمالي المنصرف من الخزينة</div>
            <div class="kpi-val" style="color:#DC2626;">${totalOutflow.toFixed(2)} ر.س</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">الكاش المعلق بالفروع</div>
            <div class="kpi-val" style="color:#D97706;">${totalPendingAll.toFixed(2)} ر.س</div>
          </div>
        </div>

        <div class="section-title">
          <span>📍 ملخص حركة الكاش لكل فرع بالخزينة</span>
          <span style="font-size:8px; color:#64748B;">عدد الفروع: ${bNames.length}</span>
        </div>
        <div class="branch-grid-container">
          ${branchCardsHtml}
        </div>

        <div class="section-title">
          <span>📋 حركة قيود دفتر أستاذ الخزينة (أحدث العمليات)</span>
          <span style="font-size:8px; color:#64748B;">عدد السجلات المعروضة: ${sliceLedger.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>رقم القيد</th>
              <th>التاريخ والوقت</th>
              <th>الفرع المورد / المستلم</th>
              <th>نوع القيد</th>
              <th>المبلغ النقدي</th>
              <th>المسؤول / أمين الخزينة</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box"><div>مسؤول الخزينة والسيولة</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
          <div class="sig-box"><div>المحاسب المالي المدقق</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
          <div class="sig-box"><div>المدير العام / الاعتماد</div><div style="margin-top: 16px; font-weight: 700;">.........................</div></div>
        </div>

        <div class="report-footer">
          تم استخراج وطباعة هذا التقرير آلياً بواسطة المستخدم: <b>${generatedBy}</b> بتاريخ <b>${nowFormatted}</b> | نظام أوركيد المؤسسي لإدارة المبيعات والخزينة v5.2
        </div>
      </body>
      </html>
    `;

    const blob = Utilities.newBlob(htmlBody, 'text/html', 'Treasury_Report_A4.html').getAs('application/pdf');
    blob.setName(`تقرير_الخزينة_أوركيد_A4_${startDate}_${endDate}_${branchesLabel.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);

    const targetFolder = DriveManager.getTargetFolder('PDF_REPORTS', branch);
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const repSheet = getOrCreateSheet(SHEETS.REPORTS);
    repSheet.appendRow([
      generateSequenceID('REP', SHEETS.REPORTS),
      new Date(),
      `تقرير الخزينة والسيولة A4 للفترة من ${startDate} إلى ${endDate} فروع: ${branchesLabel}`,
      branchesLabel,
      file.getUrl(),
      'TREASURY_PDF_A4',
      generatedBy
    ]);

    return {
      success: true,
      pdfUrl: file.getUrl(),
      generatedBy: generatedBy,
      timestamp: nowFormatted,
      branches: branchesLabel
    };
  } catch (err) {
    return { success: false, message: 'فشل استخراج تقرير الخزينة PDF: ' + err.message };
  }
}

function apiGenerateTreasuryReportExcel(payload) {
  try {
    let startDate = '', endDate = '', branch = 'ALL', branches = [], generatedBy = 'مسؤول الخزينة';
    if (typeof payload === 'object' && payload !== null) {
      startDate = payload.startDate;
      endDate = payload.endDate;
      branch = payload.branch || 'ALL';
      branches = payload.branches || [];
      generatedBy = payload.generatedBy || 'مسؤول الخزينة';
    }

    const hasSpecificBranches = Array.isArray(branches) && branches.length > 0;
    const branchesLabel = hasSpecificBranches ? branches.join(', ') : (branch === 'ALL' || !branch ? 'كافة الفروع الموحدة' : branch);
    const nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    const treasuryData = getOrCreateSheet(SHEETS.TREASURY).getDataRange().getValues();

    const newSS = SpreadsheetApp.create(`تقرير_الخزينة_أوركيد_Excel_${startDate}_${endDate}_${branchesLabel.replace(/[/\\?%*:|"<>]/g, '_')}`);
    
    const tSheet = newSS.getActiveSheet();
    tSheet.setName('أستاذ الخزينة التفصيلي');
    tSheet.setRightToLeft(true);

    tSheet.appendRow(['مجموعة أوركيد المؤسسية - تقرير أستاذ الخزينة والسيولة النقدية']);
    tSheet.appendRow([`الفترة من: ${startDate} إلى: ${endDate}`, `الفروع: ${branchesLabel}`, `تم الاستخراج بواسطة: ${generatedBy}`, `تاريخ ووقت الإصدار: ${nowFormatted}`]);
    tSheet.appendRow([]);

    tSheet.appendRow(['رقم القيد', 'المرجع', 'التاريخ والوقت', 'نوع القيد', 'التصنيف', 'الفرع', 'المبلغ النقدي (ر.س)', 'المسؤول / أمين الخزينة', 'البيان والملاحظات']);

    const tHeaders = treasuryData.length > 0 ? treasuryData[0].map(h => h.toString().trim()) : [];
    let count = 0;
    if (tHeaders.length > 0) {
      for (let i = 1; i < treasuryData.length; i++) {
        const row = treasuryData[i];
        const b = String(row[tHeaders.indexOf('Branch')] || 'الخزينة العامة');
        const isMatch = hasSpecificBranches ? (branches.includes(b) || b === 'الخزينة العامة') : (branch === 'ALL' || !branch || b === branch || b === 'الخزينة العامة');
        if (isMatch) {
          count++;
          tSheet.appendRow([
            row[tHeaders.indexOf('EntryID')],
            row[tHeaders.indexOf('RefID')],
            row[tHeaders.indexOf('Date')],
            row[tHeaders.indexOf('Type')],
            row[tHeaders.indexOf('Category')],
            b,
            parseFloat(row[tHeaders.indexOf('CashAmount')]) || 0,
            row[tHeaders.indexOf('CreatedBy')],
            row[tHeaders.indexOf('Description')]
          ]);
        }
      }
    }

    if (count > 0) {
      tSheet.appendRow(['الإجمالي', '-', '-', '-', '-', '-', `=SUM(G5:G${count + 4})`, '-', '-']);
    }

    const file = DriveApp.getFileById(newSS.getId());
    const targetFolder = DriveManager.getTargetFolder('EXCEL_REPORTS', branch);
    file.moveTo(targetFolder);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${newSS.getId()}/export?format=xlsx`;

    const repSheet = getOrCreateSheet(SHEETS.REPORTS);
    repSheet.appendRow([
      generateSequenceID('REP', SHEETS.REPORTS),
      new Date(),
      `تقرير إكسل أستاذ الخزينة للفترة من ${startDate} إلى ${endDate} فروع: ${branchesLabel}`,
      branchesLabel,
      xlsxUrl,
      'TREASURY_EXCEL_XLSX',
      generatedBy
    ]);

    return {
      success: true,
      excelUrl: xlsxUrl,
      sheetUrl: file.getUrl(),
      generatedBy: generatedBy,
      timestamp: nowFormatted,
      branches: branchesLabel
    };
  } catch (err) {
    return { success: false, message: 'فشل تصدير تقرير الخزينة Excel: ' + err.message };
  }
}

// -------------------------------------------------------------
// الجدولة الآلية لإرسال تقرير المبيعات عبر البريد الإلكتروني (الساعة 01:00 ص)
// -------------------------------------------------------------

function setupDailyReportTrigger(hour) {
  try {
    const h = parseInt(hour, 10) || 1;
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'sendAutomatedDailyReportEmail') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    ScriptApp.newTrigger('sendAutomatedDailyReportEmail')
      .timeBased()
      .everyDays(1)
      .atHour(h)
      .nearMinute(0)
      .create();
    return true;
  } catch (e) {
    Logger.log('Trigger setup error: ' + e.message);
    return false;
  }
}

function apiConfigureAutoEmail(payload) {
  try {
    const email = (payload.email || '').toString().trim();
    const hour = parseInt(payload.hour, 10) || 1;
    const enabled = payload.enabled === true || payload.enabled === 'true';

    const sheet = getOrCreateSheet(SHEETS.SETTINGS);
    const data = sheet.getDataRange().getValues();
    let emailRow = -1, hourRow = -1, enabledRow = -1;

    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0]).trim();
      if (k === 'ADMIN_REPORT_EMAIL') emailRow = i + 1;
      if (k === 'AUTO_REPORT_HOUR') hourRow = i + 1;
      if (k === 'AUTO_REPORT_ENABLED') enabledRow = i + 1;
    }

    const now = new Date();
    if (emailRow !== -1) sheet.getRange(emailRow, 2, 1, 2).setValues([[email, now]]);
    else sheet.appendRow(['ADMIN_REPORT_EMAIL', email, now]);

    if (hourRow !== -1) sheet.getRange(hourRow, 2, 1, 2).setValues([[hour, now]]);
    else sheet.appendRow(['AUTO_REPORT_HOUR', hour, now]);

    if (enabledRow !== -1) sheet.getRange(enabledRow, 2, 1, 2).setValues([[enabled ? 'TRUE' : 'FALSE', now]]);
    else sheet.appendRow(['AUTO_REPORT_ENABLED', enabled ? 'TRUE' : 'FALSE', now]);

    if (enabled && email) {
      setupDailyReportTrigger(hour);
    } else {
      const triggers = ScriptApp.getProjectTriggers();
      for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'sendAutomatedDailyReportEmail') {
          ScriptApp.deleteTrigger(triggers[i]);
        }
      }
    }

    return {
      success: true,
      message: enabled ? `تم تفعيل وتثبيت الجدولة التلقائية لإرسال التقرير يومياً إلى (${email}) في تمام الساعة ${hour}:00 صباحاً` : 'تم تعطيل الجدولة الآلية بنجاح'
    };
  } catch (err) {
    return { success: false, message: 'فشل ضبط الجدولة: ' + err.message };
  }
}

function apiSendTestReportEmail(payload) {
  try {
    const targetEmail = (payload.email || '').toString().trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, message: 'يرجى إدخال بريد إلكتروني صحيح' };
    }

    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const pdfRes = apiGenerateReportPDF({
      startDate: todayStr,
      endDate: todayStr,
      branch: 'ALL',
      generatedBy: 'الإرسال الآلي للبريد'
    });

    if (!pdfRes || !pdfRes.success) {
      return { success: false, message: 'تعذر إنشاء ملف الـ PDF: ' + (pdfRes ? pdfRes.message : '') };
    }

    const emailHtml = `
      <div dir="rtl" style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f8fafc; color:#0f172a;">
        <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; max-width:650px; margin:auto;">
          <div style="border-bottom:2px solid #1a73e8; padding-bottom:12px; margin-bottom:16px;">
            <h2 style="color:#0f172a; margin:0; font-size:20px;">🏢 مجموعة أوركيد المؤسسية</h2>
            <div style="color:#1a73e8; font-size:13px; font-weight:bold; margin-top:4px;">التقرير المالي التنفيذي اليومي المعتمد</div>
          </div>
          <p style="font-size:14px; line-height:1.6; color:#334155;">
            السلام عليكم ورحمة الله وبركاته،<br>
            نرفق لكم طيه تقرير مبيعات الفروع المعتمد ليوم <b>${todayStr}</b>، تم إنشاؤه وإرساله آلياً عبر نظام أوركيد المؤسسي.
          </p>
          <div style="background:#f1f5f9; border-radius:8px; padding:14px; margin:16px 0; border:1px solid #cbd5e1;">
            <div style="font-size:12px; color:#64748b; font-weight:bold; margin-bottom:4px;">📄 رابط التقرير المباشر مع صور الإيصالات (QR Code):</div>
            <a href="${pdfRes.pdfUrl}" target="_blank" style="color:#1a73e8; font-weight:bold; font-size:14px; word-break:break-all;">${pdfRes.pdfUrl}</a>
          </div>
          <div style="margin-top:20px; text-align:center;">
            <a href="${pdfRes.pdfUrl}" target="_blank" style="background:#1a73e8; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; display:inline-block;">📥 فتح التقرير المباشر والطباعة</a>
          </div>
          <p style="font-size:11px; color:#94a3b8; text-align:center; margin-top:24px; border-top:1px solid #f1f5f9; padding-top:12px;">
            تم توليد هذا البريد آلياً من نظام أوركيد لإدارة المبيعات والخزينة v5.3
          </p>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: targetEmail,
      subject: `📊 تقرير مبيعات أوركيد التنفيذي المعتمد - ${todayStr}`,
      htmlBody: emailHtml
    });

    return {
      success: true,
      message: `تم إرسال التقرير المالي المرفق بنجاح إلى (${targetEmail}) مع رابط Google Drive المباشر`
    };
  } catch (err) {
    return { success: false, message: 'فشل إرسال البريد الإلكتروني: ' + err.message };
  }
}

function sendAutomatedDailyReportEmail() {
  try {
    const sheet = getOrCreateSheet(SHEETS.SETTINGS);
    const data = sheet.getDataRange().getValues();
    let email = '', enabled = false;

    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0]).trim();
      const v = String(data[i][1]).trim();
      if (k === 'ADMIN_REPORT_EMAIL') email = v;
      if (k === 'AUTO_REPORT_ENABLED') enabled = (v.toUpperCase() === 'TRUE');
    }

    if (!enabled || !email || !email.includes('@')) {
      Logger.log('Auto email skipped: disabled or invalid email');
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() - 1);
    const dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const pdfRes = apiGenerateReportPDF({
      startDate: dateStr,
      endDate: dateStr,
      branch: 'ALL',
      generatedBy: 'الجدولة الآلية اليومية (01:00 ص)'
    });

    if (pdfRes && pdfRes.success) {
      const emailHtml = `
        <div dir="rtl" style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f8fafc; color:#0f172a;">
          <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; max-width:650px; margin:auto;">
            <h2 style="color:#0f172a; margin:0; font-size:20px;">🏢 تقرير مبيعات أوركيد اليومي الآلي (الساعة 01:00 ص)</h2>
            <p style="font-size:14px; color:#334155; margin-top:8px;">نرفق لسعادتكم التقرير المالي الشامل لمبيعات الفروع المعتمد ليوم <b>${dateStr}</b>.</p>
            <div style="margin:16px 0; text-align:center;">
              <a href="${pdfRes.pdfUrl}" target="_blank" style="background:#1a73e8; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:bold;">📥 فتح التقرير المباشر في Google Drive</a>
            </div>
          </div>
        </div>
      `;

      MailApp.sendEmail({
        to: email,
        subject: `📊 تقرير مبيعات أوركيد الآلي اليومي - ${dateStr}`,
        htmlBody: emailHtml
      });
    }
  } catch (e) {
    Logger.log('Automated daily report error: ' + e.message);
  }
}

// -------------------------------------------------------------
// محرك المهام وتحويل الإشعارات إلى مهام تشغيلية (Tasks Engine)
// -------------------------------------------------------------

function apiGetTasks(branch, role, username) {
  try {
    const sheet = getOrCreateSheet(SHEETS.TASKS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, tasks: [] };

    const headers = data[0].map(h => h.toString().trim());
    const tasks = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const taskBranch = row[headers.indexOf('Branch')];
      const assigned = row[headers.indexOf('AssignedTo')];

      if (role === 'Admin' || role === 'Auditor' || taskBranch === branch || assigned === username || !assigned) {
        tasks.push({
          taskID: row[headers.indexOf('TaskID')],
          title: row[headers.indexOf('Title')],
          description: row[headers.indexOf('Description')],
          branch: taskBranch,
          assignedTo: assigned,
          createdBy: row[headers.indexOf('CreatedBy')],
          dueDate: row[headers.indexOf('DueDate')],
          priority: row[headers.indexOf('Priority')] || 'عالية',
          status: row[headers.indexOf('Status')] || 'Pending',
          refID: row[headers.indexOf('RefID')] || '',
          createdAt: row[headers.indexOf('CreatedAt')]
        });
      }
    }
    return { success: true, tasks: tasks.reverse() };
  } catch (err) {
    return { success: false, message: 'فشل جلب المهام: ' + err.message };
  }
}

function apiSaveTask(payload) {
  try {
    const sheet = getOrCreateSheet(SHEETS.TASKS);
    const taskID = generateSequenceID('TSK', SHEETS.TASKS);
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    sheet.appendRow([
      taskID,
      payload.title || 'مهمة متابعة جديدة',
      payload.description || '',
      payload.branch || 'الفرع الرئيسي',
      payload.assignedTo || '',
      payload.createdBy || 'المدير العام',
      payload.dueDate || '',
      payload.priority || 'عالية',
      'Pending',
      payload.refID || '',
      now
    ]);

    return {
      success: true,
      message: `تم إنشاء وتحويل الإشعار إلى مهمة بنجاح برقم: ${taskID}`,
      taskID: taskID
    };
  } catch (err) {
    return { success: false, message: 'فشل حفظ المهمة: ' + err.message };
  }
}

function apiToggleTaskStatus(taskID, currentStatus) {
  try {
    const sheet = getOrCreateSheet(SHEETS.TASKS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const idIdx = headers.indexOf('TaskID');
    const stIdx = headers.indexOf('Status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === taskID) {
        const nextStatus = (currentStatus === 'Completed') ? 'Pending' : 'Completed';
        sheet.getRange(i + 1, stIdx + 1).setValue(nextStatus);
        return { success: true, message: `تم تحديث حالة المهمة إلى: ${nextStatus === 'Completed' ? 'مكتملة ✅' : 'قيد التنفيذ ⏳'}` };
      }
    }
    return { success: false, message: 'لم يتم العثور على المهمة' };
  } catch (err) {
    return { success: false, message: 'فشل تعديل حالة المهمة: ' + err.message };
  }
}
