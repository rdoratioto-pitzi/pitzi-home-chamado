/**
 * Job de processamento de reuniões recorrentes
 * 
 * Este job verifica periodicamente as reuniões recorrentes e cria
 * novas instâncias automaticamente com base nas configurações de recurrence.
 * 
 * Timezone: America/Sao_Paulo (Brasília)
 */

import cron from "node-cron";
import { storage } from "../storage";
import { getCachedProdutos } from "../services/estoque-cache.service";
import { 
  addDays, 
  addWeeks, 
  isBefore, 
  isAfter, 
  parseISO, 
  startOfDay,
  getDay,
  setHours,
  setMinutes,
  setSeconds,
  addHours // Added addHours for recurrence logic
} from "date-fns";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { sendMeetingInviteEmail } from "../email-service";
import crypto from "crypto";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Converte uma data para o timezone de Brasília
 */
function toBrasilia(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

/**
 * Converte uma data de Brasília para UTC
 */
function fromBrasilia(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

/**
 * Obtém a data atual no timezone de Brasília
 */
function nowInBrasilia(): Date {
  return toBrasilia(new Date());
}

/**
 * Calcula a próxima data de recorrência com base na configuração
 */
function calculateNextRecurrenceDate(
  task: any, 
  fromDate: Date
): Date | null {
  const recurrenceEndDate = task.recurrenceEndDate 
    ? new Date(task.recurrenceEndDate) 
    : null;
  
  // Se passou da data final de recorrência, retorna null
  if (recurrenceEndDate && isAfter(fromDate, recurrenceEndDate)) {
    return null;
  }
  
  let nextDate: Date;
  
  if (task.recurrenceType === "daily") {
    // Recorrência diária - adiciona 1 dia
    nextDate = addDays(fromDate, 1);
  } else if (task.recurrenceType === "weekly") {
    // Recorrência semanal - determina próximos dias da semana
    const weekdays = parseWeekdays(task.recurrenceWeekdays);
    
    if (weekdays.length === 0) {
      // Se não há dias específicos, usa diariamente
      nextDate = addWeeks(fromDate, 1);
    } else {
      // Encontra o próximo dia da semana válido
      nextDate = findNextWeekday(fromDate, weekdays);
    }
  } else {
    // Tipo desconhecido
    return null;
  }
  
  // Verifica se passou da data final
  if (recurrenceEndDate && isAfter(nextDate, recurrenceEndDate)) {
    return null;
  }
  
  return nextDate;
}

/**
 * Parses weekdays from JSON string or array
 */
function parseWeekdays(weekdays: any): number[] {
  if (!weekdays) return [];
  
  try {
    if (typeof weekdays === "string") {
      return JSON.parse(weekdays);
    }
    if (Array.isArray(weekdays)) {
      return weekdays;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Encontra o próximo dia da semana válido a partir da data atual
 */
function findNextWeekday(fromDate: Date, weekdays: number[]): Date {
  let currentDate = addDays(fromDate, 1); // Começa do próximo dia
  const maxIterations = 14; // Máximo de 2 semanas para encontrar
  
  for (let i = 0; i < maxIterations; i++) {
    const dayOfWeek = getDay(currentDate);
    // getDay retorna 0 = domingo, 1 = segunda, ..., 6 = sábado
    // Mas weekdays no schema usa 1 = segunda, ..., 5 = sexta (dias úteis)
    // Precisamos normalizar
    const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 7 = domingo
    
    if (weekdays.includes(normalizedDay)) {
      return currentDate;
    }
    currentDate = addDays(currentDate, 1);
  }
  
  // Se não encontrou, retorna 1 semana depois
  return addWeeks(fromDate, 1);
}

/**
 * Cria uma nova instância de reunião recorrente
 */
async function createRecurrenceInstance(parentTask: any, nextDate: Date): Promise<any> {
  // Extrai meetingData do pai
  let meetingData: any = {};
  try {
    if (typeof parentTask.meetingData === "string") {
      meetingData = JSON.parse(parentTask.meetingData);
    } else if (parentTask.meetingData) {
      meetingData = parentTask.meetingData;
    }
  } catch (e) {
    console.error("[RecurrenceJob] Erro ao fazer parse do meetingData:", e);
  }

  const originalTime = meetingData?.time || "09:00";

  // Formata a próxima data no formato YYYY-MM-DD
  const nextDateStr = format(nextDate, "yyyy-MM-dd");

  // Bug 3: se a reunião pai foi criada a partir de um template, usa o template
  // para popular a pauta da nova instância (em vez de copiar o conteúdo editado do pai)
  let agendaForInstance = meetingData?.agenda || "";
  const templateId = meetingData?.templateId;
  if (templateId) {
    try {
      const template = await storage.getTaskTemplate(templateId);
      if (template?.structure) {
        const templateStructure = typeof template.structure === "string"
          ? JSON.parse(template.structure)
          : template.structure;
        if (templateStructure?.agenda !== undefined) {
          agendaForInstance = templateStructure.agenda;
        }
      }
    } catch (e) {
      console.error("[RecurrenceJob] Erro ao buscar template para instância:", e);
    }
  }

  // Cria a nova instância
  const newTask = {
    title: parentTask.title,
    description: parentTask.description,
    type: parentTask.type,
    status: "todo", // Nova instância começa como "a fazer"
    priority: parentTask.priority,
    tagId: parentTask.tagId,
    assigneeId: parentTask.assigneeId,
    assigneeIds: parentTask.assigneeIds,
    dueDate: nextDate, // Usa a data de recorrência
    createdBy: parentTask.createdBy,
    meetingData: JSON.stringify({
      // Preserva metadados do template e configurações
      templateId: meetingData?.templateId,
      location: meetingData?.location || "",
      recurrenceCreateLeadDays: meetingData?.recurrenceCreateLeadDays,
      date: nextDateStr,
      time: originalTime,
      // Mantém os mesmos participantes
      participants: meetingData?.participants || [],
      externalParticipants: meetingData?.externalParticipants || [],
      // Pauta: do template (se houver) ou vazia — não copia o conteúdo da reunião anterior
      agenda: agendaForInstance,
      actions: [],
    }),
    order: parentTask.order || 0,
    // Configurações de recorrência
    isRecurring: false, // Instâncias filhas não são recorrentes por padrão
    recurrenceType: null,
    recurrenceWeekdays: null,
    recurrenceEndDate: null,
    parentTaskId: parentTask.id, // Referência ao pai
  };
  
  const createdTask = await storage.createTask(newTask);
  console.log(`[RecurrenceJob] Criada instância ${createdTask.id} da reunião recorrente ${parentTask.id} para ${nextDateStr}`);
  
  // Envia notificações aos participantes
  await sendNotificationsForNewInstance(createdTask, parentTask);
  
  return createdTask;
}

/**
 * Envia notificações para os participantes da nova instância
 */
async function sendNotificationsForNewInstance(task: any, parentTask: any): Promise<void> {
  try {
    // Extrai participantes do meetingData
    let meetingData = {};
    try {
      if (typeof task.meetingData === "string") {
        meetingData = JSON.parse(task.meetingData);
      } else if (task.meetingData) {
        meetingData = task.meetingData;
      }
    } catch (e) {
      console.error("[RecurrenceJob] Erro ao fazer parse do meetingData para notificação:", e);
    }
    
    const participants = (meetingData as any)?.participants || [];
    const externalParticipants = (meetingData as any)?.externalParticipants || [];
    
    if (participants.length === 0 && externalParticipants.length === 0) {
      return;
    }
    
    const organizer = await storage.getUser(task.createdBy);
    if (!organizer) return;
    
    // Busca usuários do sistema para notificação
    const participantUsers = await Promise.all(
      participants.map((id: string) => storage.getUser(id))
    );
    const validParticipants = participantUsers.filter((p): p is NonNullable<typeof p> => p !== undefined);
    
    // Envia email para participantes
    if (validParticipants.length > 0 || externalParticipants.length > 0) {
      sendMeetingInviteEmail(
        task, 
        organizer, 
        validParticipants, 
        externalParticipants
      ).catch(console.error);
    }
    
    // Cria notificações internas
    for (const participantId of participants) {
      if (participantId !== task.createdBy) {
        await storage.createNotification({
          userId: participantId,
          fromUserId: task.createdBy,
          title: "Reunião recorrente agendada",
          message: `${organizer.name} agendou uma nova instância da reunião "${task.title}"`,
          module: "reunioes",
          entityId: task.id,
          linkUrl: `/reunioes/${task.id}`,
        }).catch(console.error);
      }
    }
    
  } catch (error) {
    console.error("[RecurrenceJob] Erro ao enviar notificações:", error);
  }
}

/**
 * Verifica se uma data é válida para criar instância (ainda não passou)
 */
function isValidDateForCreation(dateStr: string, timeStr: string): boolean {
  try {
    // Combina data e hora
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    
    // Cria data no timezone de Brasília
    let date = new Date(year, month - 1, day, hours, minutes);
    date = toBrasilia(date);
    
    // Permite criar instâncias que ainda não passaram (com margem de 1 hora)
    const now = nowInBrasilia();
    const oneHourFromNow = addDays(now, 0); // Agora
    
    return isBefore(date, addDays(oneHourFromNow, 1)); // Permite criar até 24h antes
  } catch (e) {
    console.error("[RecurrenceJob] Erro ao validar data:", e);
    return false;
  }
}

/**
 * Função principal que processa todas as reuniões recorrentes
 */
export async function processRecurringMeetings(): Promise<void> {
  console.log("[RecurrenceJob] Iniciando processamento de reuniões recorrentes...");
  
  try {
    // Busca todas as tarefas que são recorrentes
    // Como getTasks não suporta filtro isRecurring, buscamos todas e filtramos
    const allTasks = await storage.getTasks({});
    const recurringTasks = allTasks.filter(t => t.isRecurring && t.type === "meeting_note");
    
    console.log(`[RecurrenceJob] Encontradas ${recurringTasks.length} reuniões recorrentes`);
    
    let createdCount = 0;
    
    for (const task of recurringTasks) {
      try {
        // Busca instâncias existentes desta reunião
        const instances = await storage.getTasks({});
        const childInstances = instances.filter(t => t.parentTaskId === task.id);
        
        // Determina a última data de ocorrência
        let lastDate: Date;
        
        if (childInstances.length > 0) {
          // Usa a instância mais recente
          const sortedInstances = childInstances
            .filter(t => t.dueDate)
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
          
          if (sortedInstances.length > 0) {
            lastDate = new Date(sortedInstances[sortedInstances.length - 1].dueDate!);
          } else {
            // Se não tem dueDate nas instâncias, usa a data da reunião original
            const meetingData = typeof task.meetingData === "string" 
              ? JSON.parse(task.meetingData) 
              : task.meetingData;
            lastDate = meetingData?.date 
              ? parseISO(meetingData.date as string) 
              : new Date(task.createdAt);
          }
        } else {
          // Primeira instância - usa a data original da reunião
          const meetingData = typeof task.meetingData === "string" 
            ? JSON.parse(task.meetingData) 
            : task.meetingData;
            lastDate = meetingData?.date 
              ? parseISO(meetingData.date as string) 
              : new Date(task.createdAt);
        }
        
        // Calcula próximas datas de recorrência (até 7 dias ahead)
        const now = nowInBrasilia();
        const maxDate = addDays(now, 7);
        
        // Calcula a próxima data de recorrência
        const nextDateToCreate = calculateNextRecurrenceDate(task, lastDate);

        if (nextDateToCreate) {
          // Extrai meetingData para obter horário e configuração de antecedência
          let meetingData: any = {};
          try {
            if (typeof task.meetingData === "string") {
              meetingData = JSON.parse(task.meetingData);
            } else if (task.meetingData) {
              meetingData = task.meetingData;
            }
          } catch (e) {
            console.error("[RecurrenceJob] Erro ao fazer parse do meetingData para verificação de horário:", e);
          }
          const originalTime = meetingData?.time || "09:00";
          const [hours, minutes] = originalTime.split(':').map(Number);

          // Cria um objeto Date com a próxima data e o horário original da reunião
          let nextInstanceDateTime = setMinutes(setHours(nextDateToCreate, hours), minutes);
          nextInstanceDateTime = toBrasilia(nextInstanceDateTime);

          // Calcula a janela de criação baseada em recurrenceCreateLeadDays (padrão: 1 dia)
          const leadDays = typeof meetingData?.recurrenceCreateLeadDays === "number"
            ? meetingData.recurrenceCreateLeadDays
            : 1;
          const now = nowInBrasilia();
          // A instância deve ser criada quando now >= (meetingDate - leadDays)
          const creationWindowStart = addDays(nextInstanceDateTime, -leadDays);

          // Bug 1: verifica se já existe uma instância filha para esta data (evita duplicação)
          const nextDateDayStr = format(nextDateToCreate, "yyyy-MM-dd");
          const alreadyExists = childInstances.some((inst) => {
            if (!inst.dueDate) return false;
            return format(new Date(inst.dueDate), "yyyy-MM-dd") === nextDateDayStr;
          });

          // Cria se: janela de criação já chegou E a reunião ainda não passou E não existe ainda
          if (isAfter(now, creationWindowStart) && isAfter(nextInstanceDateTime, now) && !alreadyExists) {
            await createRecurrenceInstance(task, nextDateToCreate);
            createdCount++;
          } else if (alreadyExists) {
            console.log(`[RecurrenceJob] Instância para ${nextDateDayStr} já existe, pulando.`);
          } else if (isBefore(nextInstanceDateTime, now)) {
            console.log(`[RecurrenceJob] Instância ${task.id} para ${format(nextInstanceDateTime, "yyyy-MM-dd HH:mm")} já passou e não foi criada. Avançando lastDate.`);
          }
        }
        
      } catch (error) {
        console.error(`[RecurrenceJob] Erro ao processar reunião ${task.id}:`, error);
      }
    }
    
    console.log(`[RecurrenceJob] Processamento concluído. ${createdCount} novas instâncias criadas.`);
    
  } catch (error) {
    console.error("[RecurrenceJob] Erro fatal no processamento:", error);
  }
}

/**
 * Inicia o cron job para processar reuniões recorrentes
 * 
 * O job roda a cada hora para verificar novas reuniões a criar
 */
export function startRecurrenceJob(): void {
  // Cron de recorrência: apenas em horário comercial (8h–19h, seg–sex, America/Sao_Paulo)
  // Evita criar instâncias e enviar emails de convite durante a madrugada/fins de semana
  cron.schedule("15 8-19 * * 1-5", async () => {
    console.log("[RecurrenceJob] Executando job de recorrência...");
    await processRecurringMeetings();
  }, { timezone: "America/Sao_Paulo" });

  // Cron de aquecimento do cache Omie: mantém a cada hora (separado do job de recorrência)
  // para que nenhum usuário fique esperando pela chamada à API externa
  cron.schedule("15 * * * *", async () => {
    try {
      await getCachedProdutos();
      console.log("[RecurrenceJob] Cache Omie aquecido com sucesso");
    } catch (err: any) {
      console.error("[RecurrenceJob] Falha ao aquecer cache Omie:", err.message);
    }
  });

  console.log("[RecurrenceJob] Job de recorrência agendado (8h–19h seg–sex) | Cache Omie a cada hora");
}

// Exporta também para execução manual
export { processRecurringMeetings as processRecurringMeetingsManual };
