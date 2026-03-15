const http = require("http");
const https = require("https");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

const REMINDER_DELAY_MS = 60 * 1000;
const MAX_REMINDER_ATTEMPTS = 3;

const waitingForManagerPassword = new Set();
const managers = new Set();
const userStates = new Map();
const tasks = [];
const executors = new Map();
const managerContacts = new Map();
const taskReminderState = new Map();

const SPECIALIZATION_OPTIONS = ["Статика", "Моушен", "Лендинги"];
const DAY_OPTIONS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
];
const PAYMENT_OPTIONS = ["Самозанятость", "ИП", "Переводом"];

function generateExecutorCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "EX-";

  for (let i = 0; i < 6; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return result;
}

async function ensureExecutorCodeForProfile(profile) {
  if (profile?.executorCode) {
    return profile;
  }

  let executorCode = generateExecutorCode();
  while (Array.from(executors.values()).some(item => item !== profile && item.executorCode === executorCode)) {
    executorCode = generateExecutorCode();
  }

  profile.executorCode = executorCode;
  profile.updatedAt = new Date().toISOString();

  if (profile.telegramId) {
    await saveExecutorToDb(profile);
    executors.set(profile.telegramId, profile);
  }

  return profile;
}


const DATE_OPTION_VALUES = {
  "Сегодня": 0,
  "Завтра": 1,
  "Послезавтра": 2
};

const TIME_OPTIONS = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

let pool = null;

/* -------------------- DB -------------------- */

function createDbPool() {
  if (!DATABASE_URL) {
    console.log("DATABASE_URL is missing");
    return null;
  }

  return new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });
}

async function runQuery(text, params = []) {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }
  return pool.query(text, params);
}

async function initDb() {
  pool = createDbPool();

  if (!pool) {
    console.log("Postgres is disabled because DATABASE_URL is missing");
    return;
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS manager_contacts (
      telegram_id BIGINT PRIMARY KEY,
      contact TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS executors (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      telegram_contact TEXT NOT NULL,
      executor_code TEXT UNIQUE,
      full_name TEXT,
      specializations JSONB NOT NULL DEFAULT '[]'::jsonb,
      verified_specializations JSONB NOT NULL DEFAULT '[]'::jsonb,
      portfolio TEXT,
      payment_method TEXT,
      payment_details JSONB,
      payment_file JSONB,
      unavailable_days JSONB NOT NULL DEFAULT '[]'::jsonb,
      unavailable_time TEXT,
      status TEXT,
      approved_by TEXT,
      approved_by_manager_id BIGINT,
      review_accuracy INTEGER,
      review_speed INTEGER,
      review_aesthetics INTEGER,
      base_rating INTEGER,
      newcomer_boost INTEGER,
      rating INTEGER,
      response_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await runQuery(`
    ALTER TABLE executors
    ADD COLUMN IF NOT EXISTS executor_code TEXT
  `);

  await runQuery(`
    ALTER TABLE executors
    ADD COLUMN IF NOT EXISTS completed_orders INTEGER NOT NULL DEFAULT 0
  `);

  await runQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_executors_executor_code
    ON executors(executor_code)
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      manager_id BIGINT NOT NULL,
      manager_username TEXT,
      manager_contact TEXT NOT NULL,
      title TEXT,
      categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      deadline_date TEXT,
      deadline_time TEXT,
      deadline TEXT,
      price TEXT,
      brief JSONB,
      sources JSONB,
      refs_data JSONB,
      comment TEXT,
      status TEXT,
      published_at TIMESTAMPTZ,
      assigned_executor_id BIGINT,
      assigned_executor_name TEXT,
      assigned_executor_contact TEXT,
      stage_materials JSONB NOT NULL DEFAULT '{}'::jsonb,
      timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS brief JSONB
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS sources JSONB
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS refs_data JSONB
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS comment TEXT
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assigned_executor_id BIGINT
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assigned_executor_name TEXT
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assigned_executor_contact TEXT
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS stage_materials JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await runQuery(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS task_responses (
      id BIGSERIAL PRIMARY KEY,
      task_id BIGINT NOT NULL,
      executor_id BIGINT NOT NULL,
      executor_name TEXT NOT NULL,
      executor_contact TEXT NOT NULL,
      decision TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_task_responses_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
    )
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_task_responses_task_id
    ON task_responses(task_id)
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_tasks_manager_id
    ON tasks(manager_id)
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_executor_id
    ON tasks(assigned_executor_id)
  `);

  console.log("Postgres connected and tables initialized");
}

async function loadManagerContactsFromDb() {
  const result = await runQuery(`
    SELECT telegram_id, contact
    FROM manager_contacts
  `);

  managerContacts.clear();

  for (const row of result.rows) {
    managerContacts.set(Number(row.telegram_id), row.contact);
  }
}

async function loadExecutorsFromDb() {
  const result = await runQuery(`
    SELECT *
    FROM executors
  `);

  executors.clear();

  for (const row of result.rows) {
    executors.set(Number(row.telegram_id), {
      telegramId: Number(row.telegram_id),
      executorCode: row.executor_code,
      username: row.username,
      telegramContact: row.telegram_contact,
      fullName: row.full_name,
      specializations: row.specializations || [],
      verifiedSpecializations: row.verified_specializations || [],
      portfolio: row.portfolio,
      paymentMethod: row.payment_method,
      paymentDetails: row.payment_details,
      paymentFile: row.payment_file,
      unavailableDays: row.unavailable_days || [],
      unavailableTime: row.unavailable_time || "",
      status: row.status,
      approvedBy: row.approved_by,
      approvedByManagerId: row.approved_by_manager_id ? Number(row.approved_by_manager_id) : null,
      reviewAccuracy: row.review_accuracy,
      reviewSpeed: row.review_speed,
      reviewAesthetics: row.review_aesthetics,
      baseRating: row.base_rating,
      newcomerBoost: row.newcomer_boost,
      rating: row.rating,
      completedOrders: row.completed_orders || 0,
      responseHistory: row.response_history || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

async function loadTasksFromDb() {
  const tasksResult = await runQuery(`
    SELECT *
    FROM tasks
    ORDER BY id ASC
  `);

  const responsesResult = await runQuery(`
    SELECT *
    FROM task_responses
    ORDER BY id ASC
  `);

  const responsesByTaskId = new Map();

  for (const row of responsesResult.rows) {
    const taskId = Number(row.task_id);
    if (!responsesByTaskId.has(taskId)) {
      responsesByTaskId.set(taskId, []);
    }

    responsesByTaskId.get(taskId).push({
      executorId: Number(row.executor_id),
      executorName: row.executor_name,
      executorContact: row.executor_contact,
      decision: row.decision,
      createdAt: row.created_at
    });
  }

  tasks.length = 0;

  for (const row of tasksResult.rows) {
    tasks.push({
      id: Number(row.id),
      createdAt: row.created_at,
      managerId: Number(row.manager_id),
      managerUsername: row.manager_username,
      managerContact: row.manager_contact,
      title: row.title,
      categories: row.categories || [],
      deadlineDate: row.deadline_date || "",
      deadlineTime: row.deadline_time || "",
      deadline: row.deadline || "",
      price: row.price || "",
      brief: row.brief,
      sources: row.sources,
      refs_data: row.refs_data,
      comment: row.comment,
      status: row.status,
      responses: responsesByTaskId.get(Number(row.id)) || [],
      publishedAt: row.published_at,
      assignedExecutorId: row.assigned_executor_id ? Number(row.assigned_executor_id) : null,
      assignedExecutorName: row.assigned_executor_name,
      assignedExecutorContact: row.assigned_executor_contact,
      stageMaterials: row.stage_materials || {
        thirty: null,
        sixty: null,
        final: null
      },
      timeline: row.timeline || {
        assignedAt: null,
        briefReadAt: null,
        inWorkAt: null,
        shown30At: null,
        shown60At: null,
        submittedAt: null,
        approvedAt: null,
        returnedForFixesAt: null,
        unpaidAt: null,
        paidAt: null
      }
    });
  }
}

async function loadAllDataFromDb() {
  await loadManagerContactsFromDb();
  await loadExecutorsFromDb();
  await loadTasksFromDb();
  console.log("Data loaded from Postgres");
}

async function saveManagerContactToDb(telegramId, contact) {
  await runQuery(`
    INSERT INTO manager_contacts (telegram_id, contact, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    ON CONFLICT (telegram_id)
    DO UPDATE SET
      contact = EXCLUDED.contact,
      updated_at = NOW()
  `, [telegramId, contact]);
}

async function saveExecutorToDb(profile) {
  await runQuery(`
    INSERT INTO executors (
      telegram_id,
      username,
      telegram_contact,
      executor_code,
      full_name,
      specializations,
      verified_specializations,
      portfolio,
      payment_method,
      payment_details,
      payment_file,
      unavailable_days,
      unavailable_time,
      status,
      approved_by,
      approved_by_manager_id,
      review_accuracy,
      review_speed,
      review_aesthetics,
      base_rating,
      newcomer_boost,
      rating,
      completed_orders,
      response_history,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb,
      $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24::jsonb, $25, NOW()
    )
    ON CONFLICT (telegram_id)
    DO UPDATE SET
      username = EXCLUDED.username,
      telegram_contact = EXCLUDED.telegram_contact,
      executor_code = EXCLUDED.executor_code,
      full_name = EXCLUDED.full_name,
      specializations = EXCLUDED.specializations,
      verified_specializations = EXCLUDED.verified_specializations,
      portfolio = EXCLUDED.portfolio,
      payment_method = EXCLUDED.payment_method,
      payment_details = EXCLUDED.payment_details,
      payment_file = EXCLUDED.payment_file,
      unavailable_days = EXCLUDED.unavailable_days,
      unavailable_time = EXCLUDED.unavailable_time,
      status = EXCLUDED.status,
      approved_by = EXCLUDED.approved_by,
      approved_by_manager_id = EXCLUDED.approved_by_manager_id,
      review_accuracy = EXCLUDED.review_accuracy,
      review_speed = EXCLUDED.review_speed,
      review_aesthetics = EXCLUDED.review_aesthetics,
      base_rating = EXCLUDED.base_rating,
      newcomer_boost = EXCLUDED.newcomer_boost,
      rating = EXCLUDED.rating,
      completed_orders = EXCLUDED.completed_orders,
      response_history = EXCLUDED.response_history,
      updated_at = NOW()
  `, [
    profile.telegramId,
    profile.username || null,
    profile.telegramContact,
    profile.executorCode || null,
    profile.fullName || null,
    JSON.stringify(profile.specializations || []),
    JSON.stringify(profile.verifiedSpecializations || []),
    profile.portfolio || null,
    profile.paymentMethod || null,
    profile.paymentDetails ? JSON.stringify(profile.paymentDetails) : null,
    profile.paymentFile ? JSON.stringify(profile.paymentFile) : null,
    JSON.stringify(profile.unavailableDays || []),
    profile.unavailableTime || "",
    profile.status || null,
    profile.approvedBy || null,
    profile.approvedByManagerId || null,
    profile.reviewAccuracy ?? null,
    profile.reviewSpeed ?? null,
    profile.reviewAesthetics ?? null,
    profile.baseRating ?? null,
    profile.newcomerBoost ?? null,
    profile.rating ?? null,
    profile.completedOrders ?? 0,
    JSON.stringify(profile.responseHistory || []),
    profile.createdAt || new Date().toISOString()
  ]);
}

async function saveTaskToDb(task) {
  let realId = task.id;

  if (!task.id) {
    const insertResult = await runQuery(`
      INSERT INTO tasks (
        manager_id,
        manager_username,
        manager_contact,
        title,
        categories,
        deadline_date,
        deadline_time,
        deadline,
        price,
        brief,
        sources,
        refs_data,
        comment,
        status,
        published_at,
        assigned_executor_id,
        assigned_executor_name,
        assigned_executor_contact,
        stage_materials,
        timeline,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb,
        $13, $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb, $21, NOW()
      )
      RETURNING id
    `, [
      task.managerId,
      task.managerUsername || null,
      task.managerContact,
      task.title || null,
      JSON.stringify(task.categories || []),
      task.deadlineDate || null,
      task.deadlineTime || null,
      task.deadline || null,
      task.price || null,
      task.brief ? JSON.stringify(task.brief) : null,
      task.sources ? JSON.stringify(task.sources) : null,
      task.refs_data ? JSON.stringify(task.refs_data) : null,
      task.comment || null,
      task.status || null,
      task.publishedAt || null,
      task.assignedExecutorId || null,
      task.assignedExecutorName || null,
      task.assignedExecutorContact || null,
      JSON.stringify(task.stageMaterials || {}),
      JSON.stringify(task.timeline || {}),
      task.createdAt || new Date().toISOString()
    ]);

    realId = Number(insertResult.rows[0].id);
    task.id = realId;
  } else {
    await runQuery(`
      UPDATE tasks
      SET
        manager_id = $2,
        manager_username = $3,
        manager_contact = $4,
        title = $5,
        categories = $6::jsonb,
        deadline_date = $7,
        deadline_time = $8,
        deadline = $9,
        price = $10,
        brief = $11::jsonb,
        sources = $12::jsonb,
        refs_data = $13::jsonb,
        comment = $14,
        status = $15,
        published_at = $16,
        assigned_executor_id = $17,
        assigned_executor_name = $18,
        assigned_executor_contact = $19,
        stage_materials = $20::jsonb,
        timeline = $21::jsonb,
        updated_at = NOW()
      WHERE id = $1
    `, [
      task.id,
      task.managerId,
      task.managerUsername || null,
      task.managerContact,
      task.title || null,
      JSON.stringify(task.categories || []),
      task.deadlineDate || null,
      task.deadlineTime || null,
      task.deadline || null,
      task.price || null,
      task.brief ? JSON.stringify(task.brief) : null,
      task.sources ? JSON.stringify(task.sources) : null,
      task.refs_data ? JSON.stringify(task.refs_data) : null,
      task.comment || null,
      task.status || null,
      task.publishedAt || null,
      task.assignedExecutorId || null,
      task.assignedExecutorName || null,
      task.assignedExecutorContact || null,
      JSON.stringify(task.stageMaterials || {}),
      JSON.stringify(task.timeline || {})
    ]);
  }

  await runQuery(`DELETE FROM task_responses WHERE task_id = $1`, [realId]);

  for (const response of task.responses || []) {
    await runQuery(`
      INSERT INTO task_responses (
        task_id,
        executor_id,
        executor_name,
        executor_contact,
        decision,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      realId,
      response.executorId,
      response.executorName,
      response.executorContact,
      response.decision,
      response.createdAt || new Date().toISOString()
    ]);
  }
}

/* -------------------- Telegram utils -------------------- */

function sendTelegramRequest(method, payload, callback) {
  if (!BOT_TOKEN) {
    console.log("BOT_TOKEN is missing");
    return;
  }

  const data = JSON.stringify(payload);

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/${method}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const req = https.request(options, res => {
    let body = "";

    res.on("data", chunk => {
      body += chunk.toString();
    });

    res.on("end", () => {
      console.log(`${method} response:`, body);
      if (callback) callback(body);
    });
  });

  req.on("error", error => {
    console.error(`${method} error:`, error);
  });

  req.write(data);
  req.end();
}

function sendMessage(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  sendTelegramRequest("sendMessage", payload);
}

function sendDocument(chatId, fileId, caption) {
  sendTelegramRequest("sendDocument", {
    chat_id: chatId,
    document: fileId,
    caption
  });
}

function answerCallback(callbackQueryId, text) {
  sendTelegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text
  });
}

/* -------------------- Keyboards -------------------- */

function getMainKeyboard(isManager = false, isExecutorRegistered = false) {
  if (isManager) {
    return {
      keyboard: [
        [{ text: "Создать задачу" }],
        [{ text: "Мои задачи" }],
        [{ text: "Отклики последней задачи" }],
        [{ text: "Заявки в исполнители" }],
        [{ text: "Я исполнитель" }]
      ],
      resize_keyboard: true
    };
  }

  if (isExecutorRegistered) {
    return {
      keyboard: [
        [{ text: "Моя анкета" }],
        [{ text: "Редактировать анкету" }],
        [{ text: "Новые задачи" }],
        [{ text: "Мои отклики" }],
        [{ text: "Я менеджер" }]
      ],
      resize_keyboard: true
    };
  }

  return {
    keyboard: [
      [{ text: "Я исполнитель" }],
      [{ text: "Я менеджер" }]
    ],
    resize_keyboard: true
  };
}

function getSkipKeyboard() {
  return {
    keyboard: [[{ text: "Пропустить" }]],
    resize_keyboard: true
  };
}

function getDoneKeyboard(items) {
  return {
    keyboard: [
      items.map(item => ({ text: item })),
      [{ text: "Готово" }]
    ],
    resize_keyboard: true
  };
}

function getPaymentKeyboard() {
  return {
    keyboard: [PAYMENT_OPTIONS.map(item => ({ text: item }))],
    resize_keyboard: true
  };
}

function getModerationKeyboard() {
  return {
    keyboard: [
      [{ text: "Подтвердить исполнителя" }],
      [{ text: "Отклонить исполнителя" }],
      [{ text: "Следующая заявка" }],
      [{ text: "В меню менеджера" }]
    ],
    resize_keyboard: true
  };
}

function getTaskAfterCreateKeyboard() {
  return {
    keyboard: [
      [{ text: "Опубликовать последнюю задачу" }],
      [{ text: "Отклики последней задачи" }],
      [{ text: "Мои задачи" }],
      [{ text: "В меню менеджера" }]
    ],
    resize_keyboard: true
  };
}

function getDateKeyboard() {
  return {
    keyboard: [
      [{ text: "Сегодня" }, { text: "Завтра" }, { text: "Послезавтра" }],
      [{ text: "Ввести дату вручную" }]
    ],
    resize_keyboard: true
  };
}

function getTimeKeyboard() {
  return {
    keyboard: [
      [{ text: "10:00" }, { text: "12:00" }, { text: "14:00" }],
      [{ text: "16:00" }, { text: "18:00" }, { text: "20:00" }],
      [{ text: "Ввести время вручную" }]
    ],
    resize_keyboard: true
  };
}

function getExecutorTaskActionKeyboard(task) {
  let row = null;

  if (task.status === "Назначена") {
    row = [`Действие по задаче #${task.id}: Изучил ТЗ`];
  } else if (task.status === "ТЗ изучено") {
    row = [`Действие по задаче #${task.id}: Взял в работу`];
  } else if (task.status === "Правки") {
    row = [`Действие по задаче #${task.id}: Сдать задачу`];
  }

  const keyboard = [];
  if (row) keyboard.push(row.map(text => ({ text })));
  keyboard.push([{ text: "Мои отклики" }]);
  keyboard.push([{ text: "Моя анкета" }]);

  return {
    keyboard,
    resize_keyboard: true
  };
}

function getManagerReviewTaskKeyboard(taskId) {
  return {
    keyboard: [
      [{ text: `Принять результат #${taskId}` }],
      [{ text: `Отправить на правки #${taskId}` }],
      [{ text: `Отметить не оплачена #${taskId}` }],
      [{ text: `Отметить оплачена #${taskId}` }],
      [{ text: "Мои задачи" }]
    ],
    resize_keyboard: true
  };
}

/* -------------------- Validation / format -------------------- */

function getRawManagerContact(from) {
  if (from?.username) return `@${from.username}`;
  return null;
}

function getManagerContact(fromOrId) {
  if (typeof fromOrId === "object" && fromOrId?.username) return `@${fromOrId.username}`;
  const id = typeof fromOrId === "object" ? fromOrId?.id : fromOrId;
  return managerContacts.get(id) || `id: ${id || "unknown"}`;
}

function getExecutorContactFromProfile(profile) {
  return profile.telegramContact || `id: ${profile.telegramId}`;
}

function extractInput(message) {
  if (message.document) {
    return {
      type: "document",
      file_id: message.document.file_id,
      file_name: message.document.file_name || null,
      mime_type: message.document.mime_type || null,
      caption: message.caption || ""
    };
  }

  if (message.text) {
    return {
      type: "text",
      value: message.text
    };
  }

  return null;
}

function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
}

function normalizeCard(value) {
  return value.replace(/\D/g, "");
}

function isValidPhone(value) {
  const normalized = normalizePhone(value);
  return /^(\+7\d{10}|8\d{10})$/.test(normalized);
}

function isValidCard(value) {
  const normalized = normalizeCard(value);
  return /^\d{16}$/.test(normalized);
}

function isValidTelegramContact(value) {
  const trimmed = String(value || "").trim();
  const usernameRegex = /^@[A-Za-z0-9_]{5,32}$/;
  return usernameRegex.test(trimmed) || isValidPhone(trimmed);
}

function isValidFullName(value) {
  if (!value) return false;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every(part => part.length >= 2);
}

function isValidTransferDetails(value) {
  return isValidPhone(value) || isValidCard(value);
}

function isValidUnavailableTime(value) {
  if (!value || !value.trim()) return false;

  const lines = value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return false;

  const dayPattern = DAY_OPTIONS.join("|");
  const regex = new RegExp(`^(${dayPattern})\\s\\d{2}:\\d{2}-\\d{2}:\\d{2}$`);

  return lines.every(line => regex.test(line));
}

function isValidManualDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isValidManualTime(value) {
  return /^\d{2}:\d{2}$/.test(value.trim());
}

function formatField(field, label = "Материал") {
  if (!field) return "—";

  if (field.type === "text") return field.value || "—";

  if (field.type === "document") {
    if (field.caption && field.caption.trim()) {
      return `${label} прикреплено файлом.\nКомментарий: ${field.caption}`;
    }
    return `${label} прикреплено файлом.`;
  }

  return "—";
}

function formatCategories(categories) {
  if (!categories || !categories.length) return "—";
  return categories.join(", ");
}

function formatTaskCard(task) {
  const assignedLine = task.assignedExecutorName
    ? `Исполнитель: ${task.assignedExecutorName} (${task.assignedExecutorContact || "—"})`
    : "Исполнитель: —";

  return [
    `Задача #${task.id}`,
    "",
    `Название: ${task.title || "—"}`,
    `Категории: ${formatCategories(task.categories)}`,
    `Дедлайн: ${task.deadline || "—"}`,
    `Стоимость: ${task.price || "—"}`,
    `Статус: ${task.status || "—"}`,
    assignedLine,
    "",
    "ТЗ:",
    formatField(task.brief, "ТЗ"),
    "",
    "Источники:",
    formatField(task.sources, "Источники"),
    "",
    "Референсы:",
    formatField(task.refs_data, "Референсы"),
    "",
    "Комментарий:",
    task.comment || "—",
    "",
    `Менеджер: ${task.managerContact}`
  ].join("\n");
}

function formatExecutorProfile(profile) {
  return [
    "Анкета исполнителя",
    "",
    `ID исполнителя: ${profile.executorCode || "—"}`,
    `Имя: ${profile.fullName || "—"}`,
    `Контакт: ${profile.telegramContact || "—"}`,
    `Специализации: ${profile.specializations?.length ? profile.specializations.join(", ") : "—"}`,
    `Подтверждённые специализации: ${profile.verifiedSpecializations?.length ? profile.verifiedSpecializations.join(", ") : "—"}`,
    `Портфолио: ${profile.portfolio || "—"}`,
    `Способ выплаты: ${profile.paymentMethod || "—"}`,
    `Платёжные данные: ${formatField(profile.paymentDetails, "Платёжные данные")}`,
    `Недоступные дни: ${profile.unavailableDays?.length ? profile.unavailableDays.join(", ") : "—"}`,
    `Недоступное время: ${profile.unavailableTime || "—"}`,
    `Статус: ${profile.status || "—"}`,
    `Подтвердил менеджер: ${profile.approvedBy || "—"}`,
    `Оценка по ТЗ: ${typeof profile.reviewAccuracy === "number" ? profile.reviewAccuracy : "—"}`,
    `Оценка скорости: ${typeof profile.reviewSpeed === "number" ? profile.reviewSpeed : "—"}`,
    `Оценка эстетики: ${typeof profile.reviewAesthetics === "number" ? profile.reviewAesthetics : "—"}`,
    `Базовый рейтинг: ${typeof profile.baseRating === "number" ? profile.baseRating : "—"}`,
    `Буст новичка: ${typeof profile.newcomerBoost === "number" ? `+${profile.newcomerBoost}` : "—"}`,
    `Итоговый рейтинг: ${typeof profile.rating === "number" ? profile.rating : "—"}`
  ].join("\n");
}

function calculateBaseRating(accuracy, speed, aesthetics) {
  const startScore = accuracy * 0.5 + speed * 0.35 + aesthetics * 0.15;
  return Math.round(startScore * 20);
}

function calculateNewcomerBoost(baseRating) {
  if (baseRating >= 85) return 8;
  if (baseRating >= 75) return 7;
  if (baseRating >= 65) return 6;
  return 5;
}

function getResponseRecommendation(executor) {
  const rating = typeof executor.rating === "number" ? executor.rating : 0;
  if (rating >= 95) return { label: "Очень рекомендуется", score: rating + 5 };
  if (rating >= 85) return { label: "Рекомендуется", score: rating + 3 };
  if (rating >= 75) return { label: "Подходит", score: rating + 1 };
  return { label: "Ниже приоритета", score: rating };
}

/* -------------------- Helpers -------------------- */

function getConfirmedExecutorsForCategories(categories) {
  return Array.from(executors.values()).filter(profile => {
    return (
      profile.status === "Подтверждён" &&
      profile.verifiedSpecializations?.some(spec => categories.includes(spec))
    );
  });
}

function getPendingExecutors() {
  return Array.from(executors.values()).filter(profile => profile.status === "На модерации");
}

function getApprovedExecutors() {
  return Array.from(executors.values()).filter(profile => profile.status === "Подтверждён");
}

function serializeExecutorProfile(profile) {
  return {
    telegramId: profile.telegramId,
    executorCode: profile.executorCode || null,
    username: profile.username || null,
    telegramContact: profile.telegramContact || null,
    fullName: profile.fullName || null,
    specializations: profile.specializations || [],
    verifiedSpecializations: profile.verifiedSpecializations || [],
    portfolio: profile.portfolio || null,
    paymentMethod: profile.paymentMethod || null,
    paymentDetails: profile.paymentDetails || null,
    unavailableDays: profile.unavailableDays || [],
    unavailableTime: profile.unavailableTime || "",
    status: profile.status || null,
    approvedBy: profile.approvedBy || null,
    approvedByManagerId: profile.approvedByManagerId || null,
    reviewAccuracy: profile.reviewAccuracy ?? null,
    reviewSpeed: profile.reviewSpeed ?? null,
    reviewAesthetics: profile.reviewAesthetics ?? null,
    baseRating: profile.baseRating ?? null,
    newcomerBoost: profile.newcomerBoost ?? null,
    rating: profile.rating ?? null,
    completedOrders: profile.completedOrders ?? 0,
    responseHistory: profile.responseHistory || []
  };
}

function findExecutorByTelegramId(telegramId) {
  const profile = executors.get(telegramId);
  if (!profile) return null;
  return { chatId: telegramId, profile };
}

function getLastManagerTask(managerId) {
  const managerTasks = tasks.filter(task => task.managerId === managerId);
  if (!managerTasks.length) return null;
  return managerTasks[managerTasks.length - 1];
}

function getAcceptedResponses(task) {
  return (task.responses || []).filter(item => item.decision === "Принял");
}

function notifyTaskMaterials(chatId, task) {
  if (task.brief?.type === "document") {
    sendDocument(chatId, task.brief.file_id, "Файл ТЗ");
  }
  if (task.sources?.type === "document") {
    sendDocument(chatId, task.sources.file_id, "Файл с источниками");
  }
  if (task.refs_data?.type === "document") {
    sendDocument(chatId, task.refs_data.file_id, "Файл с референсами");
  }
}

/* -------------------- API -------------------- */

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function mapTaskForMiniapp(task) {
  return {
    id: task.id,
    title: task.title || "",
    type: task.categories || [],
    deadline: task.deadline || "",
    price: task.price || "",
    manager: task.managerContact || "—",
    status: task.status || "",
    assignedExecutorId: task.assignedExecutorId || null,
    assignedExecutorName: task.assignedExecutorName || null,
    assignedExecutorContact: task.assignedExecutorContact || null,
    publishedAt: task.publishedAt || null,
    createdAt: task.createdAt || null
  };
}

function getMiniappTasksGrouped() {
  const grouped = {
    waiting: [],
    active: [],
    archived: []
  };

  for (const task of tasks) {
    const mappedTask = mapTaskForMiniapp(task);
    const status = String(task.status || "");

    if (
      status === "Ждёт исполнителя" ||
      status === "Есть отклики" ||
      status === "Создана"
    ) {
      grouped.waiting.push(mappedTask);
      continue;
    }

    if (
      status === "Назначена" ||
      status === "ТЗ изучено" ||
      status === "В работе" ||
      status === "30%" ||
      status === "60%" ||
      status === "На проверке" ||
      status === "Правки" ||
      status === "Не оплачена"
    ) {
      grouped.active.push(mappedTask);
      continue;
    }

    if (
      status === "Выполнена" ||
      status === "Оплачена"
    ) {
      grouped.archived.push(mappedTask);
      continue;
    }

    grouped.waiting.push(mappedTask);
  }

  return grouped;
}

/* -------------------- Reminders -------------------- */

function clearTaskReminder(taskId) {
  const state = taskReminderState.get(taskId);
  if (state?.timeoutId) clearTimeout(state.timeoutId);
  taskReminderState.delete(taskId);
}

function scheduleTaskReminder(taskId, stageKey) {
  clearTaskReminder(taskId);

  const state = {
    stageKey,
    attempts: 0,
    timeoutId: null
  };

  taskReminderState.set(taskId, state);

  function tick() {
    const task = tasks.find(t => t.id === taskId);
    const reminderState = taskReminderState.get(taskId);

    if (!task || !reminderState || reminderState.stageKey !== stageKey) return;

    if (shouldStopReminder(task, stageKey)) {
      clearTaskReminder(taskId);
      return;
    }

    reminderState.attempts += 1;

    if (reminderState.attempts > MAX_REMINDER_ATTEMPTS) {
      sendMessage(
        task.managerId,
        `Исполнитель не подтвердил этап "${getStageLabel(stageKey)}" по задаче #${task.id} после ${MAX_REMINDER_ATTEMPTS} напоминаний.`,
        getManagerReviewTaskKeyboard(task.id)
      );
      clearTaskReminder(taskId);
      return;
    }

    sendStageReminder(task, stageKey, reminderState.attempts);
    reminderState.timeoutId = setTimeout(tick, REMINDER_DELAY_MS);
  }

  state.timeoutId = setTimeout(tick, REMINDER_DELAY_MS);
}

function shouldStopReminder(task, stageKey) {
  if (stageKey === "read") return task.status !== "Назначена";
  if (stageKey === "inwork") return task.status !== "ТЗ изучено";
  if (stageKey === "30") return task.status !== "В работе";
  if (stageKey === "60") return task.status !== "30%";
  if (stageKey === "final") return !(task.status === "60%" || task.status === "Правки");
  return true;
}

function getStageLabel(stageKey) {
  if (stageKey === "read") return "Ознакомился с ТЗ";
  if (stageKey === "inwork") return "Взял в работу";
  if (stageKey === "30") return "30%";
  if (stageKey === "60") return "60%";
  if (stageKey === "final") return "Всё готово";
  return stageKey;
}

function sendStageReminder(task, stageKey, attempt) {
  let text = "";
  let inline_keyboard = [];

  if (stageKey === "read") {
    text = `Напоминание ${attempt}/${MAX_REMINDER_ATTEMPTS}\n\nОзнакомился ли ты с ТЗ по задаче #${task.id}?`;
    inline_keyboard = [[
      { text: "Да", callback_data: `stage_read_yes_${task.id}` },
      { text: "Нет", callback_data: `stage_read_no_${task.id}` }
    ]];
  } else if (stageKey === "inwork") {
    text = `Напоминание ${attempt}/${MAX_REMINDER_ATTEMPTS}\n\nВзял ли ты в работу задачу #${task.id}?`;
    inline_keyboard = [[
      { text: "Да", callback_data: `stage_inwork_yes_${task.id}` },
      { text: "Нет", callback_data: `stage_inwork_no_${task.id}` }
    ]];
  } else if (stageKey === "30") {
    text = `Напоминание ${attempt}/${MAX_REMINDER_ATTEMPTS}\n\nГотовы ли 30% по задаче #${task.id}? Если да — отправь ссылку, текст или файл.`;
    inline_keyboard = [[
      { text: "Да, отправлю материал", callback_data: `stage_30_yes_${task.id}` },
      { text: "Ещё нет", callback_data: `stage_30_no_${task.id}` }
    ]];
  } else if (stageKey === "60") {
    text = `Напоминание ${attempt}/${MAX_REMINDER_ATTEMPTS}\n\nГотовы ли 60% по задаче #${task.id}? Если да — отправь ссылку, текст или файл.`;
    inline_keyboard = [[
      { text: "Да, отправлю материал", callback_data: `stage_60_yes_${task.id}` },
      { text: "Ещё нет", callback_data: `stage_60_no_${task.id}` }
    ]];
  } else if (stageKey === "final") {
    text = `Напоминание ${attempt}/${MAX_REMINDER_ATTEMPTS}\n\nВсё ли готово по задаче #${task.id}? Если да — отправь финальный материал ссылкой, текстом или файлом.`;
    inline_keyboard = [[
      { text: "Да, отправлю финал", callback_data: `stage_final_yes_${task.id}` },
      { text: "Ещё нет", callback_data: `stage_final_no_${task.id}` }
    ]];
  }

  sendMessage(task.assignedExecutorId, text, { inline_keyboard });
}

/* -------------------- Task creation -------------------- */

function startTaskCreation(chatId, from) {
  userStates.set(chatId, {
    type: "create_task",
    step: "title",
    task: {
      id: null,
      createdAt: new Date().toISOString(),
      managerId: from?.id || null,
      managerUsername: from?.username || null,
      managerContact: getManagerContact(from),
      title: "",
      categories: [],
      deadlineDate: "",
      deadlineTime: "",
      deadline: "",
      price: "",
      brief: null,
      sources: null,
      refs_data: null,
      comment: null,
      status: "Создана",
      responses: [],
      publishedAt: null,
      assignedExecutorId: null,
      assignedExecutorName: null,
      assignedExecutorContact: null,
      stageMaterials: {
        thirty: null,
        sixty: null,
        final: null
      },
      timeline: {
        assignedAt: null,
        briefReadAt: null,
        inWorkAt: null,
        shown30At: null,
        shown60At: null,
        submittedAt: null,
        approvedAt: null,
        returnedForFixesAt: null,
        unpaidAt: null,
        paidAt: null
      }
    }
  });

  sendMessage(chatId, "Введи название задачи.");
}

async function finishTaskCreation(chatId, state) {
  try {
    state.task.deadline = `${state.task.deadlineDate} ${state.task.deadlineTime}`;
    await saveTaskToDb(state.task);

    const existingIndex = tasks.findIndex(t => t.id === state.task.id);
    if (existingIndex === -1) {
      tasks.push(state.task);
    } else {
      tasks[existingIndex] = state.task;
    }

    userStates.delete(chatId);

    sendMessage(
      chatId,
      `Задача создана.\n\n${formatTaskCard(state.task)}`,
      getTaskAfterCreateKeyboard()
    );

    notifyTaskMaterials(chatId, state.task);
  } catch (error) {
    console.error("finishTaskCreation error:", error);
    sendMessage(chatId, "Не удалось сохранить задачу. Посмотри логи Render.");
  }
}

async function handleTaskCreationStep(chatId, message, state) {
  const text = message.text;
  const input = extractInput(message);

  if (!input && text !== "Пропустить") {
    sendMessage(chatId, "Не удалось прочитать сообщение. Отправь текст, ссылку или файл.");
    return;
  }

  if (state.step === "title") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Название задачи лучше отправить текстом.");
      return;
    }
    state.task.title = input.value.trim();
    state.step = "categories";
    state.task.categories = [];
    sendMessage(chatId, "Выбери категории задачи. Можно несколько. Потом нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "categories") {
    if (text === "Готово") {
      if (!state.task.categories.length) {
        sendMessage(chatId, "Нужно выбрать хотя бы одну категорию.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
        return;
      }

      state.step = "deadline_date";
      sendMessage(chatId, "Выбери дату дедлайна.", getDateKeyboard());
      return;
    }

    if (!SPECIALIZATION_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери категорию кнопкой или нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    if (!state.task.categories.includes(text)) {
      state.task.categories.push(text);
    }

    sendMessage(chatId, `Выбрано: ${state.task.categories.join(", ")}`, getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "deadline_date") {
    if (text === "Ввести дату вручную") {
      state.step = "deadline_date_manual";
      sendMessage(chatId, "Введи дату в формате YYYY-MM-DD. Например: 2026-03-16");
      return;
    }

    if (Object.prototype.hasOwnProperty.call(DATE_OPTION_VALUES, text)) {
      const date = new Date();
      date.setDate(date.getDate() + DATE_OPTION_VALUES[text]);
      state.task.deadlineDate = date.toISOString().slice(0, 10);
      state.step = "deadline_time";
      sendMessage(chatId, "Выбери время дедлайна.", getTimeKeyboard());
      return;
    }

    sendMessage(chatId, "Выбери дату кнопкой.", getDateKeyboard());
    return;
  }

  if (state.step === "deadline_date_manual") {
    if (!input || input.type !== "text" || !isValidManualDate(input.value)) {
      sendMessage(chatId, "Нужен формат YYYY-MM-DD. Например: 2026-03-16");
      return;
    }

    state.task.deadlineDate = input.value.trim();
    state.step = "deadline_time";
    sendMessage(chatId, "Выбери время дедлайна.", getTimeKeyboard());
    return;
  }

  if (state.step === "deadline_time") {
    if (text === "Ввести время вручную") {
      state.step = "deadline_time_manual";
      sendMessage(chatId, "Введи время в формате HH:MM. Например: 18:00");
      return;
    }

    if (TIME_OPTIONS.includes(text)) {
      state.task.deadlineTime = text;
      state.step = "price";
      sendMessage(chatId, "Введи стоимость задачи. Например: 1500 ₽.");
      return;
    }

    sendMessage(chatId, "Выбери время кнопкой.", getTimeKeyboard());
    return;
  }

  if (state.step === "deadline_time_manual") {
    if (!input || input.type !== "text" || !isValidManualTime(input.value)) {
      sendMessage(chatId, "Нужен формат HH:MM. Например: 18:00");
      return;
    }

    state.task.deadlineTime = input.value.trim();
    state.step = "price";
    sendMessage(chatId, "Введи стоимость задачи. Например: 1500 ₽.");
    return;
  }

  if (state.step === "price") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Стоимость лучше отправить текстом.");
      return;
    }

    state.task.price = input.value.trim();
    state.step = "brief";
    sendMessage(chatId, "Отправь ТЗ. Это обязательное поле: можно текст, ссылку или файл.");
    return;
  }

  if (state.step === "brief") {
    if (!input) {
      sendMessage(chatId, "ТЗ обязательно. Отправь текст, ссылку или файл.");
      return;
    }

    state.task.brief = input;
    state.step = "sources";
    sendMessage(chatId, "Отправь источники. Можно текст, ссылку или файл. Это поле необязательное.", getSkipKeyboard());
    return;
  }

  if (state.step === "sources") {
    state.task.sources = text === "Пропустить" ? null : input;
    state.step = "refs_data";
    sendMessage(chatId, "Отправь референсы. Можно текст, ссылку или файл. Это поле необязательное.", getSkipKeyboard());
    return;
  }

  if (state.step === "refs_data") {
    state.task.refs_data = text === "Пропустить" ? null : input;
    state.step = "comment";
    sendMessage(chatId, "Отправь комментарий. Это поле необязательное.", getSkipKeyboard());
    return;
  }

  if (state.step === "comment") {
    if (text === "Пропустить") {
      state.task.comment = null;
    } else if (input?.type === "text") {
      state.task.comment = input.value;
    } else if (input?.type === "document") {
      state.task.comment = input.caption?.trim()
        ? `Комментарий к файлу: ${input.caption}`
        : "Комментарий приложен файлом.";
    } else {
      state.task.comment = null;
    }

    await finishTaskCreation(chatId, state);
  }
}

/* -------------------- Executor registration -------------------- */

function startExecutorRegistration(chatId, from, existing = null) {
  const autoContact = from?.username ? `@${from.username}` : (existing?.telegramContact || "");

  userStates.set(chatId, {
    type: "executor_registration",
    step: "name",
    profile: {
      telegramId: from?.id || null,
      executorCode: existing?.executorCode || generateExecutorCode(),
      username: from?.username || null,
      telegramContact: autoContact,
      fullName: existing?.fullName || "",
      specializations: existing?.specializations || [],
      verifiedSpecializations: existing?.verifiedSpecializations || [],
      portfolio: existing?.portfolio || null,
      paymentMethod: existing?.paymentMethod || "",
      paymentDetails: existing?.paymentDetails || null,
      paymentFile: existing?.paymentFile || null,
      unavailableDays: existing?.unavailableDays || [],
      unavailableTime: existing?.unavailableTime || "",
      status: existing?.status || "На модерации",
      approvedBy: existing?.approvedBy || null,
      approvedByManagerId: existing?.approvedByManagerId || null,
      reviewAccuracy: typeof existing?.reviewAccuracy === "number" ? existing.reviewAccuracy : null,
      reviewSpeed: typeof existing?.reviewSpeed === "number" ? existing.reviewSpeed : null,
      reviewAesthetics: typeof existing?.reviewAesthetics === "number" ? existing.reviewAesthetics : null,
      baseRating: typeof existing?.baseRating === "number" ? existing.baseRating : null,
      newcomerBoost: typeof existing?.newcomerBoost === "number" ? existing.newcomerBoost : null,
      rating: typeof existing?.rating === "number" ? existing.rating : null,
      completedOrders: existing?.completedOrders || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseHistory: existing?.responseHistory || []
    }
  });

  sendMessage(chatId, "Введи имя и фамилию. Формат: Имя Фамилия");
}

function notifyManagersAboutExecutor(profile) {
  if (managers.size === 0) return;

  const text = [
    "Новая анкета исполнителя",
    "",
    `Имя: ${profile.fullName || "—"}`,
    `Контакт: ${profile.telegramContact || "—"}`,
    `Специализации: ${profile.specializations?.length ? profile.specializations.join(", ") : "—"}`,
    `Портфолио: ${profile.portfolio || "—"}`,
    `Способ выплаты: ${profile.paymentMethod || "—"}`,
    `Платёжные данные: ${formatField(profile.paymentDetails, "Платёжные данные")}`,
    `Недоступные дни: ${profile.unavailableDays?.length ? profile.unavailableDays.join(", ") : "—"}`,
    `Недоступное время: ${profile.unavailableTime || "—"}`,
    `Статус: ${profile.status || "—"}`
  ].join("\n");

  for (const managerChatId of managers) {
    sendMessage(managerChatId, text, getMainKeyboard(true));
    if (profile.paymentFile?.type === "document") {
      sendDocument(managerChatId, profile.paymentFile.file_id, "Файл с реквизитами исполнителя");
    }
  }
}

async function finishExecutorRegistration(chatId, state) {
  state.profile.updatedAt = new Date().toISOString();
  state.profile.status = "На модерации";
  state.profile.approvedBy = null;
  state.profile.approvedByManagerId = null;
  state.profile.verifiedSpecializations = [];
  state.profile.reviewAccuracy = null;
  state.profile.reviewSpeed = null;
  state.profile.reviewAesthetics = null;
  state.profile.baseRating = null;
  state.profile.newcomerBoost = null;
  state.profile.rating = null;

  executors.set(chatId, state.profile);
  await saveExecutorToDb(state.profile);
  userStates.delete(chatId);

  sendMessage(
    chatId,
    `Анкета сохранена и отправлена на модерацию.\n\n${formatExecutorProfile(state.profile)}`,
    getMainKeyboard(false, true)
  );

  if (state.profile.paymentFile?.type === "document") {
    sendDocument(chatId, state.profile.paymentFile.file_id, "Твой файл с реквизитами");
  }

  notifyManagersAboutExecutor(state.profile);
}

async function handleExecutorRegistrationStep(chatId, message, state) {
  const text = message.text;
  const input = extractInput(message);

  if (state.step === "name") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Имя лучше отправить текстом.");
      return;
    }

    if (!isValidFullName(input.value)) {
      sendMessage(chatId, "Нужно ввести минимум имя и фамилию. Формат: Имя Фамилия");
      return;
    }

    state.profile.fullName = input.value.trim();

    if (!state.profile.telegramContact) {
      state.step = "telegram_contact";
      sendMessage(
        chatId,
        "У тебя не указан username в Telegram. Введи контакт для связи: @username или номер телефона, привязанный к Telegram.\nПримеры:\n@mayya_design\n+79991234567"
      );
      return;
    }

    state.step = "specializations";
    state.profile.specializations = [];
    sendMessage(chatId, "Выбери специализации. Можно несколько. Нажимай кнопки по одной, потом нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "telegram_contact") {
    if (!input || input.type !== "text" || !isValidTelegramContact(input.value)) {
      sendMessage(
        chatId,
        "Нужен корректный контакт для связи: @username или телефон Telegram.\nПримеры:\n@mayya_design\n+79991234567"
      );
      return;
    }

    state.profile.telegramContact = input.value.trim();
    state.step = "specializations";
    state.profile.specializations = [];
    sendMessage(chatId, "Выбери специализации. Можно несколько. Нажимай кнопки по одной, потом нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "specializations") {
    if (text === "Готово") {
      if (!state.profile.specializations.length) {
        sendMessage(chatId, "Нужно выбрать хотя бы одну специализацию.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
        return;
      }

      state.step = "portfolio";
      sendMessage(chatId, "Пришли ссылку на портфолио. Подойдёт любое портфолио, не обязательно по баннерам. Поле можно пропустить.", getSkipKeyboard());
      return;
    }

    if (!SPECIALIZATION_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери специализацию кнопкой или нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    if (!state.profile.specializations.includes(text)) {
      state.profile.specializations.push(text);
    }

    sendMessage(chatId, `Выбрано: ${state.profile.specializations.join(", ")}`, getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "portfolio") {
    if (text === "Пропустить") {
      state.profile.portfolio = null;
    } else if (input?.type === "text") {
      state.profile.portfolio = input.value;
    } else {
      sendMessage(chatId, "Портфолио лучше отправить текстом или ссылкой. Либо нажми Пропустить.", getSkipKeyboard());
      return;
    }

    state.step = "payment_method";
    sendMessage(chatId, "Выбери удобный способ выплаты.", getPaymentKeyboard());
    return;
  }

  if (state.step === "payment_method") {
    if (!PAYMENT_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери один из вариантов выплаты кнопкой.", getPaymentKeyboard());
      return;
    }

    state.profile.paymentMethod = text;

    if (text === "Переводом") {
      state.step = "payment_details_transfer";
      sendMessage(
        chatId,
        "Введи номер телефона или карты для выплаты.\nПримеры:\n+79991234567\n89991234567\n5536 9141 2345 6789"
      );
      return;
    }

    state.step = "payment_details_business";
    sendMessage(chatId, `Введи реквизиты для ${text}. Потом отдельным сообщением можно будет приложить файл.`);
    return;
  }

  if (state.step === "payment_details_transfer") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Реквизиты лучше отправить текстом.");
      return;
    }

    if (!isValidTransferDetails(input.value)) {
      sendMessage(
        chatId,
        "Нужен корректный номер телефона или карты.\nПримеры:\n+79991234567\n89991234567\n5536 9141 2345 6789"
      );
      return;
    }

    state.profile.paymentDetails = input;
    state.profile.paymentFile = null;
    state.step = "unavailable_days";
    state.profile.unavailableDays = [];
    sendMessage(chatId, "Выбери дни, когда ты точно не можешь брать срочные задачи. Можно несколько. Потом нажми Готово. Если таких дней нет — сразу нажми Готово.", getDoneKeyboard(DAY_OPTIONS));
    return;
  }

  if (state.step === "payment_details_business") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Реквизиты лучше отправить текстом.");
      return;
    }

    state.profile.paymentDetails = input;
    state.step = "payment_file";
    sendMessage(chatId, "Теперь можешь приложить файл с реквизитами. Это поле необязательное.", getSkipKeyboard());
    return;
  }

  if (state.step === "payment_file") {
    if (text === "Пропустить") {
      state.profile.paymentFile = null;
    } else if (message.document) {
      state.profile.paymentFile = extractInput(message);
    } else {
      sendMessage(chatId, "Пришли файл или нажми Пропустить.", getSkipKeyboard());
      return;
    }

    state.step = "unavailable_days";
    state.profile.unavailableDays = [];
    sendMessage(chatId, "Выбери дни, когда ты точно не можешь брать срочные задачи. Можно несколько. Потом нажми Готово. Если таких дней нет — сразу нажми Готово.", getDoneKeyboard(DAY_OPTIONS));
    return;
  }

  if (state.step === "unavailable_days") {
    if (text === "Готово") {
      state.step = "unavailable_time";
      sendMessage(
        chatId,
        "Если есть временные промежутки, когда ты не можешь брать задачи, введи по одной строке в таком формате:\nВторник 10:00-14:00\nСреда 18:00-22:00\nЕсли ограничений нет — нажми Пропустить.",
        getSkipKeyboard()
      );
      return;
    }

    if (!DAY_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери день кнопкой или нажми Готово.", getDoneKeyboard(DAY_OPTIONS));
      return;
    }

    if (!state.profile.unavailableDays.includes(text)) {
      state.profile.unavailableDays.push(text);
    }

    sendMessage(chatId, `Выбрано: ${state.profile.unavailableDays.join(", ") || "—"}`, getDoneKeyboard(DAY_OPTIONS));
    return;
  }

  if (state.step === "unavailable_time") {
    if (text === "Пропустить") {
      state.profile.unavailableTime = "";
    } else if (input?.type === "text") {
      if (!isValidUnavailableTime(input.value)) {
        sendMessage(
          chatId,
          "Неверный формат времени.\nВводи по одной строке так:\nВторник 10:00-14:00\nСреда 18:00-22:00",
          getSkipKeyboard()
        );
        return;
      }

      state.profile.unavailableTime = input.value.trim();
    } else {
      sendMessage(chatId, "Напиши время текстом или нажми Пропустить.", getSkipKeyboard());
      return;
    }

    await finishExecutorRegistration(chatId, state);
  }
}

/* -------------------- Moderation -------------------- */

async function handleManagerContactStep(chatId, text, from) {
  if (!isValidTelegramContact(text)) {
    sendMessage(
      chatId,
      "Нужен корректный контакт для связи: @username или телефон Telegram.\nПримеры:\n@mayya_design\n+79991234567"
    );
    return;
  }

  managerContacts.set(from.id, text.trim());
  await saveManagerContactToDb(from.id, text.trim());
  userStates.delete(chatId);
  managers.add(from.id);
  sendMessage(chatId, "Контакт сохранён. Доступ менеджера открыт.", getMainKeyboard(true));
}

function ensureManagerContact(chatId, from) {
  const auto = getRawManagerContact(from);
  if (auto) {
    managerContacts.set(from.id, auto);
    saveManagerContactToDb(from.id, auto).catch(console.error);
    return true;
  }

  if (managerContacts.has(from.id)) return true;

  userStates.set(chatId, {
    type: "manager_contact",
    step: "contact"
  });

  sendMessage(
    chatId,
    "У тебя не указан username в Telegram. Введи контакт для связи: @username или номер телефона, привязанный к Telegram.\nПримеры:\n@mayya_design\n+79991234567"
  );
  return false;
}

function showNextPendingExecutor(managerChatId) {
  const pending = getPendingExecutors();

  if (!pending.length) {
    userStates.delete(managerChatId);
    sendMessage(managerChatId, "Заявок на модерации сейчас нет.", getMainKeyboard(true));
    return;
  }

  const profile = pending[0];

  userStates.set(managerChatId, {
    type: "manager_review_executor",
    step: "decision",
    targetExecutorTelegramId: profile.telegramId,
    selectedSpecializations: [],
    reviewAccuracy: null,
    reviewSpeed: null,
    reviewAesthetics: null
  });

  sendMessage(managerChatId, `Заявка на модерацию\n\n${formatExecutorProfile(profile)}`, getModerationKeyboard());

  if (profile.paymentFile?.type === "document") {
    sendDocument(managerChatId, profile.paymentFile.file_id, "Файл с реквизитами исполнителя");
  }
}

async function handleManagerReviewStep(chatId, text, from, state) {
  const found = findExecutorByTelegramId(state.targetExecutorTelegramId);

  if (!found) {
    userStates.delete(chatId);
    sendMessage(chatId, "Исполнитель для модерации не найден.", getMainKeyboard(true));
    return;
  }

  const executorChatId = found.chatId;
  const profile = found.profile;

  if (state.step === "decision") {
    if (text === "Следующая заявка") {
      showNextPendingExecutor(chatId);
      return;
    }

    if (text === "В меню менеджера") {
      userStates.delete(chatId);
      sendMessage(chatId, "Вернулись в меню менеджера.", getMainKeyboard(true));
      return;
    }

    if (text === "Отклонить исполнителя") {
      profile.status = "Отклонён";
      profile.approvedBy = getManagerContact(from);
      profile.approvedByManagerId = from?.id || null;
      profile.verifiedSpecializations = [];
      profile.reviewAccuracy = null;
      profile.reviewSpeed = null;
      profile.reviewAesthetics = null;
      profile.baseRating = null;
      profile.newcomerBoost = null;
      profile.rating = null;
      profile.updatedAt = new Date().toISOString();

      executors.set(executorChatId, profile);
      await saveExecutorToDb(profile);
      userStates.delete(chatId);

      sendMessage(
        executorChatId,
        "Твоя анкета отклонена менеджером. Позже можно будет отредактировать анкету и отправить её снова.",
        getMainKeyboard(false, true)
      );

      sendMessage(chatId, "Исполнитель отклонён.", getMainKeyboard(true));
      return;
    }

    if (text === "Подтвердить исполнителя") {
      state.step = "verified_specializations";
      state.selectedSpecializations = [];
      sendMessage(chatId, "Выбери подтверждённые специализации. Можно несколько. Потом нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    sendMessage(chatId, "Выбери действие по заявке.", getModerationKeyboard());
    return;
  }

  if (state.step === "verified_specializations") {
    if (text === "Готово") {
      if (!state.selectedSpecializations.length) {
        sendMessage(chatId, "Нужно подтвердить хотя бы одну специализацию.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
        return;
      }

      state.step = "review_accuracy";
      sendMessage(chatId, "Оцени соблюдение ТЗ по шкале от 1 до 5.");
      return;
    }

    if (!SPECIALIZATION_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери специализацию кнопкой или нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    if (!state.selectedSpecializations.includes(text)) {
      state.selectedSpecializations.push(text);
    }

    sendMessage(chatId, `Подтверждено: ${state.selectedSpecializations.join(", ")}`, getDoneKeyboard(SPECIALIZATION_OPTIONS));
    return;
  }

  if (state.step === "review_accuracy") {
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewAccuracy = value;
    state.step = "review_speed";
    sendMessage(chatId, "Оцени скорость по шкале от 1 до 5.");
    return;
  }

  if (state.step === "review_speed") {
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewSpeed = value;
    state.step = "review_aesthetics";
    sendMessage(chatId, "Оцени эстетику по шкале от 1 до 5.");
    return;
  }

  if (state.step === "review_aesthetics") {
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewAesthetics = value;

    const baseRating = calculateBaseRating(
      state.reviewAccuracy,
      state.reviewSpeed,
      state.reviewAesthetics
    );
    const newcomerBoost = calculateNewcomerBoost(baseRating);
    const finalRating = baseRating + newcomerBoost;

    profile.status = "Подтверждён";
    profile.approvedBy = getManagerContact(from);
    profile.approvedByManagerId = from?.id || null;
    profile.verifiedSpecializations = [...state.selectedSpecializations];
    profile.reviewAccuracy = state.reviewAccuracy;
    profile.reviewSpeed = state.reviewSpeed;
    profile.reviewAesthetics = state.reviewAesthetics;
    profile.baseRating = baseRating;
    profile.newcomerBoost = newcomerBoost;
    profile.rating = finalRating;
    profile.updatedAt = new Date().toISOString();

    executors.set(executorChatId, profile);
    await saveExecutorToDb(profile);
    userStates.delete(chatId);

    sendMessage(
      executorChatId,
      `Твоя анкета подтверждена.\n\n${formatExecutorProfile(profile)}`,
      getMainKeyboard(false, true)
    );

    if (profile.paymentFile?.type === "document") {
      sendDocument(executorChatId, profile.paymentFile.file_id, "Твой файл с реквизитами");
    }

    sendMessage(
      chatId,
      `Исполнитель подтверждён.\n\nБазовый рейтинг: ${baseRating}\nБуст новичка: +${newcomerBoost}\nИтоговый рейтинг: ${finalRating}`,
      getMainKeyboard(true)
    );
  }
}

/* -------------------- Tasks -------------------- */

async function publishTaskToExecutors(managerChatId, task) {
  const candidates = getConfirmedExecutorsForCategories(task.categories);

  if (!candidates.length) {
    sendMessage(managerChatId, `Нет подтверждённых исполнителей под выбранные категории "${formatCategories(task.categories)}".`, getMainKeyboard(true));
    return;
  }

  task.status = "Ждёт исполнителя";
  task.publishedAt = new Date().toISOString();
  await saveTaskToDb(task);

  const inlineKeyboard = {
    inline_keyboard: [[
      { text: "Принять", callback_data: `accept_${task.id}` },
      { text: "Отклонить", callback_data: `decline_${task.id}` }
    ]]
  };

  for (const profile of candidates) {
    sendMessage(
      profile.telegramId,
      `Новая задача доступна.\n\n${formatTaskCard(task)}`,
      inlineKeyboard
    );
    notifyTaskMaterials(profile.telegramId, task);
  }

  sendMessage(
    managerChatId,
    `Задача #${task.id} опубликована исполнителям.\nПодходящих исполнителей: ${candidates.length}`,
    getMainKeyboard(true)
  );
}

function showResponsesForTask(managerChatId, task) {
  const accepted = getAcceptedResponses(task);

  if (!accepted.length) {
    sendMessage(managerChatId, `По задаче #${task.id} пока нет принятых откликов.`, getMainKeyboard(true));
    return;
  }

  sendMessage(
    managerChatId,
    `Отклики по задаче #${task.id}:\n${task.title}\n\nВыбери, кого назначить.`,
    getMainKeyboard(true)
  );

  for (const response of accepted) {
    const found = findExecutorByTelegramId(response.executorId);
    const executor = found?.profile || executors.get(response.executorId);
    const recommendation = getResponseRecommendation(executor || { rating: 0 });

    const text = [
      `Исполнитель: ${response.executorName}`,
      `Контакт: ${response.executorContact}`,
      `Рейтинг: ${typeof executor?.rating === "number" ? executor.rating : "—"}`,
      `Рекомендация системы: ${recommendation.label}`,
      `Скоринг рекомендации: ${recommendation.score}`
    ].join("\n");

    const inlineKeyboard = {
      inline_keyboard: [[{ text: "Назначить", callback_data: `assign_${task.id}_${response.executorId}` }]]
    };

    sendMessage(managerChatId, text, inlineKeyboard);
  }
}

async function assignExecutorToTask(managerChatId, managerFromId, taskId, executorId) {
  const task = tasks.find(item => item.id === taskId);

  if (!task) {
    sendMessage(managerChatId, "Задача не найдена.", getMainKeyboard(true));
    return;
  }

  if (task.managerId !== managerFromId) {
    sendMessage(managerChatId, "Нельзя назначать исполнителя на чужую задачу.", getMainKeyboard(true));
    return;
  }

  const accepted = getAcceptedResponses(task);
  const selectedResponse = accepted.find(item => item.executorId === executorId);

  if (!selectedResponse) {
    sendMessage(managerChatId, "Этот исполнитель не найден среди принятых откликов.", getMainKeyboard(true));
    return;
  }

  const executor = executors.get(executorId);
  if (!executor) {
    sendMessage(managerChatId, "Профиль исполнителя не найден.", getMainKeyboard(true));
    return;
  }

  task.assignedExecutorId = executorId;
  task.assignedExecutorName = selectedResponse.executorName;
  task.assignedExecutorContact = selectedResponse.executorContact;
  task.status = "Назначена";
  task.timeline.assignedAt = new Date().toISOString();

  await saveTaskToDb(task);

  sendMessage(
    executorId,
    `Тебе назначена задача.\n\n${formatTaskCard(task)}`,
    getExecutorTaskActionKeyboard(task)
  );
  notifyTaskMaterials(executorId, task);

  for (const response of accepted) {
    if (response.executorId !== executorId) {
      sendMessage(
        response.executorId,
        `По задаче #${task.id} выбран другой исполнитель. Спасибо за отклик.`,
        getMainKeyboard(false, true)
      );
    }
  }

  sendMessage(
    managerChatId,
    `Исполнитель назначен на задачу #${task.id}.\n\n${formatTaskCard(task)}`,
    getManagerReviewTaskKeyboard(task.id)
  );

  scheduleTaskReminder(task.id, "read");
}

async function updateTaskStatusByExecutor(chatId, taskId, action) {
  const task = tasks.find(item => item.id === taskId);

  if (!task) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  if (task.assignedExecutorId !== chatId) {
    sendMessage(chatId, "Эта задача назначена не тебе.");
    return;
  }

  if (action === "Изучил ТЗ" && task.status === "Назначена") {
    task.status = "ТЗ изучено";
    task.timeline.briefReadAt = new Date().toISOString();
    await saveTaskToDb(task);

    sendMessage(chatId, `Статус обновлён: ТЗ изучено.\n\n${formatTaskCard(task)}`, getExecutorTaskActionKeyboard(task));
    sendMessage(task.managerId, `Исполнитель изучил ТЗ по задаче #${task.id}.`, getManagerReviewTaskKeyboard(task.id));

    scheduleTaskReminder(task.id, "inwork");
    return;
  }

  if (action === "Взял в работу" && task.status === "ТЗ изучено") {
    task.status = "В работе";
    task.timeline.inWorkAt = new Date().toISOString();
    await saveTaskToDb(task);

    sendMessage(chatId, `Статус обновлён: В работе.\n\n${formatTaskCard(task)}`, getExecutorTaskActionKeyboard(task));
    sendMessage(task.managerId, `Исполнитель взял задачу #${task.id} в работу.`, getManagerReviewTaskKeyboard(task.id));

    scheduleTaskReminder(task.id, "30");
    return;
  }

  if (action === "Сдать задачу" && task.status === "Правки") {
    task.status = "На проверке";
    task.timeline.submittedAt = new Date().toISOString();
    await saveTaskToDb(task);

    sendMessage(chatId, `Исправленная задача отправлена на проверку.\n\n${formatTaskCard(task)}`, getMainKeyboard(false, true));
    sendMessage(task.managerId, `Исполнитель повторно сдал задачу #${task.id} после правок.`, getManagerReviewTaskKeyboard(task.id));
    return;
  }

  sendMessage(chatId, "Это действие сейчас недоступно для текущего статуса задачи.");
}

function startStageMaterialCollection(chatId, taskId, stageKey) {
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  if (task.assignedExecutorId !== chatId) {
    sendMessage(chatId, "Эта задача назначена не тебе.");
    return;
  }

  let prompt = "";
  if (stageKey === "30") prompt = "Пришли материал для этапа 30%: ссылку, текст или файл.";
  if (stageKey === "60") prompt = "Пришли материал для этапа 60%: ссылку, текст или файл.";
  if (stageKey === "final") prompt = "Пришли финальный материал: ссылку, текст или файл.";

  userStates.set(chatId, {
    type: "task_stage_material",
    step: "await_material",
    taskId,
    stageKey
  });

  sendMessage(chatId, prompt);
}

async function handleTaskStageMaterial(chatId, message, state) {
  const task = tasks.find(t => t.id === state.taskId);
  const input = extractInput(message);

  if (!task) {
    userStates.delete(chatId);
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  if (!input) {
    sendMessage(chatId, "Нужен текст, ссылка или файл.");
    return;
  }

  if (state.stageKey === "30") {
    task.status = "30%";
    task.timeline.shown30At = new Date().toISOString();
    task.stageMaterials.thirty = input;
    userStates.delete(chatId);
    await saveTaskToDb(task);

    sendMessage(chatId, `Материал 30% отправлен.\n\n${formatTaskCard(task)}`, getMainKeyboard(false, true));
    sendMessage(task.managerId, `Исполнитель отправил этап 30% по задаче #${task.id}.`, getManagerReviewTaskKeyboard(task.id));
    if (input.type === "document") {
      sendDocument(task.managerId, input.file_id, `Материал 30% по задаче #${task.id}`);
    } else {
      sendMessage(task.managerId, `Материал 30%:\n${input.value}`, getManagerReviewTaskKeyboard(task.id));
    }

    scheduleTaskReminder(task.id, "60");
    return;
  }

  if (state.stageKey === "60") {
    task.status = "60%";
    task.timeline.shown60At = new Date().toISOString();
    task.stageMaterials.sixty = input;
    userStates.delete(chatId);
    await saveTaskToDb(task);

    sendMessage(chatId, `Материал 60% отправлен.\n\n${formatTaskCard(task)}`, getMainKeyboard(false, true));
    sendMessage(task.managerId, `Исполнитель отправил этап 60% по задаче #${task.id}.`, getManagerReviewTaskKeyboard(task.id));
    if (input.type === "document") {
      sendDocument(task.managerId, input.file_id, `Материал 60% по задаче #${task.id}`);
    } else {
      sendMessage(task.managerId, `Материал 60%:\n${input.value}`, getManagerReviewTaskKeyboard(task.id));
    }

    scheduleTaskReminder(task.id, "final");
    return;
  }

  if (state.stageKey === "final") {
    task.status = "На проверке";
    task.timeline.submittedAt = new Date().toISOString();
    task.stageMaterials.final = input;
    userStates.delete(chatId);
    await saveTaskToDb(task);

    sendMessage(chatId, `Финальный материал отправлен на проверку.\n\n${formatTaskCard(task)}`, getMainKeyboard(false, true));
    sendMessage(task.managerId, `Исполнитель сдал задачу #${task.id} на проверку.`, getManagerReviewTaskKeyboard(task.id));
    if (input.type === "document") {
      sendDocument(task.managerId, input.file_id, `Финальный материал по задаче #${task.id}`);
    } else {
      sendMessage(task.managerId, `Финальный материал:\n${input.value}`, getManagerReviewTaskKeyboard(task.id));
    }

    clearTaskReminder(task.id);
  }
}

async function managerApproveTask(chatId, managerId, taskId) {
  const task = tasks.find(item => item.id === taskId);
  if (!task || task.managerId !== managerId) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  task.status = "Выполнена";
  task.timeline.approvedAt = new Date().toISOString();
  clearTaskReminder(task.id);
  await saveTaskToDb(task);

  sendMessage(chatId, `Результат по задаче #${task.id} принят.\n\n${formatTaskCard(task)}`, getManagerReviewTaskKeyboard(task.id));
  sendMessage(task.assignedExecutorId, `Менеджер принял результат по задаче #${task.id}.`, getMainKeyboard(false, true));
}

async function managerSendFixes(chatId, managerId, taskId) {
  const task = tasks.find(item => item.id === taskId);
  if (!task || task.managerId !== managerId) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  task.status = "Правки";
  task.timeline.returnedForFixesAt = new Date().toISOString();
  clearTaskReminder(task.id);
  await saveTaskToDb(task);

  sendMessage(chatId, `Задача #${task.id} отправлена на правки.\n\n${formatTaskCard(task)}`, getManagerReviewTaskKeyboard(task.id));
  sendMessage(task.assignedExecutorId, `По задаче #${task.id} пришли правки. Свяжись с менеджером: ${task.managerContact}`, getExecutorTaskActionKeyboard(task));

  scheduleTaskReminder(task.id, "final");
}

async function managerMarkUnpaid(chatId, managerId, taskId) {
  const task = tasks.find(item => item.id === taskId);
  if (!task || task.managerId !== managerId) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  task.status = "Не оплачена";
  task.timeline.unpaidAt = new Date().toISOString();
  await saveTaskToDb(task);

  sendMessage(chatId, `Задача #${task.id} отмечена как не оплачена.\n\n${formatTaskCard(task)}`, getManagerReviewTaskKeyboard(task.id));
  sendMessage(task.assignedExecutorId, `По задаче #${task.id} статус оплаты: не оплачена.`, getMainKeyboard(false, true));
}

async function managerMarkPaid(chatId, managerId, taskId) {
  const task = tasks.find(item => item.id === taskId);
  if (!task || task.managerId !== managerId) {
    sendMessage(chatId, "Задача не найдена.");
    return;
  }

  task.status = "Оплачена";
  task.timeline.paidAt = new Date().toISOString();
  await saveTaskToDb(task);

  sendMessage(chatId, `Задача #${task.id} отмечена как оплачена.\n\n${formatTaskCard(task)}`, getMainKeyboard(true));
  sendMessage(task.assignedExecutorId, `По задаче #${task.id} статус оплаты: оплачена.`, getMainKeyboard(false, true));
}

/* -------------------- Main handlers -------------------- */

async function handleTextMessage(chatId, text, from, message) {
  const state = userStates.get(chatId);
  const executorProfile = executors.get(chatId);

  if (text === "/start") {
    userStates.delete(chatId);
    sendMessage(chatId, "Привет. Выбери роль:", getMainKeyboard(managers.has(chatId), Boolean(executorProfile)));
    return;
  }

  if (state?.type === "manager_contact") {
    await handleManagerContactStep(chatId, text, from);
    return;
  }

  if (state?.type === "create_task") {
    await handleTaskCreationStep(chatId, message, state);
    return;
  }

  if (state?.type === "executor_registration") {
    await handleExecutorRegistrationStep(chatId, message, state);
    return;
  }

  if (state?.type === "manager_review_executor") {
    await handleManagerReviewStep(chatId, text, from, state);
    return;
  }

  if (state?.type === "task_stage_material") {
    await handleTaskStageMaterial(chatId, message, state);
    return;
  }

  const actionMatch = text?.match(/^Действие по задаче #(\d+):\s(.+)$/);
  if (actionMatch) {
    await updateTaskStatusByExecutor(chatId, Number(actionMatch[1]), actionMatch[2]);
    return;
  }

  const approveMatch = text?.match(/^Принять результат #(\d+)$/);
  if (approveMatch && managers.has(chatId)) {
    await managerApproveTask(chatId, chatId, Number(approveMatch[1]));
    return;
  }

  const fixesMatch = text?.match(/^Отправить на правки #(\d+)$/);
  if (fixesMatch && managers.has(chatId)) {
    await managerSendFixes(chatId, chatId, Number(fixesMatch[1]));
    return;
  }

  const unpaidMatch = text?.match(/^Отметить не оплачена #(\d+)$/);
  if (unpaidMatch && managers.has(chatId)) {
    await managerMarkUnpaid(chatId, chatId, Number(unpaidMatch[1]));
    return;
  }

  const paidMatch = text?.match(/^Отметить оплачена #(\d+)$/);
  if (paidMatch && managers.has(chatId)) {
    await managerMarkPaid(chatId, chatId, Number(paidMatch[1]));
    return;
  }

  if (text === "Я исполнитель") {
    waitingForManagerPassword.delete(chatId);

    if (executorProfile) {
      sendMessage(
        chatId,
        `Режим исполнителя включён.\n\n${formatExecutorProfile(executorProfile)}`,
        getMainKeyboard(false, true)
      );
      return;
    }

    sendMessage(chatId, "Начинаем регистрацию исполнителя.", getMainKeyboard(false));
    startExecutorRegistration(chatId, from, null);
    return;
  }

  if (text === "Моя анкета") {
    if (!executorProfile) {
      sendMessage(chatId, "Анкета пока не заполнена. Нажми Я исполнитель, чтобы начать.", getMainKeyboard(false));
      return;
    }

    sendMessage(chatId, formatExecutorProfile(executorProfile), getMainKeyboard(false, true));

    if (executorProfile.paymentFile?.type === "document") {
      sendDocument(chatId, executorProfile.paymentFile.file_id, "Твой файл с реквизитами");
    }
    return;
  }

  if (text === "Редактировать анкету") {
    startExecutorRegistration(chatId, from, executorProfile || null);
    return;
  }

  if (text === "Новые задачи") {
    if (!executorProfile || executorProfile.status !== "Подтверждён") {
      sendMessage(chatId, "Новые задачи доступны только подтверждённым исполнителям.", getMainKeyboard(false, Boolean(executorProfile)));
      return;
    }

    const relevantTasks = tasks.filter(task => {
      return (
        (task.status === "Ждёт исполнителя" || task.status === "Есть отклики") &&
        executorProfile.verifiedSpecializations?.some(spec => task.categories.includes(spec))
      );
    });

    if (!relevantTasks.length) {
      sendMessage(chatId, "Сейчас новых задач нет.", getMainKeyboard(false, true));
      return;
    }

    const summary = relevantTasks
      .map(task => `#${task.id} — ${task.title} | ${formatCategories(task.categories)} | ${task.deadline} | ${task.price}`)
      .join("\n");

    sendMessage(chatId, `Новые задачи:\n\n${summary}`, getMainKeyboard(false, true));
    return;
  }

  if (text === "Мои отклики") {
    if (!executorProfile) {
      sendMessage(chatId, "Сначала заполни анкету.", getMainKeyboard(false));
      return;
    }

    const history = executorProfile.responseHistory || [];

    if (!history.length) {
      sendMessage(chatId, "У тебя пока нет откликов.", getMainKeyboard(false, true));
      return;
    }

    const summary = history
      .map(item => `#${item.taskId} — ${item.taskTitle} | ${item.decision}`)
      .join("\n");

    sendMessage(chatId, `Твои отклики:\n\n${summary}`, getMainKeyboard(false, true));
    return;
  }

  if (text === "Я менеджер") {
    waitingForManagerPassword.add(chatId);
    sendMessage(chatId, "Введи пароль менеджера.");
    return;
  }

  if (waitingForManagerPassword.has(chatId)) {
    if (text === MANAGER_PASSWORD) {
      waitingForManagerPassword.delete(chatId);
      if (!ensureManagerContact(chatId, from)) return;
      managers.add(chatId);
      sendMessage(chatId, "Доступ менеджера открыт.", getMainKeyboard(true));
    } else {
      sendMessage(chatId, "Неверный пароль. Попробуй ещё раз.");
    }
    return;
  }

  if (managers.has(chatId)) {
    if (text === "Создать задачу") {
      startTaskCreation(chatId, from);
      return;
    }

    if (text === "Опубликовать последнюю задачу") {
      const task = getLastManagerTask(chatId);
      if (!task) {
        sendMessage(chatId, "У тебя нет задач для публикации.", getMainKeyboard(true));
        return;
      }

      await publishTaskToExecutors(chatId, task);
      return;
    }

    if (text === "Отклики последней задачи") {
      const task = getLastManagerTask(chatId);
      if (!task) {
        sendMessage(chatId, "У тебя пока нет задач.", getMainKeyboard(true));
        return;
      }

      showResponsesForTask(chatId, task);
      return;
    }

    if (text === "Мои задачи") {
      const managerTasks = tasks.filter(task => task.managerId === chatId);

      if (!managerTasks.length) {
        sendMessage(chatId, "У тебя пока нет созданных задач.", getMainKeyboard(true));
        return;
      }

      const summary = managerTasks
        .map(task => `#${task.id} — ${task.title} | ${formatCategories(task.categories)} | ${task.status} | отклики: ${task.responses?.length || 0}`)
        .join("\n");

      sendMessage(chatId, `Твои задачи:\n\n${summary}`, getMainKeyboard(true));
      return;
    }

    if (text === "Заявки в исполнители") {
      showNextPendingExecutor(chatId);
      return;
    }

    if (text === "В меню менеджера") {
      sendMessage(chatId, "Меню менеджера.", getMainKeyboard(true));
      return;
    }

    sendMessage(chatId, "Ты в режиме менеджера. Выбери действие из меню.", getMainKeyboard(true));
    return;
  }

  sendMessage(chatId, "Напиши /start, чтобы выбрать роль.");
}

async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id;
  const from = callbackQuery.from;

  if (!chatId || !data) return;

  if (data.startsWith("assign_")) {
    const parts = data.split("_");
    const taskId = Number(parts[1]);
    const executorId = Number(parts[2]);

    if (!managers.has(from.id)) {
      sendMessage(chatId, "Назначать исполнителя может только менеджер.");
      answerCallback(callbackQuery.id, "Недостаточно прав");
      return;
    }

    await assignExecutorToTask(chatId, from.id, taskId, executorId);
    answerCallback(callbackQuery.id, "Исполнитель назначен");
    return;
  }

  if (data.startsWith("stage_")) {
    const parts = data.split("_");
    const stageKey = parts[1];
    const answer = parts[2];
    const taskId = Number(parts[3]);
    const task = tasks.find(t => t.id === taskId);

    if (!task || task.assignedExecutorId !== from.id) {
      answerCallback(callbackQuery.id, "Задача не найдена");
      return;
    }

    if (answer === "no") {
      answerCallback(callbackQuery.id, "Ок");
      return;
    }

    if (stageKey === "read") {
      await updateTaskStatusByExecutor(from.id, taskId, "Изучил ТЗ");
      answerCallback(callbackQuery.id, "Отмечено");
      return;
    }

    if (stageKey === "inwork") {
      await updateTaskStatusByExecutor(from.id, taskId, "Взял в работу");
      answerCallback(callbackQuery.id, "Отмечено");
      return;
    }

    if (stageKey === "30") {
      startStageMaterialCollection(from.id, taskId, "30");
      answerCallback(callbackQuery.id, "Жду материал");
      return;
    }

    if (stageKey === "60") {
      startStageMaterialCollection(from.id, taskId, "60");
      answerCallback(callbackQuery.id, "Жду материал");
      return;
    }

    if (stageKey === "final") {
      startStageMaterialCollection(from.id, taskId, "final");
      answerCallback(callbackQuery.id, "Жду финал");
      return;
    }
  }

  const executor = executors.get(from.id);

  if (!executor || executor.status !== "Подтверждён") {
    sendMessage(chatId, "Откликаться на задачи могут только подтверждённые исполнители.");
    answerCallback(callbackQuery.id, "Нет доступа");
    return;
  }

  const [action, rawTaskId] = data.split("_");
  const taskId = Number(rawTaskId);
  const task = tasks.find(item => item.id === taskId);

  if (!task) {
    sendMessage(chatId, "Задача не найдена.");
    answerCallback(callbackQuery.id, "Задача не найдена");
    return;
  }

  const existingResponse = task.responses.find(item => item.executorId === from.id);
  if (existingResponse) {
    sendMessage(chatId, "Ты уже ответил на эту задачу.");
    answerCallback(callbackQuery.id, "Ты уже ответил");
    return;
  }

  const decision = action === "accept" ? "Принял" : "Отклонил";

  const response = {
    executorId: from.id,
    executorName: executor.fullName || from.first_name || "Без имени",
    executorContact: getExecutorContactFromProfile(executor),
    decision,
    createdAt: new Date().toISOString()
  };

  task.responses.push(response);

  executor.responseHistory = executor.responseHistory || [];
  executor.responseHistory.push({
    taskId: task.id,
    taskTitle: task.title,
    decision,
    createdAt: new Date().toISOString()
  });

  executors.set(from.id, executor);
  await saveExecutorToDb(executor);

  if (getAcceptedResponses(task).length > 0 && task.status === "Ждёт исполнителя") {
    task.status = "Есть отклики";
  }

  await saveTaskToDb(task);

  sendMessage(chatId, `Твой отклик по задаче #${task.id} сохранён: ${decision}.`, getMainKeyboard(false, true));

  sendMessage(
    task.managerId,
    `Новый отклик по задаче #${task.id}.\n\nИсполнитель: ${executor.fullName}\nКонтакт: ${getExecutorContactFromProfile(executor)}\nРешение: ${decision}`,
    getMainKeyboard(true)
  );

  answerCallback(callbackQuery.id, `Сохранено: ${decision}`);
}

/* -------------------- Bootstrap -------------------- */

async function bootstrap() {
  try {
    await initDb();
    await loadAllDataFromDb();

    const server = http.createServer((req, res) => {
      console.log(`Incoming request: ${req.method} ${req.url}`);

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

            if (req.method === "GET" && req.url === "/api/executors/pending") {
        try {
          const list = getPendingExecutors().map(serializeExecutorProfile);
          sendJson(res, 200, { ok: true, executors: list });
        } catch (error) {
          console.error("GET /api/executors/pending error:", error);
          sendJson(res, 500, { error: "Failed to load pending executors" });
        }
        return;
      }

      if (req.method === "GET" && req.url === "/api/executors/approved") {
        try {
          const list = getApprovedExecutors()
            .sort((a, b) => {
              const ratingDiff = (b.rating || 0) - (a.rating || 0);
              if (ratingDiff !== 0) return ratingDiff;
              return (b.completedOrders || 0) - (a.completedOrders || 0);
            })
            .map(serializeExecutorProfile);
          sendJson(res, 200, { ok: true, executors: list });
        } catch (error) {
          console.error("GET /api/executors/approved error:", error);
          sendJson(res, 500, { error: "Failed to load approved executors" });
        }
        return;
      }

      if (req.method === "POST" && req.url === "/api/executors/moderate") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const telegramId = Number(payload.telegramId || 0);
            const decision = String(payload.decision || "").trim();
            const profile = executors.get(telegramId);

            if (!telegramId || !profile) {
              sendJson(res, 404, { error: "Executor not found" });
              return;
            }

            if (decision !== "approve" && decision !== "reject") {
              sendJson(res, 400, { error: "Invalid decision" });
              return;
            }

            const managerContact = payload.managerContact ? String(payload.managerContact).trim() : "Менеджер";
            const managerTelegramId = Number(payload.managerTelegramId || 0) || null;

            if (decision === "reject") {
              profile.status = "Отклонён";
              profile.approvedBy = managerContact;
              profile.approvedByManagerId = managerTelegramId;
              profile.updatedAt = new Date().toISOString();
              await saveExecutorToDb(profile);
              executors.set(profile.telegramId, profile);
              sendJson(res, 200, { ok: true, executor: serializeExecutorProfile(profile) });
              return;
            }

            const verifiedSpecializations = Array.isArray(payload.verifiedSpecializations)
              ? payload.verifiedSpecializations.map(item => String(item).trim()).filter(Boolean)
              : [];
            const reviewAccuracy = Number(payload.reviewAccuracy);
            const reviewSpeed = Number(payload.reviewSpeed);
            const reviewAesthetics = Number(payload.reviewAesthetics);

            if (!verifiedSpecializations.length) {
              sendJson(res, 400, { error: "verifiedSpecializations is required" });
              return;
            }

            if (![reviewAccuracy, reviewSpeed, reviewAesthetics].every(v => Number.isInteger(v) && v >= 1 && v <= 5)) {
              sendJson(res, 400, { error: "Invalid review scores" });
              return;
            }

            const baseRating = calculateBaseRating(reviewAccuracy, reviewSpeed, reviewAesthetics);
            const newcomerBoost = 0;
            const finalRating = baseRating + newcomerBoost;

            profile.status = "Подтверждён";
            profile.approvedBy = managerContact;
            profile.approvedByManagerId = managerTelegramId;
            profile.verifiedSpecializations = verifiedSpecializations;
            profile.reviewAccuracy = reviewAccuracy;
            profile.reviewSpeed = reviewSpeed;
            profile.reviewAesthetics = reviewAesthetics;
            profile.baseRating = baseRating;
            profile.newcomerBoost = newcomerBoost;
            profile.rating = finalRating;
            profile.completedOrders = profile.completedOrders || 0;
            profile.updatedAt = new Date().toISOString();

            await saveExecutorToDb(profile);
            executors.set(profile.telegramId, profile);

            sendJson(res, 200, { ok: true, executor: serializeExecutorProfile(profile) });
          } catch (error) {
            console.error("POST /api/executors/moderate error:", error);
            sendJson(res, 500, { error: "Failed to moderate executor" });
          }
        });

        return;
      }

      if (req.method === "GET" && req.url === "/api/tasks") {
        try {
          const groupedTasks = getMiniappTasksGrouped();
          sendJson(res, 200, groupedTasks);
        } catch (error) {
          console.error("GET /api/tasks error:", error);
          sendJson(res, 500, { error: "Failed to load tasks" });
        }
        return;
      }

      if (req.method === "POST" && req.url === "/api/executors/me") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const telegramId = Number(payload.telegramId || 0);

            if (!telegramId) {
              sendJson(res, 400, { error: "telegramId is required" });
              return;
            }

            const profile = executors.get(telegramId);

            if (!profile) {
              sendJson(res, 404, { error: "Executor not found" });
              return;
            }

            await ensureExecutorCodeForProfile(profile);

            sendJson(res, 200, { ok: true, executor: profile });
          } catch (error) {
            console.error("POST /api/executors/me error:", error);
            sendJson(res, 500, { error: "Failed to load executor" });
          }
        });

        return;
      }

      if (req.method === "POST" && req.url === "/api/executors/login-by-code") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const executorCode = String(payload.executorCode || "").trim().toUpperCase();

            if (!executorCode) {
              sendJson(res, 400, { error: "executorCode is required" });
              return;
            }

            const profile = Array.from(executors.values()).find(
              item => String(item.executorCode || "").toUpperCase() === executorCode
            );

            if (!profile) {
              sendJson(res, 404, { error: "Executor not found" });
              return;
            }

            const newTelegramId = Number(payload.telegramId || 0) || null;
            const newUsername = payload.username ? String(payload.username) : null;
            const newTelegramContact = payload.telegramContact ? String(payload.telegramContact).trim() : null;
            const oldTelegramId = profile.telegramId;

            if (newTelegramId && oldTelegramId !== newTelegramId) {
              await runQuery(`DELETE FROM executors WHERE telegram_id = $1`, [oldTelegramId]);
              executors.delete(oldTelegramId);
              profile.telegramId = newTelegramId;
            }

            if (newUsername !== null) {
              profile.username = newUsername;
            }

            if (newTelegramContact) {
              profile.telegramContact = newTelegramContact;
            }

            profile.updatedAt = new Date().toISOString();

            if (profile.telegramId) {
              await saveExecutorToDb(profile);
              executors.set(profile.telegramId, profile);
            }

            sendJson(res, 200, { ok: true, executor: profile });
          } catch (error) {
            console.error("POST /api/executors/login-by-code error:", error);
            sendJson(res, 500, { error: "Failed to login executor" });
          }
        });

        return;
      }

      if (req.method === "POST" && req.url === "/api/executors/register") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");

            const telegramId = Number(payload.telegramId || 0) || null;
            const username = payload.username ? String(payload.username) : null;
            const telegramContact = String(payload.telegramContact || "").trim();
            const fullName = String(payload.fullName || "").trim();
            const specializations = Array.isArray(payload.specializations)
              ? payload.specializations.map(item => String(item).trim()).filter(Boolean)
              : [];
            const portfolio = payload.portfolio ? String(payload.portfolio) : null;
            const paymentMethod = String(payload.paymentMethod || "").trim();
            const paymentDetailsValue = String(payload.paymentDetails || "").trim();
            const unavailableDays = Array.isArray(payload.unavailableDays)
              ? payload.unavailableDays.map(item => String(item).trim()).filter(Boolean)
              : [];
            const unavailableTime = payload.unavailableTime ? String(payload.unavailableTime) : "";

            if (!telegramContact) {
              sendJson(res, 400, { error: "telegramContact is required" });
              return;
            }

            if (!fullName) {
              sendJson(res, 400, { error: "fullName is required" });
              return;
            }

            if (!specializations.length) {
              sendJson(res, 400, { error: "At least one specialization is required" });
              return;
            }

            if (!paymentMethod) {
              sendJson(res, 400, { error: "paymentMethod is required" });
              return;
            }

            if (!paymentDetailsValue) {
              sendJson(res, 400, { error: "paymentDetails is required" });
              return;
            }

            let executorCode = generateExecutorCode();
            while (Array.from(executors.values()).some(item => item.executorCode === executorCode)) {
              executorCode = generateExecutorCode();
            }

            const profile = {
              telegramId,
              executorCode,
              username,
              telegramContact,
              fullName,
              specializations,
              verifiedSpecializations: [],
              portfolio,
              paymentMethod,
              paymentDetails: { type: "text", value: paymentDetailsValue },
              paymentFile: null,
              unavailableDays,
              unavailableTime,
              status: "На модерации",
              approvedBy: null,
              approvedByManagerId: null,
              reviewAccuracy: null,
              reviewSpeed: null,
              reviewAesthetics: null,
              baseRating: null,
              newcomerBoost: null,
              rating: null,
              completedOrders: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              responseHistory: []
            };

            await saveExecutorToDb(profile);

            if (telegramId) {
              executors.set(telegramId, profile);
            }

            notifyManagersAboutExecutor(profile);

            sendJson(res, 200, { ok: true, executor: profile });
          } catch (error) {
            console.error("POST /api/executors/register error:", error);
            sendJson(res, 500, { error: "Failed to register executor" });
          }
        });

        return;
      }

      if (req.method === "POST" && req.url === "/api/tasks") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");

            const title = String(payload.title || "").trim();
const categories = Array.isArray(payload.categories)
  ? payload.categories.map(item => String(item).trim()).filter(Boolean)
  : [];
const deadlineDate = String(payload.deadlineDate || "").trim();
const deadlineTime = String(payload.deadlineTime || "").trim();
const price = String(payload.price || "").trim();
const managerContact = String(payload.managerContact || "").trim();
const managerId = Number(payload.managerId || 0) || 0;
const managerUsername = payload.managerUsername ? String(payload.managerUsername) : null;
const sources = payload.sources ? String(payload.sources) : null;
const refsData = payload.refs_data ? String(payload.refs_data) : null;
const deliveryTarget = payload.deliveryTarget ? String(payload.deliveryTarget) : null;
const comment = payload.comment ? String(payload.comment) : null;

            if (!title) {
              sendJson(res, 400, { error: "Title is required" });
              return;
            }

            if (!categories.length) {
              sendJson(res, 400, { error: "At least one category is required" });
              return;
            }

            if (!deadlineDate) {
              sendJson(res, 400, { error: "Deadline date is required" });
              return;
            }

            if (!deadlineTime) {
              sendJson(res, 400, { error: "Deadline time is required" });
              return;
            }

            if (!price) {
              sendJson(res, 400, { error: "Price is required" });
              return;
            }

            if (!managerContact) {
              sendJson(res, 400, { error: "Manager contact is required" });
              return;
            }

            const newTask = {
              id: null,
              createdAt: new Date().toISOString(),
              managerId,
              managerUsername,
              managerContact,
              title,
              categories,
              deadlineDate,
              deadlineTime,
              deadline: `${deadlineDate} ${deadlineTime}`,
              price,
              brief: deliveryTarget
  ? { type: "text", value: deliveryTarget }
  : null,
sources: sources
  ? { type: "text", value: sources }
  : null,
refs_data: refsData
  ? { type: "text", value: refsData }
  : null,
comment,
              status: "Создана",
              responses: [],
              publishedAt: null,
              assignedExecutorId: null,
              assignedExecutorName: null,
              assignedExecutorContact: null,
              stageMaterials: {
                thirty: null,
                sixty: null,
                final: null
              },
              timeline: {
                assignedAt: null,
                briefReadAt: null,
                inWorkAt: null,
                shown30At: null,
                shown60At: null,
                submittedAt: null,
                approvedAt: null,
                returnedForFixesAt: null,
                unpaidAt: null,
                paidAt: null
              }
            };

            await saveTaskToDb(newTask);
            tasks.push(newTask);

            sendJson(res, 201, {
              ok: true,
              task: mapTaskForMiniapp(newTask)
            });
          } catch (error) {
            console.error("POST /api/tasks error:", error);
            sendJson(res, 500, { error: "Failed to create task" });
          }
        });

        return;
      }

      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Creative Conveyor is running");
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.method === "POST" && req.url === "/webhook") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          console.log("Webhook update:", body);

          try {
            const update = JSON.parse(body);

            if (update.callback_query) {
              await handleCallbackQuery(update.callback_query);
            } else if (update.message) {
              const message = update.message;
              const chatId = message?.chat?.id;
              const text = message?.text || null;
              const from = message?.from || null;

              if (chatId && message) {
                await handleTextMessage(chatId, text, from, message);
              }
            }
          } catch (error) {
            console.error("Parse error:", error);
          }

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true }));
        });

        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    });

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    process.exit(1);
  }
}

bootstrap();
