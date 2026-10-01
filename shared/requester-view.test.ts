import { describe, it, expect } from "vitest";
import { requesterStatus } from "./requester-view";

describe("requesterStatus", () => {
  it("traduz os status para a linguagem do solicitante", () => {
    expect(requesterStatus("open").label).toBe("Recebido");
    expect(requesterStatus("triage").label).toBe("Recebido");
    expect(requesterStatus("in_progress").label).toBe("Em atendimento");
    expect(requesterStatus("blocked").label).toBe("Em atendimento");
    expect(requesterStatus("waiting_requester")).toEqual({ label: "Aguardando você", tone: "attention", open: true });
    expect(requesterStatus("resolved")).toMatchObject({ label: "Resolvido", open: false });
    expect(requesterStatus("closed")).toMatchObject({ label: "Encerrado", open: false });
  });

  it("status desconhecido ou vazio conta como recebido e aberto", () => {
    expect(requesterStatus(null)).toMatchObject({ label: "Recebido", open: true });
    expect(requesterStatus("qualquer")).toMatchObject({ label: "Recebido", open: true });
  });
});
