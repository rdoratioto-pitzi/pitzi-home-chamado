// Alterações da equipe que o solicitante precisa saber por e-mail (evento ticket_updated).
// Só grupo e título: gravidade, prioridade, responsável, campos personalizados e Objeto da
// Requisição são internos e não geram e-mail (status tem os eventos próprios).

export interface TicketChangeFields {
  title: string;
  category: string;
  requesterId: string;
}

export function describeTeamChanges(
  before: TicketChangeFields,
  after: TicketChangeFields,
  actorId: string,
  groupName: (key: string) => string = (key) => key,
): string {
  if (actorId === after.requesterId) return "";
  const changes: string[] = [];
  if (before.category !== after.category) {
    changes.push(`grupo de ${groupName(before.category)} para ${groupName(after.category)}`);
  }
  if (before.title !== after.title) changes.push(`título para "${after.title}"`);
  return changes.join("; ");
}
