const http = require("http");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

const tasks = [];
const executors = new Map();
const managerContacts = new Map();

let pool = null;

function createDbPool() {
  if (!DATABASE_URL) return null;
  return new Pool({ connectionString: DATABASE_URL, ssl: false });
}

async function runQuery(text, params = []) {
  if (!pool) throw new Error("Database pool is not initialized");
  return pool.query(text, params);
}

async function initDb() {
  pool = createDbPool();
  if (!pool) return;

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
      completed_orders INTEGER NOT NULL DEFAULT 0,
      contract_data TEXT,
      payment_invoices JSONB NOT NULL DEFAULT '[]'::jsonb,
      response_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
      delivery_target TEXT,
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

  await runQuery(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_target TEXT`);

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
}

function generateExecutorCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "EX-";
  for (let i = 0; i < 6; i += 1) result += alphabet[Math.floor(Math.random() * alphabet.length)];
  return result;
}

async function loadExecutorsFromDb() {
  const result = await runQuery(`SELECT * FROM executors`);
  executors.clear();
  for (const row of result.rows) {
    executors.set(Number(row.telegram_id), {
      telegramId: Number(row.telegram_id),
      username: row.username,
      telegramContact: row.telegram_contact,
      executorCode: row.executor_code,
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
      contractData: row.contract_data || "",
      paymentInvoices: row.payment_invoices || [],
      responseHistory: row.response_history || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

async function loadTasksFromDb() {
  const tasksResult = await runQuery(`SELECT * FROM tasks ORDER BY id ASC`);
  const responsesResult = await runQuery(`SELECT * FROM task_responses ORDER BY id ASC`);
  const responsesByTaskId = new Map();
  for (const row of responsesResult.rows) {
    const taskId = Number(row.task_id);
    if (!responsesByTaskId.has(taskId)) responsesByTaskId.set(taskId, []);
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
      deliveryTarget: row.delivery_target || "",
      status: row.status,
      responses: responsesByTaskId.get(Number(row.id)) || [],
      publishedAt: row.published_at,
      assignedExecutorId: row.assigned_executor_id ? Number(row.assigned_executor_id) : null,
      assignedExecutorName: row.assigned_executor_name,
      assignedExecutorContact: row.assigned_executor_contact,
      stageMaterials: row.stage_materials || { thirty: null, sixty: null, final: null },
      timeline: row.timeline || {
        assignedAt: null, briefReadAt: null, inWorkAt: null, shown30At: null, shown60At: null,
        submittedAt: null, approvedAt: null, returnedForFixesAt: null, unpaidAt: null, paidAt: null
      }
    });
  }
}

async function loadAllDataFromDb() {
  await loadExecutorsFromDb();
  await loadTasksFromDb();
}

async function saveExecutorToDb(profile) {
  await runQuery(`
    INSERT INTO executors (
      telegram_id, username, telegram_contact, executor_code, full_name,
      specializations, verified_specializations, portfolio, payment_method, payment_details,
      payment_file, unavailable_days, unavailable_time, status, approved_by,
      approved_by_manager_id, review_accuracy, review_speed, review_aesthetics, base_rating,
      newcomer_boost, rating, completed_orders, contract_data, payment_invoices, response_history,
      created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb,
      $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
      $25::jsonb, $26::jsonb, $27, NOW()
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
      contract_data = EXCLUDED.contract_data,
      payment_invoices = EXCLUDED.payment_invoices,
      response_history = EXCLUDED.response_history,
      updated_at = NOW()
  `, [
    profile.telegramId, profile.username || null, profile.telegramContact, profile.executorCode || null, profile.fullName || null,
    JSON.stringify(profile.specializations || []), JSON.stringify(profile.verifiedSpecializations || []), profile.portfolio || null,
    profile.paymentMethod || null, profile.paymentDetails ? JSON.stringify(profile.paymentDetails) : null,
    profile.paymentFile ? JSON.stringify(profile.paymentFile) : null, JSON.stringify(profile.unavailableDays || []), profile.unavailableTime || "",
    profile.status || null, profile.approvedBy || null, profile.approvedByManagerId || null, profile.reviewAccuracy ?? null,
    profile.reviewSpeed ?? null, profile.reviewAesthetics ?? null, profile.baseRating ?? null, profile.newcomerBoost ?? null,
    profile.rating ?? null, profile.completedOrders ?? 0, profile.contractData || "", JSON.stringify(profile.paymentInvoices || []),
    JSON.stringify(profile.responseHistory || []), profile.createdAt || new Date().toISOString()
  ]);
}

async function saveTaskToDb(task) {
  let realId = task.id;
  if (!task.id) {
    const insertResult = await runQuery(`
      INSERT INTO tasks (
        manager_id, manager_username, manager_contact, title, categories, deadline_date,
        deadline_time, deadline, price, brief, sources, refs_data, comment, delivery_target,
        status, published_at, assigned_executor_id, assigned_executor_name, assigned_executor_contact,
        stage_materials, timeline, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13,
        $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22, NOW()
      )
      RETURNING id
    `, [
      task.managerId, task.managerUsername || null, task.managerContact, task.title || null,
      JSON.stringify(task.categories || []), task.deadlineDate || null, task.deadlineTime || null, task.deadline || null,
      task.price || null, task.brief ? JSON.stringify(task.brief) : null, task.sources ? JSON.stringify(task.sources) : null,
      task.refs_data ? JSON.stringify(task.refs_data) : null, task.comment || null, task.deliveryTarget || null,
      task.status || null, task.publishedAt || null, task.assignedExecutorId || null, task.assignedExecutorName || null,
      task.assignedExecutorContact || null, JSON.stringify(task.stageMaterials || {}), JSON.stringify(task.timeline || {}),
      task.createdAt || new Date().toISOString()
    ]);
    realId = Number(insertResult.rows[0].id);
    task.id = realId;
  } else {
    await runQuery(`
      UPDATE tasks
      SET manager_id = $2, manager_username = $3, manager_contact = $4, title = $5,
          categories = $6::jsonb, deadline_date = $7, deadline_time = $8, deadline = $9,
          price = $10, brief = $11::jsonb, sources = $12::jsonb, refs_data = $13::jsonb,
          comment = $14, delivery_target = $15, status = $16, published_at = $17,
          assigned_executor_id = $18, assigned_executor_name = $19, assigned_executor_contact = $20,
          stage_materials = $21::jsonb, timeline = $22::jsonb, updated_at = NOW()
      WHERE id = $1
    `, [
      task.id, task.managerId, task.managerUsername || null, task.managerContact, task.title || null,
      JSON.stringify(task.categories || []), task.deadlineDate || null, task.deadlineTime || null, task.deadline || null,
      task.price || null, task.brief ? JSON.stringify(task.brief) : null, task.sources ? JSON.stringify(task.sources) : null,
      task.refs_data ? JSON.stringify(task.refs_data) : null, task.comment || null, task.deliveryTarget || null,
      task.status || null, task.publishedAt || null, task.assignedExecutorId || null, task.assignedExecutorName || null,
      task.assignedExecutorContact || null, JSON.stringify(task.stageMaterials || {}), JSON.stringify(task.timeline || {})
    ]);
  }

  await runQuery(`DELETE FROM task_responses WHERE task_id = $1`, [realId]);
  for (const response of task.responses || []) {
    await runQuery(`
      INSERT INTO task_responses (task_id, executor_id, executor_name, executor_contact, decision, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [realId, response.executorId, response.executorName, response.executorContact, response.decision, response.createdAt || new Date().toISOString()]);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function getExecutorContactFromProfile(profile) {
  return profile.telegramContact || `id: ${profile.telegramId}`;
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
    createdAt: task.createdAt || null,
    comment: task.comment || "",
    briefText: task.brief?.type === "text" ? task.brief.value : task.brief?.caption || "",
    sourcesText: task.sources?.type === "text" ? task.sources.value : task.sources?.caption || "",
    refsText: task.refs_data?.type === "text" ? task.refs_data.value : task.refs_data?.caption || "",
    stageMaterials: task.stageMaterials || {}
  };
}

function groupTasksForManager() {
  const grouped = { waiting: [], active: [], archived: [] };
  for (const task of tasks) {
    const mapped = mapTaskForMiniapp(task);
    if (["Ждёт исполнителя", "Есть отклики", "Создана"].includes(task.status)) grouped.waiting.push(mapped);
    else if (["Назначена", "ТЗ изучено", "В работе", "30%", "60%", "На проверке", "Правки", "Не оплачена"].includes(task.status)) grouped.active.push(mapped);
    else grouped.archived.push(mapped);
  }
  return grouped;
}

function calculateBaseRating(accuracy, speed, aesthetics) {
  const startScore = accuracy * 0.5 + speed * 0.35 + aesthetics * 0.15;
  return Math.round(startScore * 20);
}

async function bootstrap() {
  await initDb();
  await loadAllDataFromDb();

  const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") return sendJson(res, 200, { ok: true });
    if (req.method === "GET" && req.url === "/api/tasks") return sendJson(res, 200, groupTasksForManager());

    if (req.method === "POST" && req.url === "/api/executors/me") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const telegramId = Number(payload.telegramId || 0);
          const profile = executors.get(telegramId);
          if (!profile) return sendJson(res, 404, { error: "Executor not found" });
          if (!profile.executorCode) {
            profile.executorCode = generateExecutorCode();
            await saveExecutorToDb(profile);
            executors.set(profile.telegramId, profile);
          }
          sendJson(res, 200, { ok: true, executor: profile });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to load executor" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/executors/login-by-code") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const executorCode = String(payload.executorCode || "").trim().toUpperCase();
          const profile = Array.from(executors.values()).find((item) => String(item.executorCode || "").toUpperCase() === executorCode);
          if (!profile) return sendJson(res, 404, { error: "Executor not found" });
          const telegramId = Number(payload.telegramId || 0) || null;
          if (telegramId) {
            executors.delete(profile.telegramId);
            profile.telegramId = telegramId;
            if (payload.username !== undefined) profile.username = payload.username || null;
            if (payload.telegramContact) profile.telegramContact = payload.telegramContact;
            await saveExecutorToDb(profile);
            executors.set(profile.telegramId, profile);
          }
          sendJson(res, 200, { ok: true, executor: profile });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to login executor" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tasks") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const task = {
            id: null,
            createdAt: new Date().toISOString(),
            managerId: Number(payload.managerId || 0),
            managerUsername: payload.managerUsername || null,
            managerContact: payload.managerContact,
            title: payload.title || "",
            categories: Array.isArray(payload.categories) ? payload.categories : [],
            deadlineDate: payload.deadlineDate || "",
            deadlineTime: payload.deadlineTime || "",
            deadline: `${payload.deadlineDate || ""} ${payload.deadlineTime || ""}`.trim(),
            price: payload.price || "",
            brief: payload.brief || null,
            sources: payload.sources ? { type: "text", value: payload.sources } : null,
            refs_data: payload.refs_data ? { type: "text", value: payload.refs_data } : null,
            comment: payload.comment || null,
            deliveryTarget: payload.deliveryTarget || null,
            status: "Ждёт исполнителя",
            responses: [],
            publishedAt: new Date().toISOString(),
            assignedExecutorId: null,
            assignedExecutorName: null,
            assignedExecutorContact: null,
            stageMaterials: { thirty: null, sixty: null, final: null },
            timeline: {
              assignedAt: null, briefReadAt: null, inWorkAt: null, shown30At: null, shown60At: null,
              submittedAt: null, approvedAt: null, returnedForFixesAt: null, unpaidAt: null, paidAt: null
            }
          };
          await saveTaskToDb(task);
          tasks.push(task);
          sendJson(res, 200, { ok: true, task: mapTaskForMiniapp(task) });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to create task" });
        }
      });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/api/tasks/manager")) {
      const url = new URL(req.url, "http://localhost");
      const managerContact = String(url.searchParams.get("managerContact") || "").trim();
      const filtered = tasks.filter((task) => !managerContact || task.managerContact === managerContact).map((task) => ({
        ...mapTaskForMiniapp(task),
        responsesCount: (task.responses || []).length,
        responses: (task.responses || []).map((r) => ({ executorId: r.executorId, executorName: r.executorName, executorContact: r.executorContact, decision: r.decision }))
      }));
      return sendJson(res, 200, { tasks: filtered });
    }

    if (req.method === "GET" && req.url.startsWith("/api/tasks/executor")) {
      const url = new URL(req.url, "http://localhost");
      const telegramId = Number(url.searchParams.get("telegramId") || 0);
      const profile = executors.get(telegramId);
      if (!profile) return sendJson(res, 200, { available: [], active: [], archived: [] });
      const available = tasks
        .filter((task) => ["Ждёт исполнителя", "Есть отклики"].includes(task.status) && profile.verifiedSpecializations?.some((spec) => (task.categories || []).includes(spec)))
        .map((task) => {
          const response = (task.responses || []).find((item) => item.executorId === telegramId);
          return { ...mapTaskForMiniapp(task), myDecision: response?.decision || null };
        });
      const active = tasks.filter((task) => task.assignedExecutorId === telegramId && ["Назначена", "ТЗ изучено", "В работе", "30%", "60%", "На проверке", "Правки", "Не оплачена"].includes(task.status)).map(mapTaskForMiniapp);
      const archived = tasks.filter((task) => task.assignedExecutorId === telegramId && ["Выполнена", "Оплачена"].includes(task.status)).map(mapTaskForMiniapp);
      return sendJson(res, 200, { available, active, archived });
    }

    if (req.method === "POST" && req.url === "/api/tasks/respond") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const taskId = Number(payload.taskId || 0);
          const telegramId = Number(payload.telegramId || 0);
          const decision = payload.decision === "accept" ? "Принял" : "Отклонил";
          const task = tasks.find((item) => item.id === taskId);
          const executor = executors.get(telegramId);
          if (!task || !executor) return sendJson(res, 404, { error: "Task or executor not found" });
          if (!(task.responses || []).find((r) => r.executorId === telegramId)) {
            const response = {
              executorId: telegramId,
              executorName: executor.fullName || executor.username || "Без имени",
              executorContact: getExecutorContactFromProfile(executor),
              decision,
              createdAt: new Date().toISOString()
            };
            task.responses.push(response);
            executor.responseHistory = executor.responseHistory || [];
            executor.responseHistory.push({ taskId: task.id, taskTitle: task.title, decision, createdAt: new Date().toISOString() });
            if (decision === "Принял" && task.status === "Ждёт исполнителя") task.status = "Есть отклики";
            await saveExecutorToDb(executor);
            executors.set(executor.telegramId, executor);
            await saveTaskToDb(task);
          }
          sendJson(res, 200, { ok: true });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to save response" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tasks/assign") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const task = tasks.find((item) => item.id === Number(payload.taskId || 0));
          const executor = executors.get(Number(payload.executorId || 0));
          if (!task || !executor) return sendJson(res, 404, { error: "Task or executor not found" });
          task.assignedExecutorId = executor.telegramId;
          task.assignedExecutorName = executor.fullName;
          task.assignedExecutorContact = getExecutorContactFromProfile(executor);
          task.status = "Назначена";
          task.timeline.assignedAt = new Date().toISOString();
          await saveTaskToDb(task);
          sendJson(res, 200, { ok: true, task: mapTaskForMiniapp(task) });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to assign task" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tasks/executor-action") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const task = tasks.find((item) => item.id === Number(payload.taskId || 0));
          const telegramId = Number(payload.telegramId || 0);
          const action = String(payload.action || "");
          if (!task || task.assignedExecutorId !== telegramId) return sendJson(res, 404, { error: "Task not found" });
          if (action === "Изучил ТЗ" && task.status === "Назначена") {
            task.status = "ТЗ изучено";
            task.timeline.briefReadAt = new Date().toISOString();
          } else if (action === "Взял в работу" && task.status === "ТЗ изучено") {
            task.status = "В работе";
            task.timeline.inWorkAt = new Date().toISOString();
          } else {
            return sendJson(res, 400, { error: "Invalid action" });
          }
          await saveTaskToDb(task);
          sendJson(res, 200, { ok: true, task: mapTaskForMiniapp(task) });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to update task" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tasks/stage-submit") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const task = tasks.find((item) => item.id === Number(payload.taskId || 0));
          const telegramId = Number(payload.telegramId || 0);
          const stageKey = String(payload.stageKey || "");
          const value = String(payload.value || "").trim();
          if (!task || task.assignedExecutorId !== telegramId) return sendJson(res, 404, { error: "Task not found" });
          const field = { type: "text", value, createdAt: new Date().toISOString() };
          if (stageKey === "30" && task.status === "В работе") {
            task.stageMaterials.thirty = field;
            task.status = "30%";
            task.timeline.shown30At = new Date().toISOString();
          } else if (stageKey === "60" && task.status === "30%") {
            task.stageMaterials.sixty = field;
            task.status = "60%";
            task.timeline.shown60At = new Date().toISOString();
          } else if (stageKey === "final" && ["60%", "Правки"].includes(task.status)) {
            task.stageMaterials.final = field;
            task.status = "На проверке";
            task.timeline.submittedAt = new Date().toISOString();
          } else {
            return sendJson(res, 400, { error: "Invalid stage action" });
          }
          await saveTaskToDb(task);
          sendJson(res, 200, { ok: true, task: mapTaskForMiniapp(task) });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to submit stage material" });
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/tasks/manager-stage-action") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const task = tasks.find((item) => item.id === Number(payload.taskId || 0));
          if (!task) return sendJson(res, 404, { error: "Task not found" });
          if (payload.action === "approve") {
            task.status = "Выполнена";
            task.timeline.approvedAt = new Date().toISOString();
            const executor = executors.get(task.assignedExecutorId);
            if (executor) {
              executor.completedOrders = (executor.completedOrders || 0) + 1;
              await saveExecutorToDb(executor);
              executors.set(executor.telegramId, executor);
            }
          } else if (payload.action === "fixes") {
            task.status = "Правки";
            task.timeline.returnedForFixesAt = new Date().toISOString();
          } else if (payload.action === "unpaid") {
            task.status = "Не оплачена";
            task.timeline.unpaidAt = new Date().toISOString();
          } else if (payload.action === "paid") {
            task.status = "Оплачена";
            task.timeline.paidAt = new Date().toISOString();
          } else {
            return sendJson(res, 400, { error: "Unknown action" });
          }
          await saveTaskToDb(task);
          sendJson(res, 200, { ok: true, task: mapTaskForMiniapp(task) });
        } catch (error) {
          console.error(error);
          sendJson(res, 500, { error: "Failed to update manager stage action" });
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Creative Conveyor is running");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Bootstrap error:", error);
  process.exit(1);
});
