import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  User,
  Calculator,
  PlusSquare,
  ChevronRight,
  Lock,
  Search,
  Clock3,
  Archive,
  CircleDot,
  Users,
  CheckCircle2,
  Circle,
  Paperclip
} from "lucide-react";

type Task = {
  id: number;
  title: string;
  type: string[];
  deadline: string;
  price: string;
  manager: string;
  status?: string;
  assignedExecutorId?: number | null;
  assignedExecutorName?: string | null;
  assignedExecutorContact?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  myDecision?: string | null;
  responsesCount?: number;
  responses?: Array<{
    executorId: number;
    executorName: string;
    executorContact: string;
    decision: string;
  }>;
  briefText?: string;
  sourcesText?: string;
  refsText?: string;
  comment?: string | null;
  stageMaterials?: {
    thirty?: { type?: string; value?: string; createdAt?: string } | null;
    sixty?: { type?: string; value?: string; createdAt?: string } | null;
    final?: { type?: string; value?: string; createdAt?: string } | null;
  };
};

type TasksResponse = {
  waiting: Task[];
  active: Task[];
  archived: Task[];
};

type ExecutorProfile = {
  telegramId?: number;
  executorCode?: string;
  username?: string | null;
  telegramContact?: string | null;
  fullName?: string | null;
  specializations?: string[];
  verifiedSpecializations?: string[];
  portfolio?: string | null;
  paymentMethod?: string | null;
  paymentDetails?: any;
  unavailableDays?: string[];
  unavailableTime?: string | null;
  status?: string | null;
  approvedBy?: string | null;
  rating?: number | null;
  completedOrders?: number;
};

const API_BASE = "https://creative-conveyor-backend.onrender.com";

const SPECIALIZATION_OPTIONS = ["Статика", "Моушен", "Лендинги"];

const managerBottomTabs = [
  { key: "executors", label: "Исполнители", icon: Users },
  { key: "tasks", label: "Задачи", icon: Briefcase },
  { key: "create", label: "Создать", icon: PlusSquare },
  { key: "calculator", label: "Калькулятор", icon: Calculator },
  { key: "profile", label: "Профиль", icon: User }
] as const;

const executorBottomTabs = [
  { key: "tasks", label: "Задачи", icon: Briefcase },
  { key: "profile", label: "Профиль", icon: User }
] as const;

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function RoleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left text-lg font-medium text-white transition hover:bg-white/10 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <ChevronRight className="h-5 w-5 text-white/50" />
      </div>
    </button>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25" />;
}

function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-[110px] w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25" />;
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{task.id}</div>
          <div className="text-base font-semibold leading-5 text-white">{task.title}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">{task.status || "—"}</div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(task.type || []).map((item) => (
          <span key={item} className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]">{item}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
        <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Дедлайн</div><div>{task.deadline || "—"}</div></div>
        <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Стоимость</div><div>{task.price || "—"}</div></div>
      </div>
      <div className="mt-3 text-sm text-white/55">Менеджер: {task.manager || "—"}</div>
    </div>
  );
}

function StageValue({ material }: { material?: { value?: string; createdAt?: string } | null }) {
  if (!material?.value) return <span className="text-white/40">не загружено</span>;
  return (
    <div className="flex items-center gap-2 text-white/80">
      <Paperclip className="h-3.5 w-3.5 text-[#56FFEF]" />
      <span className="truncate">{material.value}</span>
    </div>
  );
}

function TaskStageTimeline({
  task,
  compact = false
}: {
  task: Task;
  compact?: boolean;
}) {
  const materials = task.stageMaterials || {};
  const steps = [
    {
      key: "tz",
      title: "Изучил ТЗ",
      done: ["ТЗ изучено", "В работе", "30%", "60%", "На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена"].includes(task.status || ""),
      value: null as any
    },
    {
      key: "30",
      title: "30%",
      done: Boolean(materials.thirty),
      value: materials.thirty
    },
    {
      key: "60",
      title: "60%",
      done: Boolean(materials.sixty),
      value: materials.sixty
    },
    {
      key: "final",
      title: "Финал",
      done: Boolean(materials.final) || ["На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена"].includes(task.status || ""),
      value: materials.final
    }
  ];

  return (
    <div className={cn("rounded-[24px] border border-white/8 bg-black/20", compact ? "p-3" : "p-4")}>
      <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Этапы выполнения</div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.key} className="relative flex gap-3">
            <div className="flex w-5 flex-col items-center">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-[#56FFEF]" />
              ) : (
                <Circle className="h-5 w-5 text-white/25" />
              )}
              {index !== steps.length - 1 ? (
                <div className={cn("mt-1 w-px flex-1", step.done ? "bg-[#56FFEF]/40" : "bg-white/10")} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">{step.title}</div>
                <div className={cn("text-xs", step.done ? "text-[#56FFEF]" : "text-white/40")}>
                  {step.done ? "загружено" : "не загружено"}
                </div>
              </div>
              {step.key === "tz" ? (
                <div className="mt-1 text-sm text-white/45">
                  {step.done ? "Исполнитель подтвердил ознакомление с ТЗ" : "Шаг ещё не подтверждён"}
                </div>
              ) : (
                <div className="mt-1 text-sm">
                  <StageValue material={step.value} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<
    | "welcome" | "managerPassword" | "managerApp" | "executorLoading" | "executorRegister" | "executorForm" | "executorCodeLogin" | "executorPending" | "executorApp"
  >("welcome");

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [managerBottomTab, setManagerBottomTab] = useState<(typeof managerBottomTabs)[number]["key"]>("tasks");
  const [managerTaskTopTab, setManagerTaskTopTab] = useState<"waiting" | "active" | "archived">("waiting");
  const [executorBottomTab, setExecutorBottomTab] = useState<(typeof executorBottomTabs)[number]["key"]>("tasks");
  const [executorTaskTopTab, setExecutorTaskTopTab] = useState<"new" | "active" | "archived">("new");

  const [tasksData, setTasksData] = useState<TasksResponse>({ waiting: [], active: [], archived: [] });
  const [managerTasks, setManagerTasks] = useState<Task[]>([]);
  const [executorTasks, setExecutorTasks] = useState<{ available: Task[]; active: Task[]; archived: Task[] }>({ available: [], active: [], archived: [] });
  const [executor, setExecutor] = useState<ExecutorProfile | null>(null);
  const [executorCode, setExecutorCode] = useState("");
  const [executorError, setExecutorError] = useState("");

  const [stageTaskId, setStageTaskId] = useState<number | null>(null);
  const [stageKey, setStageKey] = useState<"30" | "60" | "final" | null>(null);
  const [stageValue, setStageValue] = useState("");
  const [stageError, setStageError] = useState("");
  const [stageLoading, setStageLoading] = useState(false);

  const [createTitle, setCreateTitle] = useState("");
  const [createCategories, setCreateCategories] = useState<string[]>([]);
  const [createDeadlineDate, setCreateDeadlineDate] = useState("");
  const [createDeadlineTime, setCreateDeadlineTime] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createManagerContact, setCreateManagerContact] = useState("");
  const [createSources, setCreateSources] = useState("");
  const [createRefs, setCreateRefs] = useState("");
  const [createDeliveryTarget, setCreateDeliveryTarget] = useState("");
  const [createComment, setCreateComment] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  useEffect(() => {
    const telegram = (window as any)?.Telegram?.WebApp;
    telegram?.ready?.();
    const username = telegram?.initDataUnsafe?.user?.username;
    if (username) setCreateManagerContact(`@${username}`);
  }, []);

  const visibleManagerTasks = useMemo(() => {
    if (managerTaskTopTab === "waiting") return tasksData.waiting;
    if (managerTaskTopTab === "active") return tasksData.active;
    return tasksData.archived;
  }, [tasksData, managerTaskTopTab]);

  const visibleExecutorTasks = useMemo(() => {
    if (executorTaskTopTab === "new") return executorTasks.available.filter((t) => !t.myDecision);
    if (executorTaskTopTab === "active") return executorTasks.active;
    return executorTasks.archived;
  }, [executorTasks, executorTaskTopTab]);

  const loadPublicTasks = async () => {
    const response = await fetch(`${API_BASE}/api/tasks`);
    if (!response.ok) throw new Error("Failed to load tasks");
    const data = await response.json();
    setTasksData({
      waiting: Array.isArray(data.waiting) ? data.waiting : [],
      active: Array.isArray(data.active) ? data.active : [],
      archived: Array.isArray(data.archived) ? data.archived : []
    });
  };

  const loadManagerTasks = async () => {
    if (!createManagerContact.trim()) return;
    const response = await fetch(`${API_BASE}/api/tasks/manager?managerContact=${encodeURIComponent(createManagerContact.trim())}`);
    if (!response.ok) throw new Error("Failed to load manager tasks");
    const data = await response.json();
    setManagerTasks(Array.isArray(data.tasks) ? data.tasks : []);
  };

  const loadExecutorTasks = async () => {
    const telegram = (window as any)?.Telegram?.WebApp;
    const user = telegram?.initDataUnsafe?.user;
    if (!user?.id) return;
    const response = await fetch(`${API_BASE}/api/tasks/executor?telegramId=${user.id}`);
    if (!response.ok) throw new Error("Failed to load executor tasks");
    const data = await response.json();
    setExecutorTasks({
      available: Array.isArray(data.available) ? data.available : [],
      active: Array.isArray(data.active) ? data.active : [],
      archived: Array.isArray(data.archived) ? data.archived : []
    });
  };

  useEffect(() => {
    if (screen === "managerApp") {
      void loadPublicTasks().catch(console.error);
      void loadManagerTasks().catch(console.error);
    }
  }, [screen]);

  useEffect(() => {
    if (screen === "executorApp") {
      void loadExecutorTasks().catch(console.error);
    }
  }, [screen, executorTaskTopTab]);

  useEffect(() => {
    if (screen === "executorApp" && executorBottomTab === "tasks" && executorTaskTopTab === "new") {
      const id = setInterval(() => void loadExecutorTasks().catch(console.error), 15000);
      return () => clearInterval(id);
    }
  }, [screen, executorBottomTab, executorTaskTopTab]);

  const loadExecutor = async () => {
    try {
      setExecutorError("");
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;
      if (!user?.id) {
        setScreen("executorRegister");
        return;
      }
      const res = await fetch(`${API_BASE}/api/executors/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: user.id })
      });
      if (res.status === 404) {
        setScreen("executorRegister");
        return;
      }
      const data = await res.json();
      if (!data?.executor) {
        setScreen("executorRegister");
        return;
      }
      setExecutor(data.executor);
      if (data.executor.status === "На модерации") setScreen("executorPending");
      else if (data.executor.status === "Подтверждён") setScreen("executorApp");
      else setScreen("executorRegister");
    } catch (error) {
      console.error(error);
      setScreen("executorRegister");
    }
  };

  const handleManagerLogin = () => {
    if (!password.trim()) {
      setPasswordError("Введи пароль менеджера");
      return;
    }
    setPasswordError("");
    setScreen("managerApp");
  };

  const handleCreateTask = async () => {
    if (!createTitle.trim() || !createCategories.length || !createDeadlineDate || !createDeadlineTime || !createPrice.trim() || !createManagerContact.trim()) {
      setCreateError("Заполни обязательные поля");
      return;
    }
    try {
      setCreateError("");
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId: 0,
          managerUsername: null,
          managerContact: createManagerContact.trim(),
          title: createTitle.trim(),
          categories: createCategories,
          deadlineDate: createDeadlineDate.trim(),
          deadlineTime: createDeadlineTime.trim(),
          price: createPrice.trim(),
          sources: createSources.trim() || null,
          refs_data: createRefs.trim() || null,
          deliveryTarget: createDeliveryTarget.trim() || null,
          comment: createComment.trim() || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed");
      setCreateSuccess("Задача создана");
      setCreateTitle("");
      setCreateCategories([]);
      setCreateDeadlineDate("");
      setCreateDeadlineTime("");
      setCreatePrice("");
      setCreateSources("");
      setCreateRefs("");
      setCreateDeliveryTarget("");
      setCreateComment("");
      await loadPublicTasks();
      await loadManagerTasks();
      setManagerBottomTab("tasks");
      setManagerTaskTopTab("waiting");
    } catch (error) {
      console.error(error);
      setCreateError("Не удалось создать задачу");
    }
  };

  const handleExecutorCodeLogin = async () => {
    if (!executorCode.trim()) {
      setExecutorError("Введи ID исполнителя");
      return;
    }
    try {
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;
      const response = await fetch(`${API_BASE}/api/executors/login-by-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executorCode: executorCode.trim(),
          telegramId: user?.id || null,
          username: user?.username || null,
          telegramContact: user?.username ? `@${user.username}` : null
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.executor) {
        setExecutorError("Исполнитель с таким ID не найден");
        return;
      }
      setExecutor(data.executor);
      if (data.executor.status === "На модерации") setScreen("executorPending");
      else setScreen("executorApp");
    } catch (error) {
      console.error(error);
      setExecutorError("Не удалось войти");
    }
  };

  const handleTaskResponse = async (taskId: number, decision: "accept" | "decline") => {
    try {
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;
      await fetch(`${API_BASE}/api/tasks/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, telegramId: user?.id || null, decision })
      });
      await loadExecutorTasks();
      await loadManagerTasks();
      await loadPublicTasks();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAssignTask = async (taskId: number, executorId: number) => {
    try {
      await fetch(`${API_BASE}/api/tasks/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, executorId })
      });
      await loadManagerTasks();
      await loadPublicTasks();
    } catch (error) {
      console.error(error);
    }
  };

  const executorActionButtonLabel = (status?: string | null) => {
    if (status === "Назначена") return "Изучил ТЗ";
    if (status === "ТЗ изучено") return "Взял в работу";
    if (status === "В работе") return "Отправить 30%";
    if (status === "30%") return "Отправить 60%";
    if (status === "60%" || status === "Правки") return "Сдать задачу";
    return null;
  };

  const handleExecutorStageAction = async (task: Task) => {
    const label = executorActionButtonLabel(task.status);
    if (!label) return;
    if (label === "Изучил ТЗ" || label === "Взял в работу") {
      try {
        const telegram = (window as any)?.Telegram?.WebApp;
        const user = telegram?.initDataUnsafe?.user;
        await fetch(`${API_BASE}/api/tasks/executor-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, telegramId: user?.id || null, action: label })
        });
        await loadExecutorTasks();
        await loadManagerTasks();
        await loadPublicTasks();
      } catch (error) {
        console.error(error);
      }
      return;
    }
    setStageTaskId(task.id);
    setStageKey(label === "Отправить 30%" ? "30" : label === "Отправить 60%" ? "60" : "final");
    setStageValue("");
    setStageError("");
  };

  const submitStageMaterial = async () => {
    if (!stageTaskId || !stageKey) return;
    if (!stageValue.trim()) {
      setStageError("Введи ссылку, текст или комментарий");
      return;
    }
    try {
      setStageLoading(true);
      setStageError("");
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;
      await fetch(`${API_BASE}/api/tasks/stage-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: stageTaskId, telegramId: user?.id || null, stageKey, value: stageValue.trim() })
      });
      setStageTaskId(null);
      setStageKey(null);
      setStageValue("");
      await loadExecutorTasks();
      await loadManagerTasks();
      await loadPublicTasks();
    } catch (error) {
      console.error(error);
      setStageError("Не удалось отправить материал");
    } finally {
      setStageLoading(false);
    }
  };

  const handleManagerStageAction = async (taskId: number, action: "approve" | "fixes" | "unpaid" | "paid") => {
    try {
      await fetch(`${API_BASE}/api/tasks/manager-stage-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action })
      });
      await loadManagerTasks();
      await loadPublicTasks();
      await loadExecutorTasks();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white" style={{ fontFamily: "Involve, Inter, system-ui, sans-serif" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[radial-gradient(circle_at_top,rgba(86,255,239,0.14),transparent_34%),linear-gradient(180deg,#0b0b10_0%,#09090b_100%)]">
        <AnimatePresence mode="wait">
          {screen === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <div className="mb-10 mt-auto">
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">ЛЭНД</div>
                <h1 className="max-w-[320px] text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-white">Привет! Это креативный конвейер ЛЭНД</h1>
                <p className="mt-4 text-base text-white/45">Выбери роль</p>
              </div>
              <div className="mb-auto space-y-3">
                <RoleButton label="Я менеджер" onClick={() => setScreen("managerPassword")} />
                <RoleButton label="Я исполнитель" onClick={() => { setScreen("executorLoading"); void loadExecutor(); }} />
              </div>
            </motion.div>
          )}

          {screen === "managerPassword" && (
            <motion.div key="managerPassword" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("welcome")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="mb-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><Lock className="h-5 w-5 text-white/70" /></div>
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Вход менеджера</h2>
                <p className="mt-2 text-sm text-white/45">Введи пароль, чтобы открыть менеджерский интерфейс</p>
              </div>
              <div className="space-y-3">
                <FormInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
                {passwordError ? <div className="px-1 text-sm text-rose-300">{passwordError}</div> : null}
                <button onClick={handleManagerLogin} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 active:scale-[0.99]">Войти</button>
              </div>
            </motion.div>
          )}

          {screen === "executorLoading" && (
            <motion.div key="executorLoading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-[#56FFEF]/15 blur-[2px]" />
              <div className="text-base text-white/75">Проверяем ваш аккаунт исполнителя…</div>
            </motion.div>
          )}

          {screen === "executorRegister" && (
            <motion.div key="executorRegister" className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("welcome")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-sm text-white/55">Сохрани свою текущую реализацию регистрации исполнителя. Этот файл сфокусирован на этапах задач.</div>
            </motion.div>
          )}

          {screen === "executorCodeLogin" && (
            <motion.div key="executorCodeLogin" className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("executorRegister")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="mb-8">
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Вход по ID исполнителя</h2>
              </div>
              <div className="space-y-3">
                <FormInput value={executorCode} onChange={(e) => setExecutorCode(e.target.value.toUpperCase())} placeholder="Например: EX-7K3D9A" />
                {executorError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{executorError}</div> : null}
                <button onClick={() => void handleExecutorCodeLogin()} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Войти</button>
              </div>
            </motion.div>
          )}

          {screen === "executorPending" && (
            <motion.div key="executorPending" className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("welcome")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div>
                <div className="text-base text-white">{executor?.executorCode || "—"}</div>
              </div>
            </motion.div>
          )}

          {screen === "executorApp" && (
            <motion.div key="executorApp" className="flex min-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/35">Исполнитель</div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{executorBottomTab === "tasks" ? "Задачи" : "Профиль"}</div>
                </div>
                {executorBottomTab === "tasks" && (
                  <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                    {[
                      { key: "new", label: "Новые", icon: CircleDot },
                      { key: "active", label: "Активные", icon: Clock3 },
                      { key: "archived", label: "Архив", icon: Archive }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = executorTaskTopTab === (tab.key as any);
                      return <button key={tab.key} onClick={() => setExecutorTaskTopTab(tab.key as any)} className={cn("rounded-[18px] px-3 py-3 text-left transition", active ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}><Icon className="mb-2 h-4 w-4" /><div className="text-[12px] font-medium leading-4">{tab.label}</div></button>;
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1 px-5 pb-28 pt-4">
                {executorBottomTab === "profile" ? (
                  <div className="space-y-3">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div><div>{executor?.executorCode || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Контакт</div><div>{executor?.telegramContact || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Статус</div><div>{executor?.status || "—"}</div></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleExecutorTasks.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Здесь пока нет задач.</div> : visibleExecutorTasks.map((task) => (
                      <div key={task.id} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                        <TaskCard task={task} />
                        {executorTaskTopTab !== "archived" && (
                          <div className="mt-4 space-y-3">
                            {executorTaskTopTab === "new" ? (
                              <div className="flex gap-2">
                                <button onClick={() => void handleTaskResponse(task.id, "accept")} className="flex-1 rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Откликнуться</button>
                                <button onClick={() => void handleTaskResponse(task.id, "decline")} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Скрыть</button>
                              </div>
                            ) : (
                              <>
                                <div className="rounded-2xl bg-black/20 p-3 text-sm text-white/70">
                                  <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Материалы задачи</div>
                                  <div>ТЗ: {task.briefText || "—"}</div>
                                  <div>Источники: {task.sourcesText || "—"}</div>
                                  <div>Референсы: {task.refsText || "—"}</div>
                                  <div>Комментарий: {task.comment || "—"}</div>
                                </div>
                                <TaskStageTimeline task={task} />
                                {executorActionButtonLabel(task.status) ? <button onClick={() => void handleExecutorStageAction(task)} className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">{executorActionButtonLabel(task.status)}</button> : null}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-2">
                  {executorBottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = executorBottomTab === tab.key;
                    return <button key={tab.key} onClick={() => setExecutorBottomTab(tab.key)} className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", active ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}><Icon className="h-5 w-5" /><span className="text-[10px] leading-none">{tab.label}</span></button>;
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {screen === "managerApp" && (
            <motion.div key="managerApp" className="flex min-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Креативный конвейер ЛЭНД</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{managerBottomTab === "create" ? "Создать задачу" : managerBottomTab === "tasks" ? "Задачи" : managerBottomTab === "profile" ? "Профиль" : managerBottomTab === "executors" ? "Исполнители" : "Калькулятор"}</div>
                  </div>
                  <button onClick={() => { void loadPublicTasks().catch(console.error); void loadManagerTasks().catch(console.error); }} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70"><Search className="h-5 w-5" /></button>
                </div>
                {managerBottomTab === "tasks" && (
                  <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                    {[
                      { key: "waiting", label: "Ждут исполнителя", icon: CircleDot },
                      { key: "active", label: "Активные", icon: Clock3 },
                      { key: "archived", label: "Архивные", icon: Archive }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = managerTaskTopTab === (tab.key as any);
                      return <button key={tab.key} onClick={() => setManagerTaskTopTab(tab.key as any)} className={cn("rounded-[18px] px-3 py-3 text-left transition", active ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}><Icon className="mb-2 h-4 w-4" /><div className="text-[12px] font-medium leading-4">{tab.label}</div></button>;
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1 px-5 pb-28 pt-4">
                {managerBottomTab === "tasks" ? (
                  <div className="space-y-4">
                    {visibleManagerTasks.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Здесь пока нет задач.</div> : visibleManagerTasks.map((task) => {
                      const managerTask = managerTasks.find((item) => item.id === task.id) || task;
                      return (
                        <div key={task.id} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                          <TaskCard task={task} />
                          {managerTask.responses && managerTask.responses.length > 0 ? (
                            <div className="mt-4 space-y-3">
                              <div className="text-sm text-white/60">Отклики: {managerTask.responses.length}</div>
                              {managerTask.responses.map((response) => (
                                <div key={`${task.id}-${response.executorId}`} className="rounded-2xl bg-black/20 p-3 text-sm text-white/75">
                                  <div className="font-medium text-white">{response.executorName}</div>
                                  <div>{response.executorContact}</div>
                                  <div className="mt-2">{response.decision}</div>
                                  {managerTaskTopTab === "waiting" && response.decision === "Принял" ? <button onClick={() => void handleAssignTask(task.id, response.executorId)} className="mt-3 rounded-2xl bg-[#56FFEF] px-4 py-2 text-sm font-medium text-black">Назначить</button> : null}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {managerTaskTopTab === "active" ? (
                            <div className="mt-4 space-y-3">
                              <TaskStageTimeline task={managerTask} />
                              <div className="grid grid-cols-1 gap-2">
                                <button onClick={() => void handleManagerStageAction(task.id, "approve")} className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Принять результат</button>
                                <button onClick={() => void handleManagerStageAction(task.id, "fixes")} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Отправить на правки</button>
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => void handleManagerStageAction(task.id, "unpaid")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Не оплачена</button>
                                  <button onClick={() => void handleManagerStageAction(task.id, "paid")} className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/15 px-4 py-3 text-sm font-medium text-[#56FFEF]">Оплачена</button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : managerBottomTab === "create" ? (
                  <div className="space-y-3">
                    <FormInput value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Название задачи" />
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 text-sm text-white/55">Категории</div>
                      <div className="flex flex-wrap gap-2">
                        {SPECIALIZATION_OPTIONS.map((item) => {
                          const active = createCategories.includes(item);
                          return <button key={item} type="button" onClick={() => setCreateCategories((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item])} className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}>{item}</button>;
                        })}
                      </div>
                    </div>
                    <FormInput type="date" value={createDeadlineDate} onChange={(e) => setCreateDeadlineDate(e.target.value)} />
                    <FormInput type="time" value={createDeadlineTime} onChange={(e) => setCreateDeadlineTime(e.target.value)} />
                    <FormInput value={createPrice} onChange={(e) => setCreatePrice(e.target.value)} placeholder="Стоимость" />
                    <FormInput value={createManagerContact} onChange={(e) => setCreateManagerContact(e.target.value)} placeholder="Контакт менеджера" />
                    <FormTextarea value={createSources} onChange={(e) => setCreateSources(e.target.value)} placeholder="Источники (необязательно)" />
                    <FormTextarea value={createRefs} onChange={(e) => setCreateRefs(e.target.value)} placeholder="Референсы (необязательно)" />
                    <FormTextarea value={createDeliveryTarget} onChange={(e) => setCreateDeliveryTarget(e.target.value)} placeholder="Куда отгружать результат (необязательно)" />
                    <FormTextarea value={createComment} onChange={(e) => setCreateComment(e.target.value)} placeholder="Комментарий (необязательно)" />
                    {createError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{createError}</div> : null}
                    {createSuccess ? <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{createSuccess}</div> : null}
                    <button onClick={() => void handleCreateTask()} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Создать задачу</button>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Остальные менеджерские разделы оставь из текущей рабочей версии. Этот файл добавляет этапы задач и визуальный workflow.</div>
                )}
              </div>
              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl">
                <div className="grid grid-cols-5 gap-1">
                  {managerBottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = managerBottomTab === tab.key;
                    return <button key={tab.key} onClick={() => setManagerBottomTab(tab.key)} className={cn("relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", active ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}><Icon className="h-5 w-5" /><span className="text-[10px] leading-none">{tab.label}</span></button>;
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {stageTaskId && stageKey ? (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4">
            <div className="w-full rounded-[28px] border border-white/10 bg-[#0b0b10] p-4">
              <div className="mb-3 text-lg font-semibold text-white">{stageKey === "30" ? "Отправить 30%" : stageKey === "60" ? "Отправить 60%" : "Сдать задачу"}</div>
              <FormTextarea value={stageValue} onChange={(e) => setStageValue(e.target.value)} placeholder="Ссылка, текст или комментарий к материалу" />
              {stageError ? <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{stageError}</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setStageTaskId(null); setStageKey(null); setStageValue(""); setStageError(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Отмена</button>
                <button onClick={() => void submitStageMaterial()} disabled={stageLoading} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">{stageLoading ? "Отправляю..." : "Отправить"}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
