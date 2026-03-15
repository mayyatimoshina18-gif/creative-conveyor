import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Users,
  Trophy,
  Calculator,
  PlusSquare,
  ChevronRight,
  Lock,
  Search,
  Clock3,
  Archive,
  CircleDot
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
  unavailableDays?: string[];
  unavailableTime?: string | null;
  status?: string | null;
  approvedBy?: string | null;
  approvedByManagerId?: number | null;
  rating?: number | null;
  completedOrders?: number;
};

const API_BASE = "https://creative-conveyor-backend.onrender.com";

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

const topTabs = [
  { key: "waiting", label: "Ждут исполнителя", icon: CircleDot },
  { key: "active", label: "Активные", icon: Clock3 },
  { key: "archived", label: "Архивные", icon: Archive }
] as const;

const bottomTabs = [
  { key: "tasks", label: "Задачи", icon: Briefcase },
  { key: "applications", label: "Заявки", icon: Users },
  { key: "rating", label: "Рейтинг", icon: Trophy },
  { key: "calculator", label: "Калькулятор", icon: Calculator },
  { key: "create", label: "Создать", icon: PlusSquare }
];

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

function TaskCard({ task }: { task: Task }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18 }}
      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">
            Задача #{task.id}
          </div>
          <div className="text-base font-semibold leading-5 text-white">{task.title}</div>
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
          Открыть
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(task.type || []).map((item) => (
          <span
            key={item}
            className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
            Дедлайн
          </div>
          <div>{task.deadline || "—"}</div>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
            Стоимость
          </div>
          <div>{task.price || "—"}</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/55">Менеджер: {task.manager || "—"}</div>
    </motion.div>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
    />
  );
}

function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-[120px] w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
    />
  );
}

export default function App() {
  const [screen, setScreen] = useState<
    | "welcome"
    | "managerPassword"
    | "managerApp"
    | "executorLoading"
    | "executorRegister"
    | "executorForm"
    | "executorCodeLogin"
    | "executorPending"
    | "executorApp"
  >("welcome");

  const [executor, setExecutor] = useState<ExecutorProfile | null>(null);
  const [executorCode, setExecutorCode] = useState("");
  const [executorError, setExecutorError] = useState("");
  const [executorInfo, setExecutorInfo] = useState("");

  const [executorFullName, setExecutorFullName] = useState("");
  const [executorContact, setExecutorContact] = useState("");
  const [executorSpecializations, setExecutorSpecializations] = useState<string[]>([]);
  const [executorPortfolio, setExecutorPortfolio] = useState("");
  const [executorPaymentMethod, setExecutorPaymentMethod] = useState("");
  const [executorPaymentDetails, setExecutorPaymentDetails] = useState("");
  const [executorUnavailableDays, setExecutorUnavailableDays] = useState<string[]>([]);
  const [executorUnavailableTime, setExecutorUnavailableTime] = useState("");
  const [isExecutorSubmitting, setIsExecutorSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeTopTab, setActiveTopTab] = useState<"waiting" | "active" | "archived">("waiting");
  const [activeBottomTab, setActiveBottomTab] = useState("tasks");

  const [tasksData, setTasksData] = useState<TasksResponse>({
    waiting: [],
    active: [],
    archived: []
  });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");

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
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const telegram = (window as any)?.Telegram?.WebApp;
    telegram?.ready?.();

    const username = telegram?.initDataUnsafe?.user?.username;
    if (username) {
      setCreateManagerContact(`@${username}`);
      setExecutorContact(`@${username}`);
    }
  }, []);

  const visibleTasks = useMemo(() => tasksData[activeTopTab] || [], [tasksData, activeTopTab]);

  const loadTasks = async () => {
    try {
      setIsLoadingTasks(true);
      setTasksError("");

      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: TasksResponse = await response.json();

      setTasksData({
        waiting: Array.isArray(data.waiting) ? data.waiting : [],
        active: Array.isArray(data.active) ? data.active : [],
        archived: Array.isArray(data.archived) ? data.archived : []
      });
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setTasksError("Не удалось загрузить задачи с сервера");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (screen === "managerApp") {
      void loadTasks();
    }
  }, [screen]);

  const resetExecutorForm = () => {
    setExecutorError("");
    setExecutorInfo("");
    setExecutorFullName("");
    setExecutorSpecializations([]);
    setExecutorPortfolio("");
    setExecutorPaymentMethod("");
    setExecutorPaymentDetails("");
    setExecutorUnavailableDays([]);
    setExecutorUnavailableTime("");

    const telegram = (window as any)?.Telegram?.WebApp;
    const username = telegram?.initDataUnsafe?.user?.username;
    setExecutorContact(username ? `@${username}` : "");
  };

  const loadExecutor = async () => {
    try {
      setExecutorError("");
      setExecutorInfo("");

      const telegram = (window as any)?.Telegram?.WebApp;
      telegram?.ready?.();

      const user = telegram?.initDataUnsafe?.user;

      if (!user?.id) {
        setScreen("executorRegister");
        return;
      }

      const res = await fetch(`${API_BASE}/api/executors/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: user.id
        })
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

      if (data.executor.status === "На модерации") {
        setScreen("executorPending");
        return;
      }

      if (data.executor.status === "Подтверждён") {
        setScreen("executorApp");
        return;
      }

      setScreen("executorRegister");
    } catch (error) {
      console.error("Failed to load executor:", error);
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

  const toggleCategory = (category: string) => {
    setCreateCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const toggleExecutorSpecialization = (value: string) => {
    setExecutorSpecializations((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleExecutorDay = (value: string) => {
    setExecutorUnavailableDays((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const resetCreateForm = () => {
    setCreateTitle("");
    setCreateCategories([]);
    setCreateDeadlineDate("");
    setCreateDeadlineTime("");
    setCreatePrice("");
    setCreateSources("");
    setCreateRefs("");
    setCreateDeliveryTarget("");
    setCreateComment("");
    setCreateError("");
    setCreateSuccess("");
  };

  const handleCreateTask = async () => {
    if (!createTitle.trim()) {
      setCreateError("Введите название задачи");
      return;
    }

    if (!createCategories.length) {
      setCreateError("Выберите хотя бы одну категорию");
      return;
    }

    if (!createDeadlineDate.trim()) {
      setCreateError("Введите дату дедлайна");
      return;
    }

    if (!createDeadlineTime.trim()) {
      setCreateError("Введите время дедлайна");
      return;
    }

    if (!createPrice.trim()) {
      setCreateError("Введите стоимость");
      return;
    }

    if (!createManagerContact.trim()) {
      setCreateError("Введите контакт менеджера");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError("");
      setCreateSuccess("");

      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create task");
      }

      resetCreateForm();
      setCreateSuccess("Задача создана");
      await loadTasks();
      setActiveBottomTab("tasks");
      setActiveTopTab("waiting");
    } catch (error) {
      console.error("Failed to create task:", error);
      setCreateError("Не удалось создать задачу");
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecutorCodeLogin = async () => {
    if (!executorCode.trim()) {
