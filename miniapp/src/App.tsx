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
  Pencil,
  Eye,
  X,
  CheckCircle2,
  Circle,
  LoaderCircle
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
  briefText?: string;
  sourcesText?: string;
  refsText?: string;
  comment?: string | null;
  deliveryTarget?: string | null;
  stageMaterials?: {
    thirty?: { value?: string; createdAt?: string } | null;
    sixty?: { value?: string; createdAt?: string } | null;
    final?: { value?: string; createdAt?: string } | null;
    fixesNote?: { value?: string; createdAt?: string } | null;
    invoice?: { value?: string; createdAt?: string } | null;
    paymentMeta?: { required?: boolean; method?: string | null } | null;
    thirtyHistory?: Array<{ value?: string; createdAt?: string }> | null;
    sixtyHistory?: Array<{ value?: string; createdAt?: string }> | null;
    finalHistory?: Array<{ value?: string; createdAt?: string }> | null;
    fixesHistory?: Array<{ value?: string; createdAt?: string }> | null;
  };
  paymentMethod?: string | null;
  paymentRequired?: boolean;
  revisionCount?: number;
  deadlineExpired?: boolean;
  deadlineMissedMarked?: boolean;
  deadlinePenaltyPercent?: number | null;
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
  stats?: {
    completedTasks?: number;
    averageRevisions?: number;
    earnedAmount?: number;
  };
  paymentInvoices?: Array<{ value?: string; createdAt?: string; taskId?: number; taskTitle?: string; price?: string; paymentMethod?: string | null; managerContact?: string } | string>;
  reviewAccuracy?: number | null;
  reviewSpeed?: number | null;
  reviewAesthetics?: number | null;
  contractData?: { type?: string; value?: string } | string | null;
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

type CalculatorServiceKey =
  | "resize_static"
  | "resize_animation"
  | "resize_gif"
  | "resize_html"
  | "create_static"
  | "create_animation"
  | "create_gif"
  | "create_html";

type CalculatorLine = {
  key: CalculatorServiceKey;
  label: string;
  clientPrice: number;
  freelancerRate: number;
};

type ManagerCalculatorEntry = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  taskId?: number | null;
  taskTitle?: string | null;
  inputs: Record<CalculatorServiceKey, number>;
  totals: {
    revenue: number;
    freelancerTotal: number;
    theoreticalBase: number;
    roundingEffect: number;
    productionLead: number;
    artDirector: number;
    risks: number;
    support: number;
    profitPool: number;
    bonuses: number;
    bonusTaxes: number;
    profitTax: number;
    netProfit: number;
    ownerProfit: number;
    investorsProfit: number;
  };
};

const CALCULATOR_LINES: CalculatorLine[] = [
  { key: "resize_static", label: "Ресайз статика", clientPrice: 300, freelancerRate: 110 },
  { key: "resize_animation", label: "Ресайз анимация", clientPrice: 700, freelancerRate: 260 },
  { key: "resize_gif", label: "Ресайз gif", clientPrice: 350, freelancerRate: 130 },
  { key: "resize_html", label: "Ресайз html", clientPrice: 450, freelancerRate: 170 },
  { key: "create_static", label: "Создание статичного креатива", clientPrice: 1300, freelancerRate: 490 },
  { key: "create_animation", label: "Создание анимированного креатива", clientPrice: 3300, freelancerRate: 1250 },
  { key: "create_gif", label: "Создание gif креатива", clientPrice: 1600, freelancerRate: 600 },
  { key: "create_html", label: "Создание html креатива", clientPrice: 2500, freelancerRate: 940 }
];

const CALCULATOR_SETTINGS = {
  supportPercent: 0.1,
  riskPercent: 0.1,
  productionLeadPercent: 0.1,
  artDirectorPercent: 0.1,
  bonusPercent: 0.1,
  bonusTaxesPercent: 0.006,
  targetNetProfitPercent: 0.2365,
  profitTaxPercent: 0.0575
};

const CALCULATOR_STORAGE_KEY = "creative-conveyor-manager-calculators-v1";

function formatRubles(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function emptyCalculatorInputs(): Record<CalculatorServiceKey, number> {
  return {
    resize_static: 0,
    resize_animation: 0,
    resize_gif: 0,
    resize_html: 0,
    create_static: 0,
    create_animation: 0,
    create_gif: 0,
    create_html: 0
  };
}

function getCalculatorTitle(entry: ManagerCalculatorEntry) {
  return entry.title?.trim() || "Калькулятор без названия";
}
function getCalculatorSpecializations(inputs: Record<CalculatorServiceKey, number>) {
  const hasStaticLike =
    Number(inputs.resize_static || 0) > 0 ||
    Number(inputs.resize_gif || 0) > 0 ||
    Number(inputs.resize_html || 0) > 0 ||
    Number(inputs.create_static || 0) > 0 ||
    Number(inputs.create_gif || 0) > 0 ||
    Number(inputs.create_html || 0) > 0;

  const hasMotionLike =
    Number(inputs.resize_animation || 0) > 0 ||
    Number(inputs.create_animation || 0) > 0;

  const result: string[] = [];
  if (hasStaticLike) result.push("Статика");
  if (hasMotionLike) result.push("Моушен");
  return result;
}


function calculateManagerCalculator(inputs: Record<CalculatorServiceKey, number>) {
  const marginalLayer =
    CALCULATOR_SETTINGS.bonusPercent +
    CALCULATOR_SETTINGS.bonusTaxesPercent +
    CALCULATOR_SETTINGS.targetNetProfitPercent +
    CALCULATOR_SETTINGS.profitTaxPercent;

  const lineDetails = CALCULATOR_LINES.map((line) => {
    const quantity = Number(inputs[line.key] || 0);
    const revenue = line.clientPrice * quantity;
    const maxRate = Math.round(
      (line.clientPrice * (1 - CALCULATOR_SETTINGS.supportPercent - marginalLayer)) /
        ((1 + CALCULATOR_SETTINGS.riskPercent) *
          (1 + CALCULATOR_SETTINGS.productionLeadPercent + CALCULATOR_SETTINGS.artDirectorPercent))
    );
    const theoretical = maxRate * quantity;
    const freelancerTotal = line.freelancerRate * quantity;
    const roundingEffect = theoretical - freelancerTotal;

    return {
      ...line,
      quantity,
      revenue,
      maxRate,
      theoretical,
      freelancerTotal,
      roundingEffect
    };
  });

  const revenue = lineDetails.reduce((sum, line) => sum + line.revenue, 0);
  const freelancerTotal = lineDetails.reduce((sum, line) => sum + line.freelancerTotal, 0);
  const theoreticalBase = lineDetails.reduce((sum, line) => sum + line.theoretical, 0);
  const roundingEffect = theoreticalBase - freelancerTotal;
  const productionLead = theoreticalBase * CALCULATOR_SETTINGS.productionLeadPercent;
  const artDirector = theoreticalBase * CALCULATOR_SETTINGS.artDirectorPercent;
  const risks = (theoreticalBase + productionLead + artDirector) * CALCULATOR_SETTINGS.riskPercent;
  const support = revenue * CALCULATOR_SETTINGS.supportPercent;
  const profitPool = revenue - freelancerTotal - productionLead - artDirector - risks - support;
  const bonuses = revenue * CALCULATOR_SETTINGS.bonusPercent;
  const bonusTaxes = revenue * CALCULATOR_SETTINGS.bonusTaxesPercent;
  const profitTax = revenue * CALCULATOR_SETTINGS.profitTaxPercent;
  const netProfit = profitPool - bonuses - bonusTaxes - profitTax;
  const ownerProfit = netProfit * 0.2;
  const investorsProfit = netProfit * 0.8;

  return {
    lines: lineDetails,
    totals: {
      revenue,
      freelancerTotal,
      theoreticalBase,
      roundingEffect,
      productionLead,
      artDirector,
      risks,
      support,
      profitPool,
      bonuses,
      bonusTaxes,
      profitTax,
      netProfit,
      ownerProfit,
      investorsProfit
    }
  };
}

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
      className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-left text-lg font-medium text-white transition hover:bg-white/10 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <ChevronRight className="h-5 w-5 text-white/50" />
      </div>
    </button>
  );
}

function TaskCard({ task, onOpen, footer }: { task: Task; onOpen: () => void; footer?: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18 }}
      onClick={onOpen}
      className="w-full rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-left shadow-[0_10px_40px_rgba(0,0,0,0.28)] transition hover:bg-white/[0.06]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{task.id}</div>
          <div className="text-base font-semibold leading-5 text-white">{task.title}</div>
        </div>
        <div className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]">
          {getCurrentStageLabel(task.status)}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(task.type || []).map((item) => (
          <span key={item} className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]">
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
      {footer ? <div className="mt-3" onClick={(event) => event.stopPropagation()}>{footer}</div> : null}
    </motion.button>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
    />
  );
}

function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-[110px] w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
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
          : String(item?.createdAt || new Date().toISOString()),
      taskId: typeof item === "string" ? undefined : item?.taskId,
      taskTitle: typeof item === "string" ? undefined : item?.taskTitle,
      price: typeof item === "string" ? undefined : item?.price,
      paymentMethod: typeof item === "string" ? undefined : item?.paymentMethod,
      managerContact: typeof item === "string" ? undefined : item?.managerContact
    }))
    .filter((item) => item.value);
}

function formatDateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}


function getCurrentStageLabel(status?: string | null) {
  if (!status) return "Не определён";
  if (status === "Ждёт исполнителя" || status === "Есть отклики" || status === "Создана") return "Ожидает исполнителя";
  if (status === "Назначена") return "Изучение ТЗ";
  if (status === "ТЗ изучено") return "Взял в работу";
  if (status === "В работе") return "Подготовка 30%";
  if (status === "30%") return "Подготовка 60%";
  if (status === "60%") return "Финальная сдача";
  if (status === "Правки") return "Исправление правок";
  if (status === "На проверке") return "Проверка менеджером";
  if (status === "Ожидает счёт") return "Ожидается счёт";
  if (status === "Счёт загружен") return "Оплата менеджером";
  if (status === "Ожидает подтверждения оплаты") return "Подтверждение оплаты";
  if (status === "Выполнена" || status === "Не оплачена") return "Ожидает оплату";
  if (status === "Оплачена") return "Завершено";
  return status;
}

function getPipelineSteps(task: Task) {
  const status = task.status || "";
  const materials = task.stageMaterials || {};
  const paymentRequired = Boolean(task.paymentRequired || task.stageMaterials?.paymentMeta?.required || ["ИП", "Самозанятость"].includes(String(task.paymentMethod || task.stageMaterials?.paymentMeta?.method || "")));
  const steps = [
    {
      key: "brief",
      title: "Изучил ТЗ",
      state: ["ТЗ изучено", "В работе", "30%", "60%", "На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status)
        ? "done"
        : status === "Назначена"
        ? "active"
        : "upcoming",
      meta: ["ТЗ изучено", "В работе", "30%", "60%", "На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status)
        ? "Подтверждено исполнителем"
        : status === "Назначена"
        ? "Текущий этап"
        : "Ещё не начато"
    },
    {
      key: "30",
      title: "30%",
      state: status === "В работе" ? "active" : materials.thirty || ["30%", "60%", "На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status) ? "done" : "upcoming",
      meta: materials.thirty?.value || (status === "В работе" ? "Текущий этап" : "Материал не загружен")
    },
    {
      key: "60",
      title: "60%",
      state: status === "30%" ? "active" : materials.sixty || ["60%", "На проверке", "Правки", "Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status) ? "done" : "upcoming",
      meta: materials.sixty?.value || (status === "30%" ? "Текущий этап" : "Материал не загружен")
    },
    {
      key: "final",
      title: "Финал",
      state: status === "60%" || status === "Правки" ? "active" : materials.final || ["На проверке", "Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status) ? "done" : "upcoming",
      meta: materials.final?.value || ((status === "60%" || status === "Правки") ? "Текущий этап" : "Материал не загружен")
    },
    {
      key: "review",
      title: "Проверка менеджером",
      state: status === "На проверке" ? "active" : ["Выполнена", "Не оплачена", "Оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты"].includes(status) ? "done" : "upcoming",
      meta: status === "На проверке" ? "Менеджер проверяет результат" : "Ещё не начато"
    }
  ] as Array<{ key: string; title: string; state: string; meta: string }>;

  if (paymentRequired) {
    steps.push({
      key: "invoice",
      title: "Счёт",
      state: status === "Ожидает счёт" ? "active" : materials.invoice || ["Счёт загружен", "Ожидает подтверждения оплаты", "Оплачена"].includes(status) ? "done" : "upcoming",
      meta: materials.invoice?.value || (status === "Ожидает счёт" ? "Загрузите счёт на оплату" : "Счёт ещё не загружен")
    });
  }

  steps.push({
    key: "payment",
    title: "Оплата менеджером",
    state: (paymentRequired ? status === "Счёт загружен" : ["Выполнена", "Не оплачена"].includes(status)) ? "active" : ["Ожидает подтверждения оплаты", "Оплачена"].includes(status) ? "done" : "upcoming",
    meta: ["Ожидает подтверждения оплаты", "Оплачена"].includes(status) ? "Оплата отправлена" : (paymentRequired ? (status === "Счёт загружен" ? "Менеджер должен оплатить счёт" : "Ещё не начато") : (["Выполнена", "Не оплачена"].includes(status) ? "Менеджер должен отметить оплату" : "Ещё не начато"))
  });

  steps.push({
    key: "paymentConfirm",
    title: "Подтверждение исполнителя",
    state: status === "Ожидает подтверждения оплаты" ? "active" : status === "Оплачена" ? "done" : "upcoming",
    meta: status === "Ожидает подтверждения оплаты" ? "Исполнитель подтверждает получение денег" : status === "Оплачена" ? "Получение денег подтверждено" : "Ещё не начато"
  });

  return steps as const;
}

function PipelineView({ task, compact = false }: { task: Task; compact?: boolean }) {
  const steps = getPipelineSteps(task);
  const visibleSteps = compact
    ? (() => {
        const activeStep = steps.find((step) => step.state === "active");
        if (activeStep) return [activeStep];
        if ((task.status || "") === "Оплачена") return [steps[steps.length - 1]];
        const lastDoneStep = [...steps].reverse().find((step) => step.state === "done");
        return [lastDoneStep || steps[0]];
      })()
    : steps;

  return (
    <div className={cn("rounded-[24px] border border-white/8 bg-black/20", compact ? "p-3" : "p-4")}>
      <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">{compact ? "Текущий этап" : "Pipeline задачи"}</div>
      <div className="space-y-3">
        {visibleSteps.map((step, index) => {
          const active = step.state === "active";
          const done = step.state === "done";
          return (
            <div key={step.key} className="relative flex gap-3">
              <div className="flex w-5 flex-col items-center">
                {done ? <CheckCircle2 className="h-5 w-5 text-[#56FFEF]" /> : active ? <LoaderCircle className="h-5 w-5 animate-spin text-[#56FFEF]" /> : <Circle className="h-5 w-5 text-white/25" />}
                {!compact && index !== visibleSteps.length - 1 ? <div className={cn("mt-1 w-px flex-1", done || active ? "bg-[#56FFEF]/40" : "bg-white/10")} /> : null}
              </div>
              <div className={cn("min-w-0 flex-1", compact ? "" : "pb-3")}>
                <div className="flex items-center justify-between gap-3">
                  <div className={cn("text-sm font-medium", active ? "text-[#56FFEF]" : "text-white")}>{step.title}</div>
                  <div className={cn("text-[11px] uppercase tracking-[0.12em]", done ? "text-[#56FFEF]" : active ? "text-[#56FFEF]" : "text-white/35")}>
                    {done ? "готово" : active ? "текущий" : "далее"}
                  </div>
                </div>
                <div className="mt-1 text-sm text-white/45 break-words">
                  <RenderTextOrLink value={step.meta} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  onClose,
  onManagerApprove,
  onManagerOpenFixes,
  onManagerMarkPaid,
  onManagerEdit,
  onManagerDeadlineMissed,
  onOpenAllFixes,
  onOpenExecutorProfile
}: {
  task: Task | null;
  onClose: () => void;
  onManagerApprove?: (taskId: number) => void;
  onManagerOpenFixes?: (taskId: number) => void;
  onManagerMarkPaid?: (taskId: number) => void;
  onManagerEdit?: (task: Task) => void;
  onManagerDeadlineMissed?: (taskId: number) => void;
  onOpenAllFixes?: (task: Task) => void;
  onOpenExecutorProfile?: (executorId: number) => void;
}) {
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3">
      <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0b0b10] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{task.id}</div>
            <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{task.title}</div>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-2 text-sm text-[#56FFEF]">
          Текущий этап: {getCurrentStageLabel(task.status)}
        </div>

        {task.deadlineExpired ? (
          <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
            {task.deadlineMissedMarked
              ? `Дедлайн отмечен как пропущенный${task.deadlinePenaltyPercent ? `. Рейтинг исполнителя снижен на ${task.deadlinePenaltyPercent}%` : ""}.`
              : "Дедлайн по задаче истёк. Менеджер должен решить: продлить срок или отметить просрочку."}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Дедлайн</div><div>{task.deadline || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Стоимость</div><div>{task.price || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Статус</div><div>{task.status || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Исполнитель</div>
            <div>{task.assignedExecutorName || "—"}</div>
            {task.assignedExecutorId && onOpenExecutorProfile ? (
              <button
                onClick={() => onOpenExecutorProfile(task.assignedExecutorId as number)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-2 text-xs font-medium text-[#56FFEF]"
              >
                <Eye className="h-3.5 w-3.5" />
                Профиль исполнителя
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/75">
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">ТЗ</div><div><RenderTextOrLink value={task.briefText || "—"} /></div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Источники</div><div><RenderTextOrLink value={task.sourcesText || "—"} /></div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Референсы</div><div><RenderTextOrLink value={task.refsText || "—"} /></div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Комментарий</div><div><RenderTextOrLink value={task.comment || "—"} /></div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Куда отгружать</div><div><RenderTextOrLink value={task.deliveryTarget || "—"} /></div></div>
                    <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Счёт на оплату</div><div><RenderTextOrLink value={task.stageMaterials?.invoice?.value || "—"} /></div></div>
        </div>

        <div className="mt-4">
          <PipelineView task={task} />
        </div>

        {onManagerEdit ? (
          <div className="mt-4">
            <button
              onClick={() => onManagerEdit(task)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white"
            >
              Редактировать задачу
            </button>
          </div>
        ) : null}

        {task.deadlineExpired && !task.deadlineMissedMarked && (onManagerEdit || onManagerDeadlineMissed) ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onManagerEdit?.(task)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white"
            >
              Продлить дедлайн
            </button>
            <button
              onClick={() => {
                onManagerDeadlineMissed?.(task.id);
                onClose();
              }}
              className="rounded-2xl bg-rose-300 px-4 py-3 text-sm font-medium text-black"
            >
              Дедлайн пропущен
            </button>
          </div>
        ) : null}

        {task.status === "На проверке" && (onManagerApprove || onManagerOpenFixes) ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onManagerOpenFixes?.(task.id)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white"
            >
              На правки
            </button>
            <button
              onClick={() => {
                onManagerApprove?.(task.id);
                onClose();
              }}
              className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
            >
              Принять
            </button>
          </div>
        ) : null}

        {["Счёт загружен", "Выполнена", "Не оплачена"].includes(String(task.status || "")) && onManagerMarkPaid ? (
          <div className="mt-4">
            <button
              onClick={() => {
                onManagerMarkPaid?.(task.id);
                onClose();
              }}
              className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
            >
              {task.status === "Счёт загружен" ? "Счёт оплачен" : "Отметить оплату"}
            </button>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/75">
          <FixesPreviewCard
            items={mergeHistoryItems(task.stageMaterials?.fixesHistory, task.stageMaterials?.fixesNote)}
            onOpenAll={() => onOpenAllFixes?.(task)}
          />
        </div>

        <div className="mt-4 space-y-2">
          <button onClick={onClose} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">Закрыть</button>
        </div>

      </div>
    </div>
  );
}



function ExecutorProfileViewModal({
  profile,
  onClose
}: {
  profile: ExecutorProfile | null;
  onClose: () => void;
}) {
  if (!profile) return null;

  const invoices = normalizeInvoiceList(profile.paymentInvoices).slice().reverse();

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-3">
      <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0b0b10] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Профиль исполнителя</div>
            <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{profile.fullName || "Без имени"}</div>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-2 text-sm text-[#56FFEF]">
            Рейтинг: {typeof profile.rating === "number" ? profile.rating : "—"}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
            Выполнено задач: {profile.stats?.completedTasks ?? profile.completedOrders ?? 0}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">ID</div><div>{profile.executorCode || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Контакт</div><div className="break-words">{profile.telegramContact || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Статус</div><div>{profile.status || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Способ оплаты</div><div>{profile.paymentMethod || "—"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Среднее число правок</div><div>{typeof profile.stats?.averageRevisions === "number" ? profile.stats.averageRevisions.toFixed(1) : "0.0"}</div></div>
          <div className="rounded-2xl bg-black/20 p-3"><div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Заработано</div><div>{typeof profile.stats?.earnedAmount === "number" ? `${profile.stats.earnedAmount.toLocaleString("ru-RU")} ₽` : "0 ₽"}</div></div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/75">
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Специализации</div>
            <div>{profile.verifiedSpecializations?.length ? profile.verifiedSpecializations.join(", ") : profile.specializations?.join(", ") || "—"}</div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Портфолио</div>
            <div><RenderTextOrLink value={profile.portfolio || "—"} /></div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Платёжные данные</div>
            <div className="whitespace-pre-wrap break-words">{getPaymentDetailsText(profile.paymentDetails) || "—"}</div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Договор</div>
            <div><RenderTextOrLink value={getPaymentDetailsText(profile.contractData as any) || "—"} /></div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">Все счета</div>
            {invoices.length ? (
              <div className="space-y-2">
                {invoices.map((invoice, index) => (
                  <div key={`profile-invoice-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-white/35">{formatDateLabel(invoice.createdAt) || "Без даты"}</div>
                      {invoice.price ? <div className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/60">{invoice.price}</div> : null}
                    </div>
                    {invoice.taskTitle ? <div className="mt-2 text-sm font-medium text-white/85">{invoice.taskTitle}</div> : null}
                    {invoice.taskId ? <div className="mt-1 text-xs text-white/40">Задача #{invoice.taskId}</div> : null}
                    <div className="mt-1 break-words text-sm text-white/80"><RenderTextOrLink value={invoice.value || "—"} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/45">Счётов пока нет</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button onClick={onClose} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">Закрыть</button>
        </div>
      </div>
    </div>
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
  const [executorFormError, setExecutorFormError] = useState("");
  const [isExecutorSubmitting, setIsExecutorSubmitting] = useState(false);
  const [isExecutorEditing, setIsExecutorEditing] = useState(false);
  const [isLeavingExecutor, setIsLeavingExecutor] = useState(false);
  const [executorBottomTab, setExecutorBottomTab] = useState<"tasks" | "profile">("tasks");
  const [executorTaskTopTab, setExecutorTaskTopTab] = useState<"new" | "active" | "archived">("new");
  const [executorTasks, setExecutorTasks] = useState<{ available: Task[]; active: Task[]; archived: Task[] }>({ available: [], active: [], archived: [] });
  const [isLoadingExecutorTasks, setIsLoadingExecutorTasks] = useState(false);
  const [executorTasksError, setExecutorTasksError] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [stageTaskId, setStageTaskId] = useState<number | null>(null);
  const [stageKey, setStageKey] = useState<"30" | "60" | "final" | "invoice" | null>(null);
  const [stageValue, setStageValue] = useState("");
  const [stageError, setStageError] = useState("");
  const [stageLoading, setStageLoading] = useState(false);
  const [fixesTaskId, setFixesTaskId] = useState<number | null>(null);
  const [fixesValue, setFixesValue] = useState("");
  const [fixesError, setFixesError] = useState("");
  const [fixesLoading, setFixesLoading] = useState(false);
  const [fixesClientFault, setFixesClientFault] = useState(false);
  const [allFixesTask, setAllFixesTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskCategories, setEditTaskCategories] = useState<string[]>([]);
  const [editTaskDeadlineDate, setEditTaskDeadlineDate] = useState("");
  const [editTaskDeadlineTime, setEditTaskDeadlineTime] = useState("");
  const [editTaskPrice, setEditTaskPrice] = useState("");
  const [editTaskSources, setEditTaskSources] = useState("");
  const [editTaskRefs, setEditTaskRefs] = useState("");
  const [editTaskDeliveryTarget, setEditTaskDeliveryTarget] = useState("");
  const [editTaskComment, setEditTaskComment] = useState("");
  const [editTaskError, setEditTaskError] = useState("");
  const [editTaskLoading, setEditTaskLoading] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeTopTab, setActiveTopTab] = useState<"waiting" | "active" | "archived">("waiting");
  const [activeBottomTab, setActiveBottomTab] = useState("tasks");

  const [tasksData, setTasksData] = useState<TasksResponse>({
    waiting: [],
    active: [],
    archived: []
  });
  const [managerTasks, setManagerTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [managerTasksError, setManagerTasksError] = useState("");
  const [deepLinkTaskId, setDeepLinkTaskId] = useState<number | null>(null);
  const [deepLinkRole, setDeepLinkRole] = useState<"manager" | "executor" | null>(null);
  const [deepLinkBottomTab, setDeepLinkBottomTab] = useState<string | null>(null);
  const [deepLinkTopTab, setDeepLinkTopTab] = useState<string | null>(null);

  const [managerExecutorsTopTab, setManagerExecutorsTopTab] = useState<"pending" | "registry">("pending");
  const [pendingExecutors, setPendingExecutors] = useState<ExecutorProfile[]>([]);
  const [approvedExecutors, setApprovedExecutors] = useState<ExecutorProfile[]>([]);
  const [selectedExecutorProfile, setSelectedExecutorProfile] = useState<ExecutorProfile | null>(null);
  const [executorRegistryFilter, setExecutorRegistryFilter] = useState<string>("all");
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

  const [calculatorTopTab, setCalculatorTopTab] = useState<"new" | "all" | "dashboard">("new");
  const [calculatorTitle, setCalculatorTitle] = useState("");
  const [calculatorInputs, setCalculatorInputs] = useState<Record<CalculatorServiceKey, number>>(emptyCalculatorInputs());
  const [calculatorRawInputs, setCalculatorRawInputs] = useState<Record<CalculatorServiceKey, string>>({
    resize_static: "0",
    resize_animation: "0",
    resize_gif: "0",
    resize_html: "0",
    create_static: "0",
    create_animation: "0",
    create_gif: "0",
    create_html: "0"
  });
  const [calculatorValidationError, setCalculatorValidationError] = useState("");
  const [calculatorEntries, setCalculatorEntries] = useState<ManagerCalculatorEntry[]>([]);
  const [calculatorMessage, setCalculatorMessage] = useState("");
  const [pendingCalculatorIdForTask, setPendingCalculatorIdForTask] = useState<string | null>(null);
  const [managerProfileOwnerMode, setManagerProfileOwnerMode] = useState(false);

  useEffect(() => {
    const telegram = (window as any)?.Telegram?.WebApp;
    telegram?.ready?.();

    const username = telegram?.initDataUnsafe?.user?.username;
    if (username) {
      setCreateManagerContact(`@${username}`);
      setExecutorContact(`@${username}`);
    }
  }, []);

  const visibleTasks = useMemo(() => {
    const items = [...(tasksData[activeTopTab] || [])];
    const getTaskActivityTime = (task: Task) => {
      const candidates = [
        task.createdAt,
        task.publishedAt,
        task.stageMaterials?.thirty?.createdAt,
        task.stageMaterials?.sixty?.createdAt,
        task.stageMaterials?.final?.createdAt,
        task.stageMaterials?.fixesNote?.createdAt,
        task.stageMaterials?.invoice?.createdAt,
        ...(task.stageMaterials?.thirtyHistory || []).map((item) => item?.createdAt),
        ...(task.stageMaterials?.sixtyHistory || []).map((item) => item?.createdAt),
        ...(task.stageMaterials?.finalHistory || []).map((item) => item?.createdAt),
        ...(task.stageMaterials?.fixesHistory || []).map((item) => item?.createdAt),
        ...((Array.isArray((task as any)?.responses) ? (task as any).responses : []).map((item: any) => item?.createdAt))
      ].filter(Boolean) as string[];
      return candidates.reduce((max, value) => {
        const time = value ? new Date(value).getTime() : 0;
        return Number.isFinite(time) && time > max ? time : max;
      }, 0);
    };
    return items.sort((a, b) => getTaskActivityTime(b) - getTaskActivityTime(a));
  }, [tasksData, activeTopTab]);

  const getApprovedExecutorRank = (telegramId?: number) => {
    if (!telegramId) return null;
    const sorted = [...approvedExecutors].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    const index = sorted.findIndex((item) => Number(item.telegramId) === Number(telegramId));
    return index === -1 ? null : index + 1;
  };
  const executorVisibleTasks = useMemo(() => {
    if (executorTaskTopTab === "new") return executorTasks.available;
    if (executorTaskTopTab === "active") return executorTasks.active;
    return executorTasks.archived;
  }, [executorTaskTopTab, executorTasks]);
  const paymentPrompt = getPaymentPrompt(executorPaymentMethod);

  const selectedPendingExecutor = useMemo(
    () => pendingExecutors.find((item) => Number(item.telegramId) === Number(selectedPendingTelegramId)) || null,
    [pendingExecutors, selectedPendingTelegramId]
  );

  const selectedApprovedExecutor = useMemo(
    () => approvedExecutors.find((item) => Number(item.telegramId) === Number(editingRegistryTelegramId)) || null,
    [approvedExecutors, editingRegistryTelegramId]
  );

  const allManagerKnownTasks = useMemo(() => {
    return [
      ...(tasksData.waiting || []),
      ...(tasksData.active || []),
      ...(tasksData.archived || []),
      ...(managerTasks || [])
    ];
  }, [tasksData, managerTasks]);

  const openTaskFromCalculator = (taskId?: number | null) => {
    if (!taskId) return;

    const targetTask = allManagerKnownTasks.find((task) => Number(task.id) === Number(taskId)) || null;
    if (targetTask) {
      setSelectedTask(targetTask);
      setActiveBottomTab("tasks");
      return;
    }

    setManagerTasksError("Связанная задача не найдена");
  };

  const enrichExecutorProfileWithLocalStats = (profile: ExecutorProfile | null) => {
    if (!profile?.telegramId) return profile;

    const assignedTasks = allManagerKnownTasks.filter((task) => Number(task.assignedExecutorId || 0) === Number(profile.telegramId));
    const completedTasks = assignedTasks.filter((task) => {
      const status = String(task.status || "");
      return [
        "Выполнена",
        "Не оплачена",
        "Ожидает счёт",
        "Счёт загружен",
        "Ожидает подтверждения оплаты",
        "Оплачена",
        "Завершена",
        "Закрыта"
      ].includes(status);
    });

    const revisionValues = completedTasks
      .map((task) => Number(task.revisionCount || 0))
      .filter((value) => Number.isFinite(value));

    const averageRevisions = revisionValues.length
      ? Number((revisionValues.reduce((sum, value) => sum + value, 0) / revisionValues.length).toFixed(1))
      : 0;

    const earnedAmount = completedTasks.reduce((sum, task) => {
      const status = String(task.status || "");
      const paid = ["Оплачена", "Завершена", "Закрыта"].includes(status);
      if (!paid) return sum;

      const rawPrice = String(task.price || "");
      const numericPrice = Number(rawPrice.replace(/[^\d,.-]/g, "").replace(",", "."));
      return Number.isFinite(numericPrice) ? sum + numericPrice : sum;
    }, 0);

    return {
      ...profile,
      completedOrders: completedTasks.length,
      stats: {
        completedTasks: completedTasks.length,
        averageRevisions,
        earnedAmount: Number(earnedAmount.toFixed(2))
      }
    };
  };

  const filteredApprovedExecutors = useMemo(() => {
    const base = approvedExecutors.map((profile) => enrichExecutorProfileWithLocalStats(profile) || profile);
    if (executorRegistryFilter === "all") return base;

    return base.filter((profile) => {
      const specializations = profile?.verifiedSpecializations?.length
        ? profile.verifiedSpecializations
        : profile?.specializations || [];
      return specializations.includes(executorRegistryFilter);
    });
  }, [approvedExecutors, executorRegistryFilter, allManagerKnownTasks]);

  const openExecutorProfileById = async (executorId: number) => {
    let profile = approvedExecutors.find((item) => Number(item.telegramId) === Number(executorId)) || null;

    if (!profile) {
      try {
        await loadApprovedExecutors();
      } catch (error) {
        console.error(error);
      }
      profile = approvedExecutors.find((item) => Number(item.telegramId) === Number(executorId)) || null;
    }

    const enrichedProfile = enrichExecutorProfileWithLocalStats(profile);

    if (!enrichedProfile) {
      setManagerTasksError("Профиль исполнителя пока не найден");
      return;
    }

    setSelectedExecutorProfile(enrichedProfile);
  };

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

  const loadTasks = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoadingTasks(true);
      }
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
      if (!silent) {
        setIsLoadingTasks(false);
      }
    }
  };

  useEffect(() => {
    if (screen === "managerApp" && activeBottomTab === "tasks") {
      void loadTasks(false);
      void loadManagerTasks();
    }
  }, [screen, activeBottomTab, createManagerContact]);

  useEffect(() => {
    if (screen === "managerApp" && activeBottomTab === "executors") {
      void loadPendingExecutors();
      void loadApprovedExecutors();
    }
  }, [screen, activeBottomTab]);

  useEffect(() => {
    if (screen !== "managerApp" || activeBottomTab !== "tasks") return;

    const intervalId = window.setInterval(() => {
      void loadTasks(true);
      void loadManagerTasks();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [screen, activeBottomTab, createManagerContact]);

  useEffect(() => {
    if (screen === "executorApp" && executorBottomTab === "tasks" && executor?.telegramId) {
      void loadExecutorTasks(Number(executor.telegramId));
    }
  }, [screen, executorBottomTab, executorTaskTopTab, executor?.telegramId]);


  useEffect(() => {
    if (!deepLinkTaskId) return;

    if (deepLinkRole === "manager" && screen === "managerApp") {
      if (deepLinkBottomTab === "tasks") setActiveBottomTab("tasks");
      if (deepLinkBottomTab === "executors") setActiveBottomTab("executors");
      if (deepLinkTopTab === "waiting" || deepLinkTopTab === "active" || deepLinkTopTab === "archived") {
        setActiveTopTab(deepLinkTopTab);
      }

      const allTasks = [...(tasksData.waiting || []), ...(tasksData.active || []), ...(tasksData.archived || [])];
      const found = allTasks.find((task) => Number(task.id) === Number(deepLinkTaskId)) || managerTasks.find((task) => Number(task.id) === Number(deepLinkTaskId));
      if (found) {
        setSelectedTask(found);
        setDeepLinkTaskId(null);
      }
    }

    if (deepLinkRole === "executor" && screen === "executorApp") {
      setExecutorBottomTab("tasks");
      if (deepLinkTopTab === "new" || deepLinkTopTab === "active" || deepLinkTopTab === "archived") {
        setExecutorTaskTopTab(deepLinkTopTab);
      }
      const allTasks = [...executorTasks.available, ...executorTasks.active, ...executorTasks.archived];
      const found = allTasks.find((task) => Number(task.id) === Number(deepLinkTaskId));
      if (found) {
        setSelectedTask(found);
        setDeepLinkTaskId(null);
      }
    }
  }, [deepLinkTaskId, deepLinkRole, deepLinkBottomTab, deepLinkTopTab, screen, tasksData, managerTasks, executorTasks]);
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
        setExecutorBottomTab("tasks");
        void loadExecutorTasks(Number(data.executor.telegramId));
        setScreen("executorApp");
        return;
      }

      setScreen("executorRegister");
    } catch (error) {
      console.error("Failed to load executor:", error);
      setScreen("executorRegister");
    }
  };


  const loadExecutorTasks = async (telegramId: number, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      if (!silent) {
        setIsLoadingExecutorTasks(true);
        setExecutorTasksError("");
      }
      const response = await fetch(`${API_BASE}/api/tasks/executor?telegramId=${telegramId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "Failed to load executor tasks");
      setExecutorTasks({
        available: Array.isArray((data as any).available) ? (data as any).available : [],
        active: Array.isArray((data as any).active) ? (data as any).active : [],
        archived: Array.isArray((data as any).archived) ? (data as any).archived : []
      });
      if (silent) {
        setExecutorTasksError("");
      }
    } catch (error) {
      console.error("Failed to load executor tasks:", error);
      if (!silent) {
        setExecutorTasksError("Не удалось загрузить задачи исполнителя");
      }
    } finally {
      if (!silent) {
        setIsLoadingExecutorTasks(false);
      }
    }
  };

  const handleAssignTask = async (taskId: number, executorId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, executorId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "Failed to assign task");
      await loadTasks();
      await loadManagerTasks();
      if (executor?.telegramId) await loadExecutorTasks(Number(executor.telegramId));
    } catch (error) {
      console.error("Failed to assign executor:", error);
      setManagerTasksError("Не удалось назначить исполнителя");
    }
  };

  const handleExecutorTaskDecision = async (taskId: number, decision: "accept" | "decline") => {
    try {
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;
      const response = await fetch(`${API_BASE}/api/tasks/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, telegramId: user?.id || null, decision })
      });
      if (!response.ok) throw new Error("Failed to save decision");
      if (executor?.telegramId) await loadExecutorTasks(executor.telegramId);
      await loadTasks();
    } catch (error) {
      console.error("Failed to save executor decision:", error);
      setExecutorTasksError("Не удалось обновить статус задачи");
    }
  };

  const executorActionButtonLabel = (status?: string | null) => {
    if (status === "Назначена") return "Подтвердить изучение ТЗ";
    if (status === "ТЗ изучено") return "Начать работу";
    if (status === "В работе") return "Загрузить 30%";
    if (status === "30%") return "Загрузить 60%";
    if (status === "60%" || status === "Правки") return "Сдать задачу";
    if (status === "Ожидает счёт") return "Загрузить счёт";
    if (status === "Ожидает подтверждения оплаты") return "Подтвердить получение денег";
    return null;
  };

  const handleExecutorStageAction = async (task: Task) => {
    const label = executorActionButtonLabel(task.status);
    if (!label || !executor?.telegramId) return;

    if (label === "Подтвердить изучение ТЗ" || label === "Начать работу") {
      const action = label === "Подтвердить изучение ТЗ" ? "Изучил ТЗ" : "Взял в работу";
      try {
        const response = await fetch(`${API_BASE}/api/tasks/executor-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, telegramId: executor.telegramId, action })
        });
        if (!response.ok) throw new Error("Failed executor action");
        await loadExecutorTasks(executor.telegramId, { silent: true });
        await loadTasks({ silent: true });
      } catch (error) {
        console.error("Failed executor action:", error);
        setExecutorTasksError("Не удалось обновить этап");
      }
      return;
    }

    if (label === "Подтвердить получение денег") {
      try {
        const response = await fetch(`${API_BASE}/api/tasks/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, telegramId: executor.telegramId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((data as any)?.error || "Failed to confirm payment");
        await loadExecutorTasks(executor.telegramId);
        await loadTasks();
      } catch (error) {
        console.error("Failed to confirm payment:", error);
        setExecutorTasksError("Не удалось подтвердить получение оплаты");
      }
      return;
    }

    setStageTaskId(task.id);
    setStageKey(label === "Загрузить 30%" ? "30" : label === "Загрузить 60%" ? "60" : label === "Загрузить счёт" ? "invoice" : "final");
    setStageValue("");
    setStageError("");
  };

  const submitStageMaterial = async () => {
    if (!stageTaskId || !stageKey || !executor?.telegramId) return;
    if (!stageValue.trim()) {
      setStageError("Введи ссылку или комментарий");
      return;
    }
    try {
      setStageLoading(true);
      const endpoint = stageKey === "invoice" ? "/api/tasks/invoice-submit" : "/api/tasks/stage-submit";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: stageTaskId, telegramId: executor.telegramId, stageKey, value: stageValue.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "Failed stage submit");
      setStageTaskId(null);
      setStageKey(null);
      setStageValue("");
      setStageError("");
      await loadExecutorTasks(executor.telegramId, { silent: true });
      await loadTasks({ silent: true });
    } catch (error) {
      console.error("Failed to submit stage:", error);
      setStageError(error instanceof Error ? error.message : "Не удалось отправить материал");
    } finally {
      setStageLoading(false);
    }
  };


  const handleManagerStageAction = async (taskId: number, action: "approve" | "unpaid" | "paid" | "deadlineMissed") => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/manager-stage-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "manager stage action failed");
      await loadTasks();
      await loadManagerTasks();
      if (executor?.telegramId) await loadExecutorTasks(executor.telegramId);
    } catch (error) {
      console.error("Failed manager stage action:", error);
      setManagerTasksError("Не удалось обновить статус задачи");
    }
  };

  const submitFixes = async () => {
    if (!fixesTaskId) return;
    if (!fixesValue.trim()) {
      setFixesError("Опиши, что нужно исправить");
      return;
    }
    try {
      setFixesLoading(true);
      setFixesError("");
      const response = await fetch(`${API_BASE}/api/tasks/manager-stage-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: fixesTaskId, action: "fixes", note: fixesValue.trim(), clientFault: fixesClientFault })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "fixes submit failed");
      setFixesTaskId(null);
      setFixesValue("");
      setFixesClientFault(false);
      await loadTasks();
      await loadManagerTasks();
      if (executor?.telegramId) await loadExecutorTasks(executor.telegramId);
    } catch (error) {
      console.error("Failed to submit fixes:", error);
      setFixesError("Не удалось отправить задачу на правки");
    } finally {
      setFixesLoading(false);
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


  const loadManagerTasks = async () => {
    try {
      setManagerTasksError("");

      const managerContact = createManagerContact.trim();
      const requestUrl = managerContact
        ? `${API_BASE}/api/tasks/manager?managerContact=${encodeURIComponent(managerContact)}`
        : `${API_BASE}/api/tasks/manager`;

      const response = await fetch(requestUrl, {
        method: "GET"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((data as any)?.error || "Failed to load manager tasks");
      }

      const tasks = Array.isArray((data as any)?.tasks) ? (data as any).tasks : [];
      setManagerTasks(tasks);
    } catch (error) {
      console.error("Failed to load manager tasks:", error);
      setManagerTasksError("Не удалось загрузить отклики исполнителей");
    }
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

  const resetCalculatorForm = () => {
    setCalculatorTitle("");
    setCalculatorInputs(emptyCalculatorInputs());
    setCalculatorRawInputs({
      resize_static: "0",
      resize_animation: "0",
      resize_gif: "0",
      resize_html: "0",
      create_static: "0",
      create_animation: "0",
      create_gif: "0",
      create_html: "0"
    });
    setCalculatorValidationError("");
    setCalculatorMessage("");
    setPendingCalculatorIdForTask(null);
  };

  const calculatorHasInvalidInput = useMemo(() => {
    return CALCULATOR_LINES.some((line) => {
      const raw = String(calculatorRawInputs[line.key] ?? "").trim();
      return raw !== "" && !/^\d+$/.test(raw);
    });
  }, [calculatorRawInputs]);

  const handleCalculatorInputChange = (key: CalculatorServiceKey, rawValue: string) => {
    setCalculatorRawInputs((prev) => ({ ...prev, [key]: rawValue }));
    const trimmed = rawValue.trim();

    if (trimmed === "") {
      setCalculatorInputs((prev) => ({ ...prev, [key]: 0 }));
      setCalculatorValidationError("");
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setCalculatorValidationError("В калькуляторе можно вводить только натуральные числа");
      return;
    }

    setCalculatorValidationError("");
    setCalculatorInputs((prev) => ({ ...prev, [key]: Number(trimmed) }));
  };

  const calculatorDashboard = useMemo(() => {
    const safeEntries = Array.isArray(calculatorEntries) ? calculatorEntries : [];
    const totals = safeEntries.reduce((acc, entry) => {
      acc.revenue += Number(entry?.totals?.revenue || 0);
      acc.manager += Number(entry?.totals?.productionLead || 0);
      acc.art += Number(entry?.totals?.artDirector || 0);
      acc.risks += Number(entry?.totals?.risks || 0);
      acc.support += Number(entry?.totals?.support || 0);
      acc.net += Number(entry?.totals?.netProfit || 0);
      acc.owner += Number(entry?.totals?.ownerProfit || 0);
      acc.investors += Number(entry?.totals?.investorsProfit || 0);
      return acc;
    }, { revenue: 0, manager: 0, art: 0, risks: 0, support: 0, net: 0, owner: 0, investors: 0 });

    const byMonthMap = new Map<string, number>();
    safeEntries.forEach((entry) => {
      const date = entry?.updatedAt || entry?.createdAt;
      const d = date ? new Date(date) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonthMap.set(key, (byMonthMap.get(key) || 0) + Number(entry?.totals?.revenue || 0));
    });

    const byMonth = Array.from(byMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const maxMonthTotal = byMonth.reduce((max, item) => Math.max(max, item.total), 0) || 1;

    return { totals, byMonth, maxMonthTotal, count: safeEntries.length };
  }, [calculatorEntries]);

  const managerProfileStats = useMemo(() => {
    const contact = createManagerContact.trim();
    const createdTasks = Array.isArray(managerTasks) ? managerTasks : [];
    const totalTasks = createdTasks.length;
    const archivedStatuses = new Set(["Оплачена", "Выполнена", "Не оплачена", "Ожидает счёт", "Счёт загружен", "Ожидает подтверждения оплаты", "Завершена", "Закрыта"]);
    const completedTasks = createdTasks.filter((task) => archivedStatuses.has(String(task.status || ""))).length;
    const activeTasksCount = createdTasks.filter((task) => !archivedStatuses.has(String(task.status || ""))).length;
    const totalTaskBudget = createdTasks.reduce((sum, task) => {
      const value = Number(String(task.price || "").replace(/[^\d,.-]/g, "").replace(",", "."));
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    const approvedByMe = approvedExecutors.filter((executor) => String(executor.approvedBy || "").trim() === contact);

    return {
      contact,
      totalTasks,
      completedTasks,
      activeTasksCount,
      totalTaskBudget,
      approvedCount: approvedByMe.length,
      approvedExecutors: approvedByMe
    };
  }, [createManagerContact, managerTasks, approvedExecutors]);

  const calculatedManagerCalculator = useMemo(
    () => calculateManagerCalculator(calculatorInputs),
    [calculatorInputs]
  );

  const calculatorSpecializationSuggestions = useMemo(() => {
    return CALCULATOR_LINES.filter((line) => Number(calculatorInputs[line.key] || 0) > 0).map((line) => line.label);
  }, [calculatorInputs]);

  useEffect(() => {
    const loadCalculators = async () => {
      if (!createManagerContact.trim()) return;
      try {
        const response = await fetch(`${API_BASE}/api/calculators?managerContact=${encodeURIComponent(createManagerContact.trim())}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray((data as any)?.calculators)) {
          setCalculatorEntries((data as any).calculators);
          return;
        }
      } catch (error) {
        console.error("Failed to load calculators from backend:", error);
      }

      try {
        const raw = window.localStorage.getItem(CALCULATOR_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCalculatorEntries(parsed);
        }
      } catch (error) {
        console.error("Failed to load calculator registry:", error);
      }
    };

    void loadCalculators();
  }, [createManagerContact]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(calculatorEntries));
    } catch (error) {
      console.error("Failed to persist calculator registry:", error);
    }
  }, [calculatorEntries]);

  const saveCurrentCalculator = async (options?: { linkTaskId?: number | null; linkTaskTitle?: string | null; silent?: boolean }) => {
    const entry: ManagerCalculatorEntry = {
      id: pendingCalculatorIdForTask || `calc-${Date.now()}`,
      title: calculatorTitle.trim() || "Без названия",
      createdAt: pendingCalculatorIdForTask
        ? calculatorEntries.find((item) => item.id === pendingCalculatorIdForTask)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskId: options?.linkTaskId ?? calculatorEntries.find((item) => item.id === pendingCalculatorIdForTask)?.taskId ?? null,
      taskTitle: options?.linkTaskTitle ?? calculatorEntries.find((item) => item.id === pendingCalculatorIdForTask)?.taskTitle ?? null,
      inputs: { ...calculatorInputs },
      totals: { ...calculatedManagerCalculator.totals }
    };

    setCalculatorEntries((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)];
      return next;
    });

    try {
      if (createManagerContact.trim()) {
        await fetch(`${API_BASE}/api/calculators/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            managerContact: createManagerContact.trim(),
            entry
          })
        });
      }
    } catch (error) {
      console.error("Failed to save calculator to backend:", error);
    }

    if (!options?.silent) {
      setCalculatorMessage("Калькулятор сохранён");
    }

    return entry;
  };

  const openCalculatorEntry = (entry: ManagerCalculatorEntry) => {
    const nextInputs = { ...emptyCalculatorInputs(), ...entry.inputs };
    setCalculatorTitle(entry.title || "");
    setCalculatorInputs(nextInputs);
    setCalculatorRawInputs({
      resize_static: String(nextInputs.resize_static || 0),
      resize_animation: String(nextInputs.resize_animation || 0),
      resize_gif: String(nextInputs.resize_gif || 0),
      resize_html: String(nextInputs.resize_html || 0),
      create_static: String(nextInputs.create_static || 0),
      create_animation: String(nextInputs.create_animation || 0),
      create_gif: String(nextInputs.create_gif || 0),
      create_html: String(nextInputs.create_html || 0)
    });
    setPendingCalculatorIdForTask(entry.id);
    setCalculatorTopTab("new");
    setActiveBottomTab("calculator");
    setCalculatorValidationError("");
    setCalculatorMessage("");
  };

  const handleSaveCalculatorOnly = async () => {
    if (calculatorHasInvalidInput) {
      setCalculatorValidationError("Исправь поля калькулятора перед сохранением");
      return;
    }
    await saveCurrentCalculator();
    setCalculatorTopTab("all");
  };

  const handleCreateTaskFromCalculator = async () => {
    if (calculatorHasInvalidInput) {
      setCalculatorValidationError("Исправь поля калькулятора перед созданием задачи");
      return;
    }
    const saved = await saveCurrentCalculator({ silent: true });
    setPendingCalculatorIdForTask(saved.id);
    setCreatePrice(String(Math.round(calculatedManagerCalculator.totals.freelancerTotal || 0)));
    if (!createTitle.trim()) {
      setCreateTitle((calculatorTitle || "Задача из калькулятора").trim());
    }
    if (!createCategories.length) {
      const inferred = getCalculatorSpecializations(calculatorInputs);
      if (inferred.length) {
        setCreateCategories(Array.from(new Set(inferred)));
      }
    }
    setCalculatorMessage("Стоимость исполнителя перенесена в создание задачи");
    setActiveBottomTab("create");
  };

  const openTaskEditor = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title || "");
    setEditTaskCategories(Array.isArray(task.type) ? task.type : []);
    setEditTaskDeadlineDate(task.deadlineDate || "");
    setEditTaskDeadlineTime(task.deadlineTime || "");
    setEditTaskPrice(task.price || "");
    setEditTaskSources(task.sourcesText || "");
    setEditTaskRefs(task.refsText || "");
    setEditTaskDeliveryTarget(task.deliveryTarget || "");
    setEditTaskComment(task.comment || "");
    setEditTaskError("");
  };

  const handleToggleEditCategory = (category: string) => {
    setEditTaskCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const handleUpdateTask = async () => {
    if (!editingTaskId) return;
    if (!editTaskTitle.trim()) {
      setEditTaskError("Введите название задачи");
      return;
    }
    if (!editTaskCategories.length) {
      setEditTaskError("Выберите хотя бы одну категорию");
      return;
    }
    if (!editTaskDeadlineDate.trim() || !editTaskDeadlineTime.trim()) {
      setEditTaskError("Укажите дату и время дедлайна");
      return;
    }
    if (!editTaskPrice.trim()) {
      setEditTaskError("Введите стоимость");
      return;
    }

    try {
      setEditTaskLoading(true);
      setEditTaskError("");

      const response = await fetch(`${API_BASE}/api/tasks/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: editingTaskId,
          title: editTaskTitle.trim(),
          categories: editTaskCategories,
          deadlineDate: editTaskDeadlineDate.trim(),
          deadlineTime: editTaskDeadlineTime.trim(),
          price: editTaskPrice.trim(),
          sources: editTaskSources.trim() || null,
          refs_data: editTaskRefs.trim() || null,
          deliveryTarget: editTaskDeliveryTarget.trim() || null,
          comment: editTaskComment.trim() || null
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as any)?.error || "Failed to update task");

      setEditingTaskId(null);
      await Promise.allSettled([loadTasks(), loadManagerTasks()]);
      if (selectedTask?.id === editingTaskId) {
        setSelectedTask((data as any)?.task || null);
      }
    } catch (error) {
      console.error("Failed to update task:", error);
      setEditTaskError("Не удалось сохранить задачу");
    } finally {
      setEditTaskLoading(false);
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

      const createdTaskId = Number(data?.task?.id || 0) || null;
      const createdTaskTitle = String(data?.task?.title || createTitle.trim() || "Задача");

      if (pendingCalculatorIdForTask || activeBottomTab === "create") {
        saveCurrentCalculator({
          linkTaskId: createdTaskId,
          linkTaskTitle: createdTaskTitle,
          silent: true
        });
      }

      resetCreateForm();
      setPendingCalculatorIdForTask(null);
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
        setExecutorBottomTab("tasks");
        void loadExecutorTasks(Number(data.executor.telegramId));
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

  const handleExecutorLeave = async () => {
    if (!executor?.telegramId || isLeavingExecutor) return;

    const confirmed = window.confirm("Покинуть креативный конвейер? Вы исчезнете из активной базы и рейтинга. Позже можно зарегистрироваться заново, но рейтинг не восстановится.");
    if (!confirmed) return;

    try {
      setIsLeavingExecutor(true);
      setExecutorInfo("");
      setExecutorError("");
      const response = await fetch(`${API_BASE}/api/executors/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: executor.telegramId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.error || "Failed to leave creative conveyor");
      }

      setExecutor(null);
      setExecutorCode("");
      setExecutorInfo("");
      setExecutorError("");
      setExecutorTasks({ available: [], active: [], archived: [] });
      setExecutorTasksError("");
      setExecutorBottomTab("tasks");
      setExecutorTaskTopTab("new");
      setScreen("welcome");
    } catch (error) {
      console.error("Failed to leave creative conveyor:", error);
      setExecutorError(error instanceof Error ? error.message : "Не удалось покинуть креативный конвейер");
    } finally {
      setIsLeavingExecutor(false);
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

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 text-sm text-white/55">{paymentPrompt.label}</div>
          {paymentPrompt.helper ? <div className="mb-3 text-xs text-white/35">{paymentPrompt.helper}</div> : null}
          <FormTextarea
            value={executorPaymentDetails}
            onChange={(e) => setExecutorPaymentDetails(e.target.value)}
            placeholder={paymentPrompt.placeholder}
          />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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
          className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
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
                <button onClick={() => { resetExecutorForm(); setScreen("executorForm"); }} className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Заполнить анкету</button>
                <button onClick={() => { setExecutorError(""); setExecutorInfo(""); setExecutorCode(""); setScreen("executorCodeLogin"); }} className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-white transition hover:bg-white/10">У меня уже есть ID исполнителя</button>
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
                <button onClick={() => void handleExecutorCodeLogin()} className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95">Войти</button>
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
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div><div className="text-base text-white">{executor?.executorCode || "—"}</div></div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Контакт</div><div className="text-base text-white">{executor?.telegramContact || "—"}</div></div>
              </div>
            </motion.div>
          )}

          {screen === "executorApp" && (
            <motion.div key="executorApp" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">Исполнитель</div>
                    <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">{executorBottomTab === "tasks" ? "Задачи" : "Профиль"}</h2>
                  </div>
                  {executorBottomTab === "profile" ? (
                    <button onClick={() => { fillExecutorFormFromProfile(executor); setExecutorFormError(""); setExecutorInfo(""); setIsExecutorEditing(true); }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"><Pencil className="h-4 w-4" />Редактировать</button>
                  ) : null}
                </div>

                {executorBottomTab === "tasks" ? (
                  <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                    <button onClick={() => setExecutorTaskTopTab("new")} className={cn("rounded-[18px] px-3 py-3 text-left transition", executorTaskTopTab === "new" ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}>
                      <CircleDot className="mb-2 h-4 w-4" />
                      <div className="text-[12px] font-medium leading-4">Новые</div>
                    </button>
                    <button onClick={() => setExecutorTaskTopTab("active")} className={cn("rounded-[18px] px-3 py-3 text-left transition", executorTaskTopTab === "active" ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}>
                      <Clock3 className="mb-2 h-4 w-4" />
                      <div className="text-[12px] font-medium leading-4">Активные</div>
                    </button>
                    <button onClick={() => setExecutorTaskTopTab("archived")} className={cn("rounded-[18px] px-3 py-3 text-left transition", executorTaskTopTab === "archived" ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5")}>
                      <Archive className="mb-2 h-4 w-4" />
                      <div className="text-[12px] font-medium leading-4">Архив</div>
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 px-5 pb-28 pt-4">
                {executorBottomTab === "tasks" ? (
                  <>
                    {isLoadingExecutorTasks ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">Загружаю задачи...</div>
                    ) : executorTasksError ? (
                      <div className="space-y-3">
                        <div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{executorTasksError}</div>
                        <button onClick={() => executor?.telegramId ? void loadExecutorTasks(Number(executor.telegramId)) : null} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Повторить загрузку</button>
                      </div>
                    ) : executorVisibleTasks.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Здесь пока нет задач.</div>
                    ) : (
                      <div className="space-y-3">
                        {executorVisibleTasks.map((task) => (
                          <div key={task.id} className="space-y-3">
                            <TaskCard
                              task={task}
                              onOpen={() => setSelectedTask(task)}
                              footer={executorTaskTopTab === "new" ? (
                                task.myDecision === "Принял" ? (
                                  <div className="rounded-[22px] border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">
                                    Ваша заявка на выполнение отправлена. Когда менеджер подтвердит вас, задача автоматически перейдёт в активные.
                                  </div>
                                ) : task.myDecision === "Отклонил" ? (
                                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                                    Вы скрыли эту задачу.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => void handleExecutorTaskDecision(task.id, "accept")} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Принять задачу</button>
                                    <button onClick={() => void handleExecutorTaskDecision(task.id, "decline")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Скрыть</button>
                                  </div>
                                )
                              ) : executorTaskTopTab === "active" ? (
                                <>
                                  <PipelineView task={task} compact />
                                {task.status === "Правки" && task.stageMaterials?.fixesNote?.value ? (
                                  <button onClick={() => setSelectedTask(task)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                                    Посмотреть правки
                                  </button>
                                ) : null}
                                {executorActionButtonLabel(task.status) ? (
                                  <button onClick={() => void handleExecutorStageAction(task)} className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">
                                    {executorActionButtonLabel(task.status)}
                                  </button>
                                ) : null}
                                </>
                              ) : null}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {!isExecutorEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Выполнено задач</div><div className="text-2xl font-semibold text-white">{executor?.stats?.completedTasks ?? executor?.completedOrders ?? 0}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Рейтинг</div><div className="text-2xl font-semibold text-white">{typeof executor?.rating === "number" ? executor.rating : "—"}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Среднее число правок</div><div className="text-2xl font-semibold text-white">{typeof executor?.stats?.averageRevisions === "number" ? executor.stats.averageRevisions.toFixed(1) : "0.0"}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Заработано</div><div className="text-2xl font-semibold text-white">{typeof executor?.stats?.earnedAmount === "number" ? `${executor.stats.earnedAmount.toLocaleString("ru-RU")} ₽` : "0 ₽"}</div></div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">ID исполнителя</div><div className="text-white">{executor?.executorCode || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Имя и фамилия</div><div className="text-white">{executor?.fullName || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Контакт</div><div className="text-white">{executor?.telegramContact || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Статус</div><div className="text-white">{executor?.status || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Специализации</div><div className="text-white">{executor?.specializations?.length ? executor.specializations.join(", ") : "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Подтверждённые специализации</div><div className="text-white">{executor?.verifiedSpecializations?.length ? executor.verifiedSpecializations.join(", ") : "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Портфолио</div><div className="text-white break-words">{executor?.portfolio || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Способ выплаты</div><div className="text-white">{executor?.paymentMethod || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Данные для выплаты</div><div className="text-white whitespace-pre-wrap break-words">{getPaymentDetailsText(executor?.paymentDetails) || "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Недоступные дни</div><div className="text-white">{executor?.unavailableDays?.length ? executor.unavailableDays.join(", ") : "—"}</div></div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Часы недоступности</div><div className="text-white">{executor?.unavailableTime || "—"}</div></div>
                        {executor?.paymentInvoices?.length ? (
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Счета</div>
                            <div className="space-y-2">
                              {normalizeInvoiceList(executor.paymentInvoices).slice().reverse().map((invoice, index) => (
                                <div key={`executor-invoice-${index}`} className="rounded-2xl bg-black/20 p-3">
                                  <div className="text-[11px] text-white/35">{formatDateLabel(invoice.createdAt)}</div>
                                  <div className="mt-1 break-words text-white"><RenderTextOrLink value={invoice.value || "—"} /></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <button
                          onClick={() => void handleExecutorLeave()}
                          disabled={isLeavingExecutor}
                          className="w-full rounded-[24px] border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-base font-medium text-rose-200 transition hover:bg-rose-300/15 disabled:opacity-60"
                        >
                          {isLeavingExecutor ? "Удаляю из конвейера..." : "Покинуть креативный конвейер"}
                        </button>
                        {executorInfo ? <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{executorInfo}</div> : null}
                        {executorError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{executorError}</div> : null}
                      </div>
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
                  </>
                )}
              </div>

              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setIsExecutorEditing(false); setExecutorBottomTab("tasks"); }} className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", executorBottomTab === "tasks" ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}>
                    <Briefcase className="h-5 w-5" />
                    <span className="text-[10px] leading-none">Задачи</span>
                  </button>
                  <button onClick={() => setExecutorBottomTab("profile")} className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", executorBottomTab === "profile" ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}>
                    <Trophy className="h-5 w-5" />
                    <span className="text-[10px] leading-none">Профиль</span>
                  </button>
                </div>
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
                <button onClick={handleManagerLogin} className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 active:scale-[0.99]">Войти</button>
              </div>
            </motion.div>
          )}

          {screen === "managerApp" && (
            <motion.div key="managerApp" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.22 }} className="flex min-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Креативный конвейер ЛЭНД</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{activeBottomTab === "create" ? "Создать задачу" : activeBottomTab === "executors" ? "Исполнители" : activeBottomTab === "profile" ? "Профиль" : activeBottomTab === "calculator" ? "Калькулятор" : "Задачи"}</div>
                  </div>
                  <button onClick={() => { if (activeBottomTab === "executors") { void loadPendingExecutors(); void loadApprovedExecutors(); } else if (activeBottomTab === "tasks") { void loadTasks(); void loadManagerTasks(); } }} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70"><Search className="h-5 w-5" /></button>
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
                    {activeTopTab === "active" && visibleTasks.some((task) => task.deadlineExpired && !task.deadlineMissedMarked) ? (
                      <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">
                        Есть задачи с истёкшим дедлайном. Открой карточку задачи и отметь: продлить дедлайн или дедлайн пропущен.
                      </div>
                    ) : null}
                    {managerTasksError ? <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">{managerTasksError}</div> : null}
                    {isLoadingTasks ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">Загружаю задачи...</div>
                    ) : tasksError ? (
                      <div className="space-y-3"><div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{tasksError}</div><button onClick={() => { void loadTasks(); void loadManagerTasks(); }} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Повторить загрузку</button></div>
                    ) : visibleTasks.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">Здесь пока нет задач.</div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {visibleTasks.map((task) => (
                            <div key={task.id} className="space-y-3">
                              <TaskCard
                                task={task}
                                onOpen={() => setSelectedTask(task)}
                                footer={
                                  activeTopTab === "active" ? (
                                    <div className="space-y-3">
                                      <PipelineView task={task} compact />
                                      {task.status === "На проверке" ? (
                                        <div className="grid grid-cols-2 gap-2">
                                          <button onClick={() => { setFixesTaskId(task.id); setFixesValue(""); setFixesClientFault(false); setFixesError(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">На правки</button>
                                          <button onClick={() => void handleManagerStageAction(task.id, "approve")} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Принять</button>
                                        </div>
                                      ) : null}
                                      {task.status === "Счёт загружен" ? (
                                        <button onClick={() => void handleManagerStageAction(task.id, "paid")} className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Счёт оплачен</button>
                                      ) : null}
                                      {["Выполнена", "Не оплачена"].includes(String(task.status || "")) ? (
                                        <button onClick={() => void handleManagerStageAction(task.id, "paid")} className="w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black">Подтвердить оплату</button>
                                      ) : null}
                                    </div>
                                  ) : activeTopTab === "waiting" ? (
                                    (() => {
                                      const managerTask = managerTasks.find((item) => Number(item.id) === Number(task.id)) || task;
                                      const taskResponses = [...(Array.isArray((managerTask as any).responses) ? (managerTask as any).responses : [])]
                                        .sort((a: any, b: any) => {
                                          const ratingDiff = Number(b?.rating || 0) - Number(a?.rating || 0);
                                          if (ratingDiff !== 0) return ratingDiff;
                                          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                                          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                                          return bTime - aTime;
                                        });
                                      return taskResponses.length ? (
                                        <div className="space-y-2 rounded-[24px] border border-white/8 bg-black/20 p-4">
                                          <div className="text-sm text-white/55">Отклики исполнителей</div>
                                          {taskResponses.map((response: any) => {
                                            const rank = getApprovedExecutorRank(response.executorId);
                                            const accepted = response?.decision === "Принял";
                                            const telegramLink = response.executorContact
                                              ? `https://t.me/${String(response.executorContact).trim().replace(/^@+/, "")}`
                                              : "";
                                            return (
                                              <div
                                                key={`${task.id}-${response.executorId}`}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => void openExecutorProfileById(response.executorId)}
                                                onKeyDown={(event) => {
                                                  if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    void openExecutorProfileById(response.executorId);
                                                  }
                                                }}
                                                className="w-full rounded-2xl border border-white/10 bg-[#0b0b10] p-4 text-left transition hover:border-[#56FFEF]/20"
                                              >
                                                <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
                                                  #{rank && rank > 0 ? rank : "—"}
                                                </div>

                                                <div className="text-base font-semibold leading-tight text-white">
                                                  {response.executorName || "Без имени"}
                                                </div>

                                                <div className="mt-2">
                                                  {telegramLink ? (
                                                    <a
                                                      href={telegramLink}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      onClick={(event) => event.stopPropagation()}
                                                      className="text-sm text-white/50 underline-offset-4 transition hover:text-[#56FFEF] hover:underline"
                                                    >
                                                      {response.executorContact}
                                                    </a>
                                                  ) : (
                                                    <div className="text-sm text-white/45">Контакт не указан</div>
                                                  )}
                                                </div>

                                                {accepted ? (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      void handleAssignTask(task.id, response.executorId);
                                                    }}
                                                    className="mt-4 w-full rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
                                                  >
                                                    Подтвердить
                                                  </button>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null;
                                    })()
                                  ) : null
                                }
                              />
                            </div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                ) : activeBottomTab === "executors" ? (
                  <>
                    {managerExecutorsTopTab === "pending" ? (
                      <>
                        {isLoadingPendingExecutors ? (
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                            Загружаю заявки исполнителей...
                          </div>
                        ) : pendingExecutorsError ? (
                          <div className="space-y-3">
                            <div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
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
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
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
                                      "w-full rounded-[24px] border p-4 text-left transition",
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
                              <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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
                                    className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                                  >
                                    Отклонить
                                  </button>
                                  <button
                                    onClick={() => void handleModerateExecutor("approve")}
                                    disabled={isModeratingExecutor}
                                    className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
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
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                            Загружаю реестр исполнителей...
                          </div>
                        ) : approvedExecutorsError ? (
                          <div className="space-y-3">
                            <div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
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
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
                            В реестре пока нет подтверждённых исполнителей.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {isManagerEditingRegistryExecutor ? (
                              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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
                                    className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
                                  >
                                    {isSavingManagerExecutor ? "Сохраняю..." : "Сохранить карточку"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            <div className="mb-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setExecutorRegistryFilter("all")}
                                className={cn("rounded-full border px-3 py-2 text-sm transition", executorRegistryFilter === "all" ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                              >
                                Все
                              </button>
                              {SPECIALIZATION_OPTIONS.map((item) => (
                                <button
                                  type="button"
                                  key={`registry-filter-${item}`}
                                  onClick={() => setExecutorRegistryFilter(item)}
                                  className={cn("rounded-full border px-3 py-2 text-sm transition", executorRegistryFilter === item ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>

                            {filteredApprovedExecutors.map((profile, index) => (
                              <button
                                key={`${profile.telegramId}-${index}`}
                                type="button"
                                onClick={() => setSelectedExecutorProfile(enrichExecutorProfileWithLocalStats(profile))}
                                className="w-full rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">
                                      Место #{index + 1}
                                    </div>
                                    <div className="text-base font-semibold text-white">
                                      {profile.fullName || "Без имени"}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(profile.verifiedSpecializations?.length ? profile.verifiedSpecializations : profile.specializations || []).map((item) => (
                                        <span key={`${profile.telegramId}-${item}`} className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-1 text-xs text-[#56FFEF]">
                                      {typeof profile.rating === "number" ? `${profile.rating} pts` : "—"}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
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
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : activeBottomTab === "create" ? (
                  <div className="space-y-3">
                    <FormInput value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Название задачи" />
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 text-sm text-white/55">Категории</div><div className="flex flex-wrap gap-2">{SPECIALIZATION_OPTIONS.map((item) => { const active = createCategories.includes(item); return <button type="button" key={item} onClick={() => toggleCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}>{item}</button>; })}</div></div>
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
                    <button onClick={handleCreateTask} disabled={isCreating} className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60">{isCreating ? "Создаю..." : "Создать задачу"}</button>
                  </div>
                ) : activeBottomTab === "calculator" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCalculatorTopTab("new")}
                        className={cn("rounded-full border px-4 py-3 text-sm transition", calculatorTopTab === "new" ? "border-[#56FFEF]/20 bg-[#56FFEF]/10 text-[#56FFEF]" : "border-white/10 bg-white/[0.04] text-white/55")}
                      >
                        Новый калькулятор
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalculatorTopTab("all")}
                        className={cn("rounded-full border px-4 py-3 text-sm transition", calculatorTopTab === "all" ? "border-[#56FFEF]/20 bg-[#56FFEF]/10 text-[#56FFEF]" : "border-white/10 bg-white/[0.04] text-white/55")}
                      >
                        Все калькуляторы
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalculatorTopTab("dashboard")}
                        className={cn("rounded-full border px-4 py-3 text-sm transition", calculatorTopTab === "dashboard" ? "border-[#56FFEF]/20 bg-[#56FFEF]/10 text-[#56FFEF]" : "border-white/10 bg-white/[0.04] text-white/55")}
                      >
                        Дашборд
                      </button>
                    </div>

                    {calculatorTopTab === "new" ? (
                      <div className="space-y-4">
                        <FormInput
                          value={calculatorTitle}
                          onChange={(e) => setCalculatorTitle(e.target.value)}
                          placeholder="Название калькулятора / проекта"
                        />

                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-3 text-sm text-white/55">Количество по типам задач</div>
                          <div className="space-y-3">
                            {CALCULATOR_LINES.map((line) => (
                              <div key={line.key} className="grid grid-cols-[1fr_104px] items-center gap-3 rounded-2xl bg-black/20 p-3">
                                <div>
                                  <div className="text-sm font-medium text-white">{line.label}</div>
                                  <div className="mt-1 text-xs text-white/35">Клиент {formatRubles(line.clientPrice)} · исполнитель {formatRubles(line.freelancerRate)}</div>
                                </div>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={calculatorRawInputs[line.key] ?? "0"}
                                  onFocus={(e) => {
                                    if ((calculatorRawInputs[line.key] ?? "0") === "0") {
                                      setCalculatorRawInputs((prev) => ({ ...prev, [line.key]: "" }));
                                      e.currentTarget.select();
                                    }
                                  }}
                                  onBlur={() => {
                                    const current = String(calculatorRawInputs[line.key] ?? "").trim();
                                    if (!current) {
                                      setCalculatorRawInputs((prev) => ({ ...prev, [line.key]: "0" }));
                                      setCalculatorInputs((prev) => ({ ...prev, [line.key]: 0 }));
                                    }
                                  }}
                                  onChange={(e) => handleCalculatorInputChange(line.key, e.target.value)}
                                  className="w-full appearance-none rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-right text-base text-white outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Исполнителю</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.freelancerTotal)}</div>
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Менеджер</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.productionLead)}</div>
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Арт-директор</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.artDirector)}</div>
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Риски</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.risks)}</div>
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Support бюджет</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.support)}</div>
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/35">Чистая прибыль</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(calculatedManagerCalculator.totals.netProfit)}</div>
                          </div>
                        </div>

                        {calculatorValidationError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{calculatorValidationError}</div> : null}

                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-3 text-sm text-white/55">Расклад по модели</div>
                          <div className="space-y-2 text-sm">
                            {[
                              ["Счёт клиенту", calculatedManagerCalculator.totals.revenue],
                              ["Пул прибыли", calculatedManagerCalculator.totals.profitPool],
                              ["Бонусы сотрудникам", calculatedManagerCalculator.totals.bonuses],
                              ["Налоги на бонусы", calculatedManagerCalculator.totals.bonusTaxes],
                              ["Налог на прибыль", calculatedManagerCalculator.totals.profitTax],
                              ["20% владельцу", calculatedManagerCalculator.totals.ownerProfit],
                              ["80% инвесторам", calculatedManagerCalculator.totals.investorsProfit]
                            ].map(([label, value]) => (
                              <div key={String(label)} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 text-white/75">
                                <div>{label}</div>
                                <div className="font-medium text-white">{calculatorHasInvalidInput ? "Ошибка" : formatRubles(Number(value || 0))}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {calculatorMessage ? <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">{calculatorMessage}</div> : null}

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handleSaveCalculatorOnly}
                            className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-white transition hover:bg-white/10"
                          >
                            Сохранить калькулятор
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateTaskFromCalculator}
                            className="w-full rounded-[24px] bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95"
                          >
                            Сформировать задачу
                          </button>
                        </div>
                      </div>
) : calculatorTopTab === "all" ? (
                      <div className="space-y-3">
                        {calculatorEntries.length ? calculatorEntries.map((entry) => (
                          <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-base font-semibold text-white">{getCalculatorTitle(entry)}</div>
                                <div className="mt-1 text-xs text-white/40">{formatDateLabel(entry.updatedAt) || "Без даты"}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openCalculatorEntry(entry)}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75"
                              >
                                Открыть
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-2xl bg-black/20 p-3">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Исполнителю</div>
                                <div className="text-white">{formatRubles(entry.totals.freelancerTotal)}</div>
                              </div>
                              <div className="rounded-2xl bg-black/20 p-3">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Чистая прибыль</div>
                                <div className="text-white">{formatRubles(entry.totals.netProfit)}</div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Связанная задача</div>
                                <div className="mt-1 text-sm text-white/75">
                                  {entry.taskId ? `#${entry.taskId}${entry.taskTitle ? ` · ${entry.taskTitle}` : ""}` : "Пока не привязан"}
                                </div>
                              </div>
                              {entry.taskId ? (
                                <button
                                  type="button"
                                  onClick={() => openTaskFromCalculator(entry.taskId)}
                                  className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-2 text-xs text-[#56FFEF]"
                                >
                                  Открыть задачу
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )) : (
                          <div className="flex h-[40vh] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.04] px-6 text-center text-white/40">
                            Пока нет сохранённых калькуляторов
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Всего калькуляторов</div><div className="mt-2 text-2xl font-semibold text-white">{calculatorDashboard.count}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Total через менеджера</div><div className="mt-2 text-2xl font-semibold text-white">{formatRubles(calculatorDashboard.totals.revenue)}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Менеджеру</div><div className="mt-2 text-2xl font-semibold text-white">{formatRubles(calculatorDashboard.totals.manager)}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Арт-директору</div><div className="mt-2 text-2xl font-semibold text-white">{formatRubles(calculatorDashboard.totals.art)}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Владельцу</div><div className="mt-2 text-2xl font-semibold text-white">{formatRubles(calculatorDashboard.totals.owner)}</div></div>
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Инвесторам</div><div className="mt-2 text-2xl font-semibold text-white">{formatRubles(calculatorDashboard.totals.investors)}</div></div>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-3 text-sm text-white/55">Total по месяцам</div>
                          <div className="space-y-3">
                            {calculatorDashboard.byMonth.length ? calculatorDashboard.byMonth.map((item) => (
                              <div key={item.month}>
                                <div className="mb-1 flex items-center justify-between text-xs text-white/45">
                                  <span>{item.month}</span>
                                  <span>{formatRubles(item.total)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/5">
                                  <div className="h-2 rounded-full bg-[#56FFEF]" style={{ width: `${(item.total / calculatorDashboard.maxMonthTotal) * 100}%` }} />
                                </div>
                              </div>
                            )) : <div className="text-sm text-white/40">Пока нет данных для графика</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeBottomTab === "profile" ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                      <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Профиль менеджера</div>
                      <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{createManagerContact.trim() || "@manager"}</div>
                      <div className="mt-2 text-sm text-white/45">Уникальный ID пока фронтовый: {createManagerContact.trim() || "manager-profile"}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">Создано задач</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{managerProfileStats.totalTasks}</div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">Отрулил задач</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{managerProfileStats.completedTasks}</div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">Сейчас активных</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{managerProfileStats.activeTasksCount}</div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">На какую сумму отрулил</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{formatRubles(managerProfileStats.totalTaskBudget)}</div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-white/35">Одобренные исполнители</div>
                          <div className="mt-1 text-sm text-white/45">Всего одобрил: {managerProfileStats.approvedCount}</div>
                        </div>
                        <div className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-1 text-xs text-[#56FFEF]">
                          {managerProfileStats.approvedCount}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {managerProfileStats.approvedExecutors.length ? managerProfileStats.approvedExecutors.slice(0, 8).map((executor) => (
                          <button
                            key={`approved-by-manager-${executor.telegramId}`}
                            type="button"
                            onClick={() => setSelectedExecutorProfile(enrichExecutorProfileWithLocalStats(executor) || executor)}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-black/30"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{executor.fullName || "Без имени"}</div>
                                <div className="mt-1 text-xs text-white/45">{executor.telegramContact || "—"}</div>
                              </div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                                {typeof executor.rating === "number" ? `${executor.rating} pts` : "—"}
                              </div>
                            </div>
                          </button>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/40">
                            Пока нет исполнителей, одобренных этим менеджером.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Фронтовый дашборд менеджера</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-black/20 p-3">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Менеджеру</div>
                          <div className="text-white">{formatRubles(calculatorDashboard.totals.manager)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-3">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Владельцу</div>
                          <div className="text-white">{formatRubles(calculatorDashboard.totals.owner)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-3">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Инвесторам</div>
                          <div className="text-white">{formatRubles(calculatorDashboard.totals.investors)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-3">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Чистая прибыль</div>
                          <div className="text-white">{formatRubles(calculatorDashboard.totals.net)}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setManagerProfileOwnerMode((prev) => !prev)}
                      className="w-full rounded-[24px] border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-5 py-4 text-base font-medium text-[#56FFEF] transition hover:bg-[#56FFEF]/15"
                    >
                      {managerProfileOwnerMode ? "Скрыть режим владельца" : "Я владелец креативного конвейера"}
                    </button>

                    {managerProfileOwnerMode ? (
                      <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">Режим владельца — фронтовый прототип</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-black/20 p-3">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Всего исполнителей</div>
                            <div className="text-xl font-semibold text-white">{approvedExecutors.length}</div>
                          </div>
                          <div className="rounded-2xl bg-black/20 p-3">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Менеджеров в прототипе</div>
                            <div className="text-xl font-semibold text-white">1</div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-black/20 p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">Топ исполнители</div>
                          <div className="space-y-2">
                            {approvedExecutors.slice(0, 8).map((executor, index) => (
                              <div key={`owner-executor-${executor.telegramId}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-white">{executor.fullName || "Без имени"}</div>
                                  <div className="text-xs text-white/45">{executor.telegramContact || "—"}</div>
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                                  #{index + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/40">
                          Здесь позже появится полноценный владелецкий реестр менеджеров и исполнителей с метриками эффективности.
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="w-full rounded-[24px] border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-base font-medium text-rose-200 transition hover:bg-rose-300/15"
                    >
                      Покинуть креативный конвейер
                    </button>
                  </div>
                ) : activeBottomTab === "profile" ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-[#56FFEF]">manager profile</div>
                      <div className="mt-1 text-sm text-white/80">это фронтовый профиль менеджера</div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                      <div className="text-sm text-white/40">Контакт</div>
                      <div className="mt-2 text-xl text-white">{createManagerContact || "@manager"}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-black/20 p-3">
                        <div className="text-xs text-white/40">Задач создано</div>
                        <div className="mt-2 text-lg font-semibold text-white">{managerTasks.length}</div>
                      </div>

                      <div className="rounded-2xl bg-black/20 p-3">
                        <div className="text-xs text-white/40">Активных</div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {managerTasks.filter((t) => !["Оплачена", "Завершена", "Закрыта"].includes(String(t.status || ""))).length}
                        </div>
                      </div>
                    </div>

                    <button className="w-full rounded-[20px] bg-[#56FFEF] py-3 text-black">
                      Покинуть креативный конвейер
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-white/40">Экран «{bottomTabs.find((item) => item.key === activeBottomTab)?.label}» будет следующим шагом.</div>
                )}
              </div>
              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl"><div className="grid grid-cols-5 gap-1">{bottomTabs.map((tab) => { const Icon = tab.icon; const active = activeBottomTab === tab.key; return <button key={tab.key} onClick={() => setActiveBottomTab(tab.key)} className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition", active ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]")}><Icon className="h-5 w-5" /><span className="text-[10px] leading-none">{tab.label}</span></button>; })}</div></div>
            </motion.div>
          )}
        </AnimatePresence>

        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onManagerApprove={screen === "managerApp" && activeBottomTab === "tasks" ? ((taskId) => void handleManagerStageAction(taskId, "approve")) : undefined}
          onManagerOpenFixes={screen === "managerApp" && activeBottomTab === "tasks" ? ((taskId) => {
            setFixesTaskId(taskId);
            setFixesValue("");
            setFixesClientFault(false);
            setFixesError("");
            setSelectedTask(null);
          }) : undefined}
          onManagerMarkPaid={screen === "managerApp" && activeBottomTab === "tasks" ? ((taskId) => void handleManagerStageAction(taskId, "paid")) : undefined}
          onManagerEdit={screen === "managerApp" && activeBottomTab === "tasks" ? ((task) => openTaskEditor(task)) : undefined}
          onManagerDeadlineMissed={screen === "managerApp" && activeBottomTab === "tasks" ? ((taskId) => void handleManagerStageAction(taskId, "deadlineMissed")) : undefined}
          onOpenAllFixes={(task) => setAllFixesTask(task)}
          onOpenExecutorProfile={screen === "managerApp" && activeBottomTab === "tasks" ? ((executorId) => void openExecutorProfileById(executorId)) : undefined}
        />

        <ExecutorProfileViewModal
          profile={selectedExecutorProfile}
          onClose={() => setSelectedExecutorProfile(null)}
        />

        {fixesTaskId ? (
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3">
            <div className="w-full max-w-[430px] rounded-[26px] border border-white/10 bg-[#0b0b10] p-5">
              <div className="mb-3 text-lg font-semibold text-white">Отправить на правки</div>
              <FormTextarea value={fixesValue} onChange={(e) => setFixesValue(e.target.value)} placeholder="Опиши, что нужно исправить" />
              <label className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={fixesClientFault}
                  onChange={(e) => setFixesClientFault(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
                />
                <span>Не учитывать эти правки в рейтинге исполнителя</span>
              </label>
              {fixesError ? <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{fixesError}</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setFixesTaskId(null); setFixesValue(""); setFixesError(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Отмена</button>
                <button onClick={() => void submitFixes()} disabled={fixesLoading} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black disabled:opacity-60">{fixesLoading ? "Отправляю..." : "Отправить"}</button>
              </div>
            </div>
          </div>
        ) : null}

        {allFixesTask ? (
          <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-3">
            <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0b0b10] p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{allFixesTask.id}</div>
                  <div className="text-xl font-semibold tracking-[-0.04em] text-white">Все правки</div>
                </div>
                <button onClick={() => setAllFixesTask(null)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <HistoryList title="История правок" items={mergeHistoryItems(allFixesTask.stageMaterials?.fixesHistory, allFixesTask.stageMaterials?.fixesNote)} />
              <div className="mt-4">
                <button onClick={() => setAllFixesTask(null)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">Закрыть</button>
              </div>
            </div>
          </div>
        ) : null}

        {editingTaskId ? (
          <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/70 p-3">
            <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0b0b10] p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="text-xl font-semibold text-white">Редактировать задачу</div>
                <button onClick={() => { setEditingTaskId(null); setEditTaskError(""); }} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <FormInput value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} placeholder="Название задачи" />

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 text-sm text-white/55">Категории</div>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALIZATION_OPTIONS.map((item) => {
                      const active = editTaskCategories.includes(item);
                      return (
                        <button
                          type="button"
                          key={`edit-${item}`}
                          onClick={() => handleToggleEditCategory(item)}
                          className={cn("rounded-full border px-3 py-2 text-sm transition", active ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]" : "border-white/10 bg-white/5 text-white/65")}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FormInput type="date" value={editTaskDeadlineDate} onChange={(e) => setEditTaskDeadlineDate(e.target.value)} />
                <FormInput type="time" value={editTaskDeadlineTime} onChange={(e) => setEditTaskDeadlineTime(e.target.value)} />
                <FormInput value={editTaskPrice} onChange={(e) => setEditTaskPrice(e.target.value)} placeholder="Стоимость" />
                <FormInput value={editTaskSources} onChange={(e) => setEditTaskSources(e.target.value)} placeholder="Источники" />
                <FormInput value={editTaskRefs} onChange={(e) => setEditTaskRefs(e.target.value)} placeholder="Референсы" />
                <FormInput value={editTaskDeliveryTarget} onChange={(e) => setEditTaskDeliveryTarget(e.target.value)} placeholder="Куда отгружать" />
                <FormInput value={editTaskComment} onChange={(e) => setEditTaskComment(e.target.value)} placeholder="Комментарий" />

                {editTaskError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{editTaskError}</div> : null}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setEditingTaskId(null); setEditTaskError(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                    Отмена
                  </button>
                  <button onClick={() => void handleUpdateTask()} disabled={editTaskLoading} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black disabled:opacity-60">
                    {editTaskLoading ? "Сохраняю..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {stageTaskId && stageKey ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3">
            <div className="w-full max-w-[430px] rounded-[26px] border border-white/10 bg-[#0b0b10] p-5">
              <div className="mb-4 text-xl font-semibold text-white">
                {stageKey === "30" ? "Загрузить 30%" : stageKey === "60" ? "Загрузить 60%" : stageKey === "invoice" ? "Загрузить счёт" : "Сдать задачу"}
              </div>
              <FormTextarea value={stageValue} onChange={(e) => setStageValue(e.target.value)} placeholder={stageKey === "invoice" ? "Ссылка на счёт или комментарий" : "Ссылка на работу или комментарий"} />
              {stageError ? <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{stageError}</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setStageTaskId(null); setStageKey(null); setStageValue(""); setStageError(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">Отмена</button>
                <button onClick={() => void submitStageMaterial()} disabled={stageLoading} className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black disabled:opacity-60">{stageLoading ? "Отправляю..." : "Отправить"}</button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}

function looksLikeUrl(value?: string | null) {
  if (!value) return false;
  const trimmed = value.trim();
  return /^(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(trimmed);
}

function normalizeUrl(value?: string | null) {
  if (!value) return "#";
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function RenderTextOrLink({ value }: { value?: string | null }) {
  if (!value) return <span className="whitespace-pre-wrap break-words">—</span>;
  if (looksLikeUrl(value)) {
    const href = normalizeUrl(value);
    return (
      <a href={href} target="_blank" rel="noreferrer" className="break-all text-[#56FFEF] underline underline-offset-4">
        {value}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}


function mergeHistoryItems(
  history?: Array<{ value?: string; createdAt?: string }> | null,
  fallback?: { value?: string; createdAt?: string } | null
) {
  const normalizedHistory = Array.isArray(history)
    ? history
        .filter((item) => item && String(item.value || "").trim())
        .map((item) => ({
          value: String(item?.value || "").trim(),
          createdAt: item?.createdAt || undefined
        }))
    : [];

  const merged = [
    ...normalizedHistory,
    ...(fallback?.value
      ? [{ value: String(fallback.value).trim(), createdAt: fallback.createdAt }]
      : [])
  ];

  return merged
    .filter((item) => item?.value)
    .filter((item, index, array) => {
      return array.findIndex(
        (candidate) => candidate.value === item.value && candidate.createdAt === item.createdAt
      ) === index;
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
}

function FixesPreviewCard({
  items,
  onOpenAll
}: {
  items?: Array<{ value?: string; createdAt?: string }> | null;
  onOpenAll?: () => void;
}) {
  const normalized = Array.isArray(items)
    ? items
        .filter((item) => item?.value)
        .map((item) => ({
          value: String(item?.value || "").trim(),
          createdAt: item?.createdAt || undefined
        }))
        .filter((item) => item.value)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
    : [];

  const uniqueItems = normalized.filter((item, index, array) => {
    return array.findIndex((candidate) => candidate.value === item.value && candidate.createdAt === item.createdAt) === index;
  });

  const visible = uniqueItems.slice(0, 3);

  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">История правок</div>
      {!visible.length ? (
        <div className="text-white/45">—</div>
      ) : (
        <div className="space-y-3">
          {visible.map((item, index) => (
            <div key={`fix-preview-${index}`} className="border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
              <div className="mb-1 text-xs text-white/35">{formatDateLabel(item.createdAt)}</div>
              <div className="text-sm text-white/80"><RenderTextOrLink value={item.value} /></div>
            </div>
          ))}
          {uniqueItems.length > 3 && onOpenAll ? (
            <button onClick={onOpenAll} className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-3 py-2 text-xs text-[#56FFEF]">
              Посмотреть все правки
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HistoryList({
  title,
  items
}: {
  title: string;
  items?: Array<{ value?: string; createdAt?: string }> | null;
}) {
  const normalized = Array.isArray(items) ? items.filter((item) => item?.value) : [];
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">{title}</div>
      {!normalized.length ? (
        <div className="text-white/45">—</div>
      ) : (
        <div className="space-y-3">
          {normalized.map((item, index) => (
            <div key={`${title}-${index}`} className="border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
              <div className="mb-1 text-xs text-white/35">{formatDateLabel(item.createdAt)}</div>
              <div className="text-sm text-white/80"><RenderTextOrLink value={item.value} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

