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
  CircleDot,
  Pencil
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
  telegramId?: number | null;
  executorCode?: string | null;
  username?: string | null;
  telegramContact?: string | null;
  fullName?: string | null;
  specializations?: string[];
  verifiedSpecializations?: string[];
  portfolio?: string | null;
  paymentMethod?: string | null;
  paymentDetails?: { type?: string; value?: string } | string | null;
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
  { key: "executors", label: "Исполнители", icon: Users },
  { key: "tasks", label: "Задачи", icon: Briefcase },
  { key: "create", label: "Создать", icon: PlusSquare },
  { key: "calculator", label: "Калькулятор", icon: Calculator },
  { key: "profile", label: "Профиль", icon: Trophy }
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
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{task.id}</div>
          <div className="text-base font-semibold leading-5 text-white">{task.title}</div>
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">Открыть</button>
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
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Дедлайн</div>
          <div>{task.deadline || "—"}</div>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Стоимость</div>
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
      className="min-h-[110px] w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
    />
  );
}

function getPaymentDetailsText(value: ExecutorProfile["paymentDetails"]) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.value || "";
}

function getPaymentPrompt(paymentMethod: string) {
  if (paymentMethod === "Переводом") {
    return {
      label: "Реквизиты для выплаты",
      placeholder: "Номер телефона или номер карты",
      helper: "Укажи номер телефона или карты для перевода."
    };
  }

  if (paymentMethod === "ИП") {
    return {
      label: "Данные ИП",
      placeholder: "ИНН ИП и ФИО",
      helper: "Укажи ИНН ИП и ФИО."
    };
  }

  if (paymentMethod === "Самозанятость") {
    return {
      label: "Данные самозанятости",
      placeholder: "ИНН и ФИО",
      helper: "Укажи ИНН и ФИО."
    };
  }

  return {
    label: "Реквизиты",
    placeholder: "Реквизиты для выплаты",
    helper: ""
  };
}


function normalizeInvoiceList(value: ExecutorProfile["paymentInvoices"]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      value: typeof item === "string" ? item : String(item?.value || "").trim(),
      createdAt:
        typeof item === "string"
          ? new Date().toISOString()
          : String(item?.createdAt || new Date().toISOString())
    }))
    .filter((item) => item.value);
}

function formatDateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
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
  const [executorFormError, setExecutorFormError] = useState("");
  const [isExecutorSubmitting, setIsExecutorSubmitting] = useState(false);
  const [isExecutorEditing, setIsExecutorEditing] = useState(false);

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

  const [managerExecutorsTopTab, setManagerExecutorsTopTab] = useState<"pending" | "registry">("pending");
  const [pendingExecutors, setPendingExecutors] = useState<ExecutorProfile[]>([]);
  const [approvedExecutors, setApprovedExecutors] = useState<ExecutorProfile[]>([]);
  const [isLoadingPendingExecutors, setIsLoadingPendingExecutors] = useState(false);
  const [isLoadingApprovedExecutors, setIsLoadingApprovedExecutors] = useState(false);
  const [pendingExecutorsError, setPendingExecutorsError] = useState("");
  const [approvedExecutorsError, setApprovedExecutorsError] = useState("");
  const [selectedPendingTelegramId, setSelectedPendingTelegramId] = useState<number | null>(null);
  const [moderationVerifiedSpecializations, setModerationVerifiedSpecializations] = useState<string[]>([]);
  const [moderationAccuracy, setModerationAccuracy] = useState("5");
  const [moderationSpeed, setModerationSpeed] = useState("5");
  const [moderationAesthetics, setModerationAesthetics] = useState("5");
  const [moderationMessage, setModerationMessage] = useState("");
  const [isModeratingExecutor, setIsModeratingExecutor] = useState(false);

  const [isManagerEditingRegistryExecutor, setIsManagerEditingRegistryExecutor] = useState(false);
  const [editingRegistryTelegramId, setEditingRegistryTelegramId] = useState<number | null>(null);
  const [managerExecutorMessage, setManagerExecutorMessage] = useState("");
  const [isSavingManagerExecutor, setIsSavingManagerExecutor] = useState(false);
  const [managerEditFullName, setManagerEditFullName] = useState("");
  const [managerEditContact, setManagerEditContact] = useState("");
  const [managerEditSpecializations, setManagerEditSpecializations] = useState<string[]>([]);
  const [managerEditVerifiedSpecializations, setManagerEditVerifiedSpecializations] = useState<string[]>([]);
  const [managerEditPortfolio, setManagerEditPortfolio] = useState("");
  const [managerEditPaymentMethod, setManagerEditPaymentMethod] = useState("");
  const [managerEditPaymentDetails, setManagerEditPaymentDetails] = useState("");
  const [managerEditUnavailableDays, setManagerEditUnavailableDays] = useState<string[]>([]);
  const [managerEditUnavailableTime, setManagerEditUnavailableTime] = useState("");
  const [managerEditReviewAccuracy, setManagerEditReviewAccuracy] = useState("5");
  const [managerEditReviewSpeed, setManagerEditReviewSpeed] = useState("5");
  const [managerEditReviewAesthetics, setManagerEditReviewAesthetics] = useState("5");
  const [managerEditContractData, setManagerEditContractData] = useState("");
  const [managerEditInvoices, setManagerEditInvoices] = useState<Array<{ value: string; createdAt: string }>>([]);
  const [newManagerInvoice, setNewManagerInvoice] = useState("");

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
  const paymentPrompt = getPaymentPrompt(executorPaymentMethod);

  const selectedPendingExecutor = useMemo(
    () => pendingExecutors.find((item) => Number(item.telegramId) === Number(selectedPendingTelegramId)) || null,
    [pendingExecutors, selectedPendingTelegramId]
  );

  const selectedApprovedExecutor = useMemo(
    () => approvedExecutors.find((item) => Number(item.telegramId) === Number(editingRegistryTelegramId)) || null,
    [approvedExecutors, editingRegistryTelegramId]
  );

  const fillExecutorFormFromProfile = (profile: ExecutorProfile | null) => {
    if (!profile) return;
    setExecutorFullName(profile.fullName || "");
    setExecutorContact(profile.telegramContact || "");
    setExecutorSpecializations(profile.specializations || []);
    setExecutorPortfolio(profile.portfolio || "");
    setExecutorPaymentMethod(profile.paymentMethod || "");
    setExecutorPaymentDetails(getPaymentDetailsText(profile.paymentDetails));
    setExecutorUnavailableDays(profile.unavailableDays || []);
    setExecutorUnavailableTime(profile.unavailableTime || "");
  };

  const fillManagerExecutorForm = (profile: ExecutorProfile | null) => {
    if (!profile) return;
    setManagerEditFullName(profile.fullName || "");
    setManagerEditContact(profile.telegramContact || "");
    setManagerEditSpecializations(profile.specializations || []);
    setManagerEditVerifiedSpecializations(profile.verifiedSpecializations || profile.specializations || []);
    setManagerEditPortfolio(profile.portfolio || "");
    setManagerEditPaymentMethod(profile.paymentMethod || "");
    setManagerEditPaymentDetails(getPaymentDetailsText(profile.paymentDetails));
    setManagerEditUnavailableDays(profile.unavailableDays || []);
    setManagerEditUnavailableTime(profile.unavailableTime || "");
    setManagerEditReviewAccuracy(String(profile.reviewAccuracy ?? 5));
    setManagerEditReviewSpeed(String(profile.reviewSpeed ?? 5));
    setManagerEditReviewAesthetics(String(profile.reviewAesthetics ?? 5));
    setManagerEditContractData(getPaymentDetailsText(profile.contractData as any));
    setManagerEditInvoices(normalizeInvoiceList(profile.paymentInvoices));
    setNewManagerInvoice("");
  };

  const toggleManagerEditSpecialization = (value: string) => {
    setManagerEditSpecializations((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleManagerEditVerifiedSpecialization = (value: string) => {
    setManagerEditVerifiedSpecializations((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleManagerEditDay = (value: string) => {
    setManagerEditUnavailableDays((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };


  const handleAddManagerInvoice = () => {
    const value = newManagerInvoice.trim();
    if (!value) return;
    setManagerEditInvoices((prev) => [
      { value, createdAt: new Date().toISOString() },
      ...prev
    ]);
    setNewManagerInvoice("");
  };

  const handleRemoveManagerInvoice = (targetCreatedAt: string) => {
    setManagerEditInvoices((prev) => prev.filter((item) => item.createdAt !== targetCreatedAt));
  };

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
    if (screen === "managerApp" && activeBottomTab === "tasks") {
      void loadTasks();
    }
  }, [screen, activeBottomTab]);

  useEffect(() => {
    if (screen === "managerApp" && activeBottomTab === "executors") {
      void loadPendingExecutors();
      void loadApprovedExecutors();
    }
  }, [screen, activeBottomTab]);

  const resetExecutorForm = () => {
    setExecutorFormError("");
    setExecutorInfo("");
    setExecutorFullName("");
    setExecutorSpecializations([]);
    setExecutorPortfolio("");
    setExecutorPaymentMethod("");
    setExecutorPaymentDetails("");
    setExecutorUnavailableDays([]);
    setExecutorUnavailableTime("");
    setIsExecutorEditing(false);

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
      fillExecutorFormFromProfile(data.executor);

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

  const toggleModerationVerifiedSpecialization = (value: string) => {
    setModerationVerifiedSpecializations((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const loadPendingExecutors = async () => {
    try {
      setIsLoadingPendingExecutors(true);
      setPendingExecutorsError("");
      setModerationMessage("");

      const response = await fetch(`${API_BASE}/api/executors/pending`, {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load pending executors");
      }

      const list = Array.isArray(data.executors) ? data.executors : [];
      setPendingExecutors(list);

      if (!list.length) {
        setSelectedPendingTelegramId(null);
        return;
      }

      const nextSelected =
        list.find((item: ExecutorProfile) => Number(item.telegramId) === Number(selectedPendingTelegramId)) ||
        list[0];

      setSelectedPendingTelegramId(Number(nextSelected.telegramId));
      setModerationVerifiedSpecializations(nextSelected.specializations || []);
    } catch (error) {
      console.error("Failed to load pending executors:", error);
      setPendingExecutorsError("Не удалось загрузить заявки исполнителей");
    } finally {
      setIsLoadingPendingExecutors(false);
    }
  };


  const loadApprovedExecutors = async () => {
    try {
      setIsLoadingApprovedExecutors(true);
      setApprovedExecutorsError("");

      const response = await fetch(`${API_BASE}/api/executors/approved`, {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load approved executors");
      }

      const list = Array.isArray(data.executors) ? data.executors : [];
      list.sort((a: ExecutorProfile, b: ExecutorProfile) => {
        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return Number(b.completedOrders || 0) - Number(a.completedOrders || 0);
      });
      setApprovedExecutors(list);
    } catch (error) {
      console.error("Failed to load approved executors:", error);
      setApprovedExecutorsError("Не удалось загрузить реестр исполнителей");
    } finally {
      setIsLoadingApprovedExecutors(false);
    }
  };

  const openPendingExecutor = (profile: ExecutorProfile) => {
    setSelectedPendingTelegramId(Number(profile.telegramId));
    setModerationVerifiedSpecializations(profile.specializations || []);
    setModerationAccuracy("5");
    setModerationSpeed("5");
    setModerationAesthetics("5");
    setModerationMessage("");
  };

  const openRegistryExecutorEditor = (profile: ExecutorProfile) => {
    setEditingRegistryTelegramId(Number(profile.telegramId));
    fillManagerExecutorForm(profile);
    setManagerExecutorMessage("");
    setIsManagerEditingRegistryExecutor(true);
  };

  const handleManagerSaveExecutor = async () => {
    if (!selectedApprovedExecutor?.telegramId) {
      setManagerExecutorMessage("Исполнитель не выбран");
      return;
    }

    if (!managerEditFullName.trim() || !managerEditContact.trim()) {
      setManagerExecutorMessage("Имя и контакт обязательны");
      return;
    }

    if (!managerEditSpecializations.length) {
      setManagerExecutorMessage("Нужна хотя бы одна специализация");
      return;
    }

    if (!managerEditVerifiedSpecializations.length) {
      setManagerExecutorMessage("Нужна хотя бы одна подтверждённая специализация");
      return;
    }

    try {
      setIsSavingManagerExecutor(true);
      setManagerExecutorMessage("");

      const telegram = (window as any)?.Telegram?.WebApp;
      const username = telegram?.initDataUnsafe?.user?.username || null;
      const managerContact = username ? `@${username}` : createManagerContact.trim() || "Менеджер";

      const response = await fetch(`${API_BASE}/api/executors/manager-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: selectedApprovedExecutor.telegramId,
          managerContact,
          fullName: managerEditFullName.trim(),
          telegramContact: managerEditContact.trim(),
          specializations: managerEditSpecializations,
          verifiedSpecializations: managerEditVerifiedSpecializations,
          portfolio: managerEditPortfolio.trim() || null,
          paymentMethod: managerEditPaymentMethod.trim() || null,
          paymentDetails: managerEditPaymentDetails.trim() || null,
          unavailableDays: managerEditUnavailableDays,
          unavailableTime: managerEditUnavailableTime.trim() || "",
          reviewAccuracy: Number(managerEditReviewAccuracy),
          reviewSpeed: Number(managerEditReviewSpeed),
          reviewAesthetics: Number(managerEditReviewAesthetics),
          contractData: managerEditContractData.trim() || null,
          paymentInvoices: managerEditInvoices
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Manager update failed");
      }

      setManagerExecutorMessage("Карточка исполнителя обновлена");
      setIsManagerEditingRegistryExecutor(false);
      await loadApprovedExecutors();
    } catch (error) {
      console.error("Failed to save executor by manager:", error);
      setManagerExecutorMessage("Не удалось сохранить изменения");
    } finally {
      setIsSavingManagerExecutor(false);
    }
  };

  const handleModerateExecutor = async (decision: "approve" | "reject") => {
    if (!selectedPendingExecutor?.telegramId) return;

    if (decision === "approve" && !moderationVerifiedSpecializations.length) {
      setModerationMessage("Выбери хотя бы одну подтверждённую специализацию");
      return;
    }

    try {
      setIsModeratingExecutor(true);
      setModerationMessage("");

      const telegram = (window as any)?.Telegram?.WebApp;
      const username = telegram?.initDataUnsafe?.user?.username || null;
      const managerContact = username ? `@${username}` : createManagerContact.trim() || "Менеджер";

      const response = await fetch(`${API_BASE}/api/executors/moderate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: selectedPendingExecutor.telegramId,
          decision,
          managerContact,
          managerTelegramId: telegram?.initDataUnsafe?.user?.id || null,
          verifiedSpecializations: moderationVerifiedSpecializations,
          reviewAccuracy: Number(moderationAccuracy),
          reviewSpeed: Number(moderationSpeed),
          reviewAesthetics: Number(moderationAesthetics)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Moderation failed");
      }

      setModerationMessage(
        decision === "approve"
          ? "Исполнитель подтверждён"
          : "Исполнитель отклонён"
      );

      await loadPendingExecutors();
    } catch (error) {
      console.error("Failed to moderate executor:", error);
      setModerationMessage("Не удалось сохранить решение");
    } finally {
      setIsModeratingExecutor(false);
    }
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
      setExecutorError("Введи ID исполнителя");
      return;
    }

    try {
      setExecutorError("");

      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;

      const response = await fetch(`${API_BASE}/api/executors/login-by-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
      fillExecutorFormFromProfile(data.executor);
      setExecutorInfo("Аккаунт найден");

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
      console.error("Executor code login failed:", error);
      setExecutorError("Не удалось войти по ID");
    }
  };

  const validateExecutorForm = () => {
    if (!executorFullName.trim()) {
      setExecutorFormError("Введи имя и фамилию");
      return false;
    }

    if (!executorContact.trim()) {
      setExecutorFormError("Введи контакт для связи");
      return false;
    }

    if (!executorSpecializations.length) {
      setExecutorFormError("Выбери хотя бы одну специализацию");
      return false;
    }

    if (!executorPaymentMethod.trim()) {
      setExecutorFormError("Укажи способ выплаты");
      return false;
    }

    if (!executorPaymentDetails.trim()) {
      setExecutorFormError("Заполни данные для выплаты");
      return false;
    }

    setExecutorFormError("");
    return true;
  };

  const handleExecutorRegister = async () => {
    if (!validateExecutorForm()) return;

    try {
      setIsExecutorSubmitting(true);

      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;

      const response = await fetch(`${API_BASE}/api/executors/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: user?.id || null,
          username: user?.username || null,
          telegramContact: executorContact.trim(),
          fullName: executorFullName.trim(),
          specializations: executorSpecializations,
          portfolio: executorPortfolio.trim() || null,
          paymentMethod: executorPaymentMethod.trim(),
          paymentDetails: executorPaymentDetails.trim(),
          unavailableDays: executorUnavailableDays,
          unavailableTime: executorUnavailableTime.trim() || ""
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Registration failed");
      }

      setExecutor(data.executor || null);
      fillExecutorFormFromProfile(data.executor || null);
      setScreen("executorPending");
    } catch (error) {
      console.error("Executor registration failed:", error);
      setExecutorFormError("Не удалось отправить анкету");
    } finally {
      setIsExecutorSubmitting(false);
    }
  };

  const handleExecutorUpdate = async () => {
    if (!executor || !validateExecutorForm()) return;

    try {
      setIsExecutorSubmitting(true);
      setExecutorInfo("");
      setExecutorError("");

      const response = await fetch(`${API_BASE}/api/executors/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: executor.telegramId,
          fullName: executorFullName.trim(),
          telegramContact: executorContact.trim(),
          specializations: executorSpecializations,
          portfolio: executorPortfolio.trim() || null,
          paymentMethod: executorPaymentMethod.trim(),
          paymentDetails: executorPaymentDetails.trim(),
          unavailableDays: executorUnavailableDays,
          unavailableTime: executorUnavailableTime.trim() || ""
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.executor) {
        throw new Error(data?.error || "Update failed");
      }

      setExecutor(data.executor);
      fillExecutorFormFromProfile(data.executor);
      setIsExecutorEditing(false);
      setExecutorInfo("Анкета обновлена");
    } catch (error) {
      console.error("Executor update failed:", error);
      setExecutorFormError("Не удалось обновить анкету");
    } finally {
      setIsExecutorSubmitting(false);
    }
  };

  const renderExecutorForm = (submitLabel: string, onSubmit: () => void, includeBack = true) => (
    <>
      {includeBack ? (
        <button
          onClick={() => setScreen("executorRegister")}
          className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70"
        >
          Назад
        </button>
      ) : null}

      <div className="mb-6">
        <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Анкета исполнителя</h2>
        <p className="mt-3 text-sm text-white/45">Заполни анкету, чтобы менеджер мог проверить тебя и допустить к задачам.</p>
      </div>

      <div className="space-y-3">
        <FormInput value={executorFullName} onChange={(e) => setExecutorFullName(e.target.value)} placeholder="Имя и фамилия" />

        <FormInput value={executorContact} onChange={(e) => setExecutorContact(e.target.value)} placeholder="Контакт для связи" />

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 text-sm text-white/55">Специализации</div>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map((item) => {
              const active = executorSpecializations.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => toggleExecutorSpecialization(item)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65"
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <FormInput
          value={executorPortfolio}
          onChange={(e) => setExecutorPortfolio(e.target.value)}
          placeholder="Ссылка на портфолио (необязательно)"
        />

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 text-sm text-white/55">Способ выплаты</div>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((item) => {
              const active = executorPaymentMethod === item;
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => setExecutorPaymentMethod(item)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65"
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 text-sm text-white/55">{paymentPrompt.label}</div>
          {paymentPrompt.helper ? <div className="mb-3 text-xs text-white/35">{paymentPrompt.helper}</div> : null}
          <FormTextarea
            value={executorPaymentDetails}
            onChange={(e) => setExecutorPaymentDetails(e.target.value)}
            placeholder={paymentPrompt.placeholder}
          />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 text-sm text-white/55">Недоступные дни (необязательно)</div>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((item) => {
              const active = executorUnavailableDays.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => toggleExecutorDay(item)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65"
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <FormInput
          value={executorUnavailableTime}
          onChange={(e) => setExecutorUnavailableTime(e.target.value)}
          placeholder="Часы недоступности (необязательно)"
        />

        {executorFormError ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{executorFormError}</div>
        ) : null}

        {executorInfo ? (
          <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{executorInfo}</div>
        ) : null}

        <button
          onClick={onSubmit}
          disabled={isExecutorSubmitting}
          className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
        >
          {isExecutorSubmitting ? "Сохраняю..." : submitLabel}
        </button>
      </div>
    </>
  );

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

          {screen === "executorLoading" && (
            <motion.div key="executorLoading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-[#56FFEF]/15 blur-[2px]" />
              <div className="text-base text-white/75">Проверяем ваш аккаунт исполнителя…</div>
            </motion.div>
          )}

          {screen === "executorRegister" && (
            <motion.div key="executorRegister" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("welcome")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>

              <div className="mb-8">
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">Исполнитель</div>
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Вы ещё не зарегистрированы</h2>
                <p className="mt-3 text-sm text-white/45">Заполни анкету исполнителя или войди по ID, если ты уже был зарегистрирован раньше.</p>
              </div>

              <div className="space-y-3">
                <button onClick={() => { resetExecutorForm(); setScreen("executorForm"); }} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Заполнить анкету</button>
                <button onClick={() => { setExecutorError(""); setExecutorInfo(""); setExecutorCode(""); setScreen("executorCodeLogin"); }} className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-white transition hover:bg-white/10">У меня уже есть ID исполнителя</button>
              </div>
            </motion.div>
          )}

          {screen === "executorForm" && (
            <motion.div key="executorForm" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              {renderExecutorForm("Отправить анкету", handleExecutorRegister, true)}
            </motion.div>
          )}

          {screen === "executorCodeLogin" && (
            <motion.div key="executorCodeLogin" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("executorRegister")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="mb-8">
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Вход по ID исполнителя</h2>
                <p className="mt-3 text-sm text-white/45">Введи резервный ID, который был присвоен тебе при регистрации.</p>
              </div>
              <div className="space-y-3">
                <FormInput value={executorCode} onChange={(e) => setExecutorCode(e.target.value.toUpperCase())} placeholder="Например: EX-7K3D9A" />
                {executorError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{executorError}</div> : null}
                <button onClick={() => void handleExecutorCodeLogin()} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Войти</button>
              </div>
            </motion.div>
          )}

          {screen === "executorPending" && (
            <motion.div key="executorPending" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => setScreen("welcome")} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>
              <div className="mb-8">
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">Исполнитель</div>
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Анкета на модерации</h2>
                <p className="mt-3 text-sm text-white/45">Менеджер проверяет твою анкету. После подтверждения ты получишь доступ к задачам.</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div><div className="text-base text-white">{executor?.executorCode || "—"}</div></div>
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Контакт</div><div className="text-base text-white">{executor?.telegramContact || "—"}</div></div>
              </div>
            </motion.div>
          )}

          {screen === "executorApp" && (
            <motion.div key="executorApp" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col px-6 pb-8 pt-12">
              <button onClick={() => { setIsExecutorEditing(false); setExecutorInfo(""); setScreen("welcome"); }} className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">Назад</button>

              {!isExecutorEditing ? (
                <>
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">Исполнитель</div>
                      <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Кабинет исполнителя</h2>
                    </div>
                    <button onClick={() => { fillExecutorFormFromProfile(executor); setExecutorFormError(""); setExecutorInfo(""); setIsExecutorEditing(true); }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"><Pencil className="h-4 w-4" />Редактировать</button>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div><div className="text-white">{executor?.executorCode || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Имя и фамилия</div><div className="text-white">{executor?.fullName || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Контакт</div><div className="text-white">{executor?.telegramContact || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Статус</div><div className="text-white">{executor?.status || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Специализации</div><div className="text-white">{executor?.specializations?.length ? executor.specializations.join(", ") : "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Подтверждённые специализации</div><div className="text-white">{executor?.verifiedSpecializations?.length ? executor.verifiedSpecializations.join(", ") : "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Портфолио</div><div className="text-white break-words">{executor?.portfolio || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Способ выплаты</div><div className="text-white">{executor?.paymentMethod || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Данные для выплаты</div><div className="text-white whitespace-pre-wrap break-words">{getPaymentDetailsText(executor?.paymentDetails) || "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Недоступные дни</div><div className="text-white">{executor?.unavailableDays?.length ? executor.unavailableDays.join(", ") : "—"}</div></div>
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Часы недоступности</div><div className="text-white">{executor?.unavailableTime || "—"}</div></div>
                    {executorInfo ? <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{executorInfo}</div> : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">Исполнитель</div>
                      <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Редактирование анкеты</h2>
                    </div>
                    <button onClick={() => { fillExecutorFormFromProfile(executor); setExecutorFormError(""); setExecutorInfo(""); setIsExecutorEditing(false); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">Отмена</button>
                  </div>
                  {renderExecutorForm("Сохранить изменения", handleExecutorUpdate, false)}
                </>
              )}
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

          {screen === "managerApp" && (
            <motion.div key="managerApp" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Креативный конвейер ЛЭНД</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{activeBottomTab === "create" ? "Создать задачу" : activeBottomTab === "executors" ? "Исполнители" : activeBottomTab === "profile" ? "Профиль" : "Задачи"}</div>
                  </div>
                  <button onClick={() => { if (activeBottomTab === "executors") { void loadPendingExecutors(); void loadApprovedExecutors(); } else if (activeBottomTab === "tasks") { void loadTasks(); } }} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70"><Search className="h-5 w-5" /></button>
                </div>
                {activeBottomTab === "tasks" && (
                  <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                    {topTabs.map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTopTab === tab.key;
                      return (
                        <button key={tab.key} onClick={() => setActiveTopTab(tab.key)} className={cn("rounded-[18px] px-3 py-3 text-left transition", active ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}>
                          <Icon className="mb-2 h-4 w-4" />
                          <div className="text-[12px] font-medium leading-4">{tab.label}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeBottomTab === "executors" && (
                  <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                    <button
                      onClick={() => setManagerExecutorsTopTab("pending")}
                      className={cn(
                        "rounded-[18px] px-3 py-3 text-left transition",
                        managerExecutorsTopTab === "pending" ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5"
                      )}
                    >
                      <div className="text-[12px] font-medium leading-4">Заявки</div>
                    </button>
                    <button
                      onClick={() => setManagerExecutorsTopTab("registry")}
                      className={cn(
                        "rounded-[18px] px-3 py-3 text-left transition",
                        managerExecutorsTopTab === "registry" ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5"
                      )}
                    >
                      <div className="text-[12px] font-medium leading-4">Реестр</div>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 px-5 pb-28 pt-4">
                {activeBottomTab === "tasks" ? (
                  <>
                    <div className="mb-4 flex items-center justify-between"><div className="text-sm text-white/45">{activeTopTab === "waiting" && "Задачи, которые ждут назначения исполнителя"}{activeTopTab === "active" && "Задачи, которые сейчас в работе"}{activeTopTab === "archived" && "Завершённые и архивные задачи"}</div></div>
                    {isLoadingTasks ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">Загружаю задачи...</div>
                    ) : tasksError ? (
                      <div className="space-y-3"><div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{tasksError}</div><button onClick={() => void loadTasks()} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Повторить загрузку</button></div>
                    ) : visibleTasks.length === 0 ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Здесь пока нет задач.</div>
                    ) : (
                      <div className="space-y-3"><AnimatePresence mode="popLayout">{visibleTasks.map((task) => <TaskCard key={task.id} task={task} />)}</AnimatePresence></div>
                    )}
                  </>
                ) : activeBottomTab === "executors" ? (
                  <>
                    {managerExecutorsTopTab === "pending" ? (
                      <>
                        {isLoadingPendingExecutors ? (
                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                            Загружаю заявки исполнителей...
                          </div>
                        ) : pendingExecutorsError ? (
                          <div className="space-y-3">
                            <div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
                              {pendingExecutorsError}
                            </div>
                            <button
                              onClick={() => void loadPendingExecutors()}
                              className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
                            >
                              Повторить загрузку
                            </button>
                          </div>
                        ) : !pendingExecutors.length ? (
                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
                            Сейчас нет новых анкет на модерации.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-3">
                              {pendingExecutors.map((profile) => {
                                const active = Number(profile.telegramId) === Number(selectedPendingTelegramId);
                                return (
                                  <button
                                    key={String(profile.telegramId)}
                                    onClick={() => openPendingExecutor(profile)}
                                    className={cn(
                                      "w-full rounded-[28px] border p-4 text-left transition",
                                      active
                                        ? "border-[#56FFEF]/30 bg-[#56FFEF]/10"
                                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                                    )}
                                  >
                                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">
                                      На модерации
                                    </div>
                                    <div className="text-base font-semibold text-white">
                                      {profile.fullName || "Без имени"}
                                    </div>
                                    <div className="mt-2 text-sm text-white/55">
                                      {(profile.specializations || []).join(", ") || "—"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {selectedPendingExecutor ? (
                              <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                                <div>
                                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">
                                    Карточка исполнителя
                                  </div>
                                  <div className="text-xl font-semibold text-white">
                                    {selectedPendingExecutor.fullName || "Без имени"}
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">ID исполнителя</div>
                                  <div>{selectedPendingExecutor.executorCode || "—"}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Контакт</div>
                                  <div>{selectedPendingExecutor.telegramContact || "—"}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Портфолио</div>
                                  <div className="break-all">{selectedPendingExecutor.portfolio || "—"}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Способ выплаты</div>
                                  <div>{selectedPendingExecutor.paymentMethod || "—"}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Реквизиты</div>
                                  <div className="whitespace-pre-wrap break-words">{getPaymentDetailsText(selectedPendingExecutor.paymentDetails)}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Недоступные дни</div>
                                  <div>{selectedPendingExecutor.unavailableDays?.length ? selectedPendingExecutor.unavailableDays.join(", ") : "—"}</div>
                                </div>

                                <div className="rounded-2xl bg-black/20 p-3">
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Недоступные часы</div>
                                  <div>{selectedPendingExecutor.unavailableTime || "—"}</div>
                                </div>

                                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                                  <div className="mb-3 text-sm text-white/55">Подтверждённые специализации</div>
                                  <div className="flex flex-wrap gap-2">
                                    {SPECIALIZATION_OPTIONS.map((item) => {
                                      const active = moderationVerifiedSpecializations.includes(item);
                                      return (
                                        <button
                                          type="button"
                                          key={item}
                                          onClick={() => toggleModerationVerifiedSpecialization(item)}
                                          className={cn(
                                            "rounded-full border px-3 py-2 text-sm transition",
                                            active
                                              ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]"
                                              : "border-white/10 bg-white/5 text-white/65"
                                          )}
                                        >
                                          {item}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <FormInput type="number" min="1" max="5" value={moderationAccuracy} onChange={(e) => setModerationAccuracy(e.target.value)} placeholder="ТЗ" />
                                  <FormInput type="number" min="1" max="5" value={moderationSpeed} onChange={(e) => setModerationSpeed(e.target.value)} placeholder="Сроки" />
                                  <FormInput type="number" min="1" max="5" value={moderationAesthetics} onChange={(e) => setModerationAesthetics(e.target.value)} placeholder="Эстетика" />
                                </div>

                                <div className="text-xs text-white/35">
                                  Оценка: ТЗ × 0.5, сроки × 0.35, эстетика × 0.15. Новичок получает приоритет на первые 2 заказа.
                                </div>

                                {moderationMessage ? (
                                  <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">
                                    {moderationMessage}
                                  </div>
                                ) : null}

                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    onClick={() => void handleModerateExecutor("reject")}
                                    disabled={isModeratingExecutor}
                                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                                  >
                                    Отклонить
                                  </button>
                                  <button
                                    onClick={() => void handleModerateExecutor("approve")}
                                    disabled={isModeratingExecutor}
                                    className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
                                  >
                                    {isModeratingExecutor ? "Сохраняю..." : "Подтвердить"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {isLoadingApprovedExecutors ? (
                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                            Загружаю реестр исполнителей...
                          </div>
                        ) : approvedExecutorsError ? (
                          <div className="space-y-3">
                            <div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
                              {approvedExecutorsError}
                            </div>
                            <button
                              onClick={() => void loadApprovedExecutors()}
                              className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
                            >
                              Повторить загрузку
                            </button>
                          </div>
                        ) : !approvedExecutors.length ? (
                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
                            В реестре пока нет подтверждённых исполнителей.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {isManagerEditingRegistryExecutor ? (
                              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                  <div>
                                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Редактирование исполнителя</div>
                                    <div className="text-base font-semibold text-white">{selectedApprovedExecutor?.fullName || "Исполнитель"}</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setIsManagerEditingRegistryExecutor(false);
                                      setManagerExecutorMessage("");
                                    }}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                                  >
                                    Отмена
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  <FormInput value={managerEditFullName} onChange={(e) => setManagerEditFullName(e.target.value)} placeholder="Имя и фамилия" />
                                  <FormInput value={managerEditContact} onChange={(e) => setManagerEditContact(e.target.value)} placeholder="Контакт" />
                                  <FormInput value={managerEditPortfolio} onChange={(e) => setManagerEditPortfolio(e.target.value)} placeholder="Портфолио" />

                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-3 text-sm text-white/55">Специализации</div>
                                    <div className="flex flex-wrap gap-2">
                                      {SPECIALIZATION_OPTIONS.map((item) => {
                                        const active = managerEditSpecializations.includes(item);
                                        return (
                                          <button
                                            type="button"
                                            key={`mgr-spec-${item}`}
                                            onClick={() => toggleManagerEditSpecialization(item)}
                                            className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                                          >
                                            {item}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-3 text-sm text-white/55">Подтверждённые специализации</div>
                                    <div className="flex flex-wrap gap-2">
                                      {SPECIALIZATION_OPTIONS.map((item) => {
                                        const active = managerEditVerifiedSpecializations.includes(item);
                                        return (
                                          <button
                                            type="button"
                                            key={`mgr-vspec-${item}`}
                                            onClick={() => toggleManagerEditVerifiedSpecialization(item)}
                                            className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                                          >
                                            {item}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-3 text-sm text-white/55">Способ выплаты</div>
                                    <div className="flex flex-wrap gap-2">
                                      {PAYMENT_OPTIONS.map((item) => {
                                        const active = managerEditPaymentMethod === item;
                                        return (
                                          <button
                                            type="button"
                                            key={`mgr-pay-${item}`}
                                            onClick={() => setManagerEditPaymentMethod(item)}
                                            className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                                          >
                                            {item}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <FormTextarea
                                    value={managerEditPaymentDetails}
                                    onChange={(e) => setManagerEditPaymentDetails(e.target.value)}
                                    placeholder={getPaymentPrompt(managerEditPaymentMethod).placeholder}
                                  />
                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-2 text-sm text-white/55">Договор</div>
                                    <FormTextarea
                                      value={managerEditContractData}
                                      onChange={(e) => setManagerEditContractData(e.target.value)}
                                      placeholder="Договор с исполнителем: ссылка, описание или идентификатор файла"
                                    />
                                  </div>

                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-sm text-white/55">Счета на оплату</div>
                                        <div className="text-xs text-white/40">Загружено: {managerEditInvoices.length}</div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setManagerEditInvoices((prev) => [...prev, { value: '', createdAt: new Date().toISOString() }])}
                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                                      >
                                        Добавить счёт на оплату
                                      </button>
                                    </div>

                                    <div className="space-y-3">
                                      {managerEditInvoices.length ? managerEditInvoices.map((invoice, invoiceIndex) => (
                                        <div key={`invoice-${invoiceIndex}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                          <div className="mb-2 flex items-center justify-between gap-3">
                                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                                              Счёт #{invoiceIndex + 1}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setManagerEditInvoices((prev) => prev.filter((_, idx) => idx !== invoiceIndex))}
                                              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70"
                                            >
                                              Удалить
                                            </button>
                                          </div>
                                          <FormInput
                                            value={invoice.value}
                                            onChange={(e) => setManagerEditInvoices((prev) => prev.map((item, idx) => idx === invoiceIndex ? { ...item, value: e.target.value } : item))}
                                            placeholder="Файл, ссылка или комментарий к счёту"
                                          />
                                        </div>
                                      )) : (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                                          Счета пока не добавлены.
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="mb-3 text-sm text-white/55">Недоступные дни</div>
                                    <div className="flex flex-wrap gap-2">
                                      {DAY_OPTIONS.map((item) => {
                                        const active = managerEditUnavailableDays.includes(item);
                                        return (
                                          <button
                                            type="button"
                                            key={`mgr-day-${item}`}
                                            onClick={() => toggleManagerEditDay(item)}
                                            className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                                          >
                                            {item}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <FormInput value={managerEditUnavailableTime} onChange={(e) => setManagerEditUnavailableTime(e.target.value)} placeholder="Недоступные часы" />

                                  <div className="grid grid-cols-3 gap-3">
                                    <FormInput value={managerEditReviewAccuracy} onChange={(e) => setManagerEditReviewAccuracy(e.target.value)} placeholder="ТЗ" />
                                    <FormInput value={managerEditReviewSpeed} onChange={(e) => setManagerEditReviewSpeed(e.target.value)} placeholder="Сроки" />
                                    <FormInput value={managerEditReviewAesthetics} onChange={(e) => setManagerEditReviewAesthetics(e.target.value)} placeholder="Эстетика" />
                                  </div>

                                  {managerExecutorMessage ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                                      {managerExecutorMessage}
                                    </div>
                                  ) : null}

                                  <button
                                    onClick={() => void handleManagerSaveExecutor()}
                                    disabled={isSavingManagerExecutor}
                                    className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
                                  >
                                    {isSavingManagerExecutor ? "Сохраняю..." : "Сохранить карточку"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {approvedExecutors.map((profile, index) => (
                              <div key={`${profile.telegramId}-${index}`} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div>
                                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">
                                      Место #{index + 1}
                                    </div>
                                    <div className="text-base font-semibold text-white">
                                      {profile.fullName || "Без имени"}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-1 text-xs text-[#56FFEF]">
                                      {typeof profile.rating === "number" ? `${profile.rating} pts` : "—"}
                                    </div>
                                    <button
                                      onClick={() => {
                                        setEditingRegistryTelegramId(Number(profile.telegramId));
                                        fillManagerExecutorForm(profile);
                                        setManagerExecutorMessage("");
                                        setIsManagerEditingRegistryExecutor(true);
                                      }}
                                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                                    >
                                      Редактировать
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">ID исполнителя</div>
                                    <div>{profile.executorCode || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Контакт</div>
                                    <div className="break-words">{profile.telegramContact || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Специализации</div>
                                    <div>{profile.verifiedSpecializations?.length ? profile.verifiedSpecializations.join(", ") : profile.specializations?.join(", ") || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Заказов</div>
                                    <div>{profile.completedOrders || 0}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Портфолио</div>
                                    <div className="break-words">{profile.portfolio || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Способ выплаты</div>
                                    <div>{profile.paymentMethod || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Реквизиты</div>
                                    <div className="whitespace-pre-wrap break-words">{getPaymentDetailsText(profile.paymentDetails) || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Недоступные дни</div>
                                    <div>{profile.unavailableDays?.length ? profile.unavailableDays.join(", ") : "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Недоступные часы</div>
                                    <div className="whitespace-pre-wrap break-words">{profile.unavailableTime || "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Оценка ТЗ</div>
                                    <div>{profile.reviewAccuracy ?? "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Оценка сроков</div>
                                    <div>{profile.reviewSpeed ?? "—"}</div>
                                  </div>
                                  <div className="rounded-2xl bg-black/20 p-3">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Оценка эстетики</div>
                                    <div>{profile.reviewAesthetics ?? "—"}</div>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-2 text-sm text-white/55">
                                  <div>Подтвердил: {profile.approvedBy || "—"}</div>
                                  <div className="break-words">Договор: {getPaymentDetailsText(profile.contractData as any) || "—"}</div>
                                  <div>Счетов на оплату: {profile.paymentInvoices?.length || 0}</div>
                                  {profile.paymentInvoices?.length ? (
                                    <div className="space-y-1">
                                      {profile.paymentInvoices.slice(-3).map((invoice, invoiceIndex) => (
                                        <div key={`invoice-preview-${profile.telegramId}-${invoiceIndex}`} className="break-words text-white/45">
                                          • {invoice.value || "—"} {invoice.createdAt ? `(${formatDateLabel(invoice.createdAt)})` : ""}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : activeBottomTab === "create" ? (
                  <div className="space-y-3">
                    <FormInput value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Название задачи" />
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 text-sm text-white/55">Категории</div><div className="flex flex-wrap gap-2">{SPECIALIZATION_OPTIONS.map((item) => { const active = createCategories.includes(item); return <button type="button" key={item} onClick={() => toggleCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}>{item}</button>; })}</div></div>
                    <FormInput type="date" value={createDeadlineDate} onChange={(e) => setCreateDeadlineDate(e.target.value)} placeholder="Дата дедлайна" />
                    <FormInput type="time" value={createDeadlineTime} onChange={(e) => setCreateDeadlineTime(e.target.value)} placeholder="Время дедлайна" />
                    <FormInput value={createPrice} onChange={(e) => setCreatePrice(e.target.value)} placeholder="Стоимость" />
                    <FormInput value={createManagerContact} onChange={(e) => setCreateManagerContact(e.target.value)} placeholder="Контакт менеджера" />
                    <FormInput value={createSources} onChange={(e) => setCreateSources(e.target.value)} placeholder="Источники (необязательно)" />
                    <FormInput value={createRefs} onChange={(e) => setCreateRefs(e.target.value)} placeholder="Референсы (необязательно)" />
                    <FormInput value={createDeliveryTarget} onChange={(e) => setCreateDeliveryTarget(e.target.value)} placeholder="Куда отгружать результат (необязательно)" />
                    <FormInput value={createComment} onChange={(e) => setCreateComment(e.target.value)} placeholder="Комментарий (необязательно)" />
                    {createError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{createError}</div> : null}
                    {createSuccess ? <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{createSuccess}</div> : null}
                    <button onClick={handleCreateTask} disabled={isCreating} className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60">{isCreating ? "Создаю..." : "Создать задачу"}</button>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-white/40">Экран «{bottomTabs.find((item) => item.key === activeBottomTab)?.label}» будет следующим шагом.</div>
                )}
              </div>
              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl"><div className="grid grid-cols-5 gap-1">{bottomTabs.map((tab) => { const Icon = tab.icon; const active = activeBottomTab === tab.key; return <button key={tab.key} onClick={() => setActiveBottomTab(tab.key)} className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", active ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}><Icon className="h-5 w-5" /><span className="text-[10px] leading-none">{tab.label}</span></button>; })}</div></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
