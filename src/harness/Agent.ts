// Agent: il ciclo agentico dell'harness.
// Riceve una richiesta dell'operatore e la porta a termine: interroga il
// modello, esegue i tool che il modello chiede, gli restituisce i risultati e
// ripete, finché il modello risponde senza chiedere altri tool.
// Ricorda gli ultimi scambi della sessione (richieste e risposte finali), così
// l'operatore può rispondere a una domanda dell'agente o continuare un discorso.

import type { ConfermaUtente } from "./ConfermaUtente.ts";
import type { JsonlLogger } from "./JsonlLogger.ts";
import type { McpToolClient } from "./McpToolClient.ts";
import type { ModelProvider } from "./ModelProvider.ts";
import type { ChiamataTool, EsitoAgente, Messaggio, SpecTool, UsoToken } from "./tipi.ts";

export class Agent {
  private readonly modello: ModelProvider; // il modello, dietro l'astrazione dal fornitore
  private readonly mcp: McpToolClient; // il collegamento al server MCP
  private readonly conferma: ConfermaUtente; // chi chiede la conferma all'operatore
  private readonly log: JsonlLogger; // il log strutturato di ogni passo
  private readonly promptDiSistema: string; // le istruzioni fisse per il modello
  private readonly maxIterazioni: number; // numero massimo di giri del ciclo
  private readonly maxScambi: number; // quanti scambi con l'operatore ricordare
  // La memoria della sessione: le richieste dell'operatore e le risposte finali
  // del modello, senza le chiamate ai tool. Vive solo in RAM: all'uscita sparisce.
  private storia: Messaggio[] = [];

  constructor(
    modello: ModelProvider,
    mcp: McpToolClient,
    conferma: ConfermaUtente,
    log: JsonlLogger,
    promptDiSistema: string,
    maxIterazioni = 12,
    maxScambi = 5,
  ) {
    this.modello = modello;
    this.mcp = mcp;
    this.conferma = conferma;
    this.log = log;
    this.promptDiSistema = promptDiSistema;
    this.maxIterazioni = maxIterazioni;
    this.maxScambi = maxScambi;
  }

  // Esegue una richiesta dell'operatore e restituisce l'esito: la risposta,
  // il motivo per cui il ciclo si è fermato, i giri fatti e i token consumati.
  async esegui(richiesta: string): Promise<EsitoAgente> {
    this.log.registra({
      tipo: "inizio",
      richiesta,
      modello: this.modello.nome,
      scambiInMemoria: this.storia.length / 2,
    });

    // Somma dei token di tutti i giri: serve per la stima dei costi.
    const tokenTotali: UsoToken = { ingresso: 0, uscita: 0 };

    // Le scritture davvero eseguite in questa richiesta. Le registra
    // eseguiChiamata: è l'harness a saperlo con certezza, non il modello.
    const scritture: ChiamataTool[] = [];

    // I tool disponibili si chiedono al server: il modello può usare solo questi.
    // Se il server non risponde, il modello non viene interrogato: senza i dati
    // potrebbe solo inventare.
    let tools: SpecTool[];
    try {
      tools = await this.mcp.elencaTool();
    } catch (errore) {
      this.log.registra({ tipo: "errore", messaggio: testoErrore(errore) });
      return this.concludi({
        risposta:
          "Il sistema delle prenotazioni non è raggiungibile in questo momento: " +
          "non posso leggere né modificare i dati. Riprova più tardi.",
        motivo: "server_non_disponibile",
        iterazioni: 0,
        token: tokenTotali,
        scritture,
      });
    }

    // La conversazione parte dalle istruzioni (sistema), poi gli scambi
    // precedenti della sessione (la memoria), poi la richiesta dell'operatore
    // (utente). Il modello da solo non ricorda niente: a ogni giro riceve tutta
    // la lista, che cresce con le sue risposte e con i risultati dei tool.
    const messaggi: Messaggio[] = [
      { ruolo: "sistema", testo: this.promptDiSistema },
      ...this.storia,
      { ruolo: "utente", testo: richiesta },
    ];

    // Il ciclo agentico: ogni giro è una chiamata al modello. Il limite di giri
    // ferma un modello che continua a chiedere tool senza arrivare a una risposta.
    // Un errore grave (il modello non risponde, il collegamento con il server
    // cade a metà) ferma il ciclo: finisce nel log e l'operatore riceve un
    // messaggio chiaro, con l'avviso sulle operazioni forse già eseguite.
    let iterazione = 0;
    try {
      for (iterazione = 1; iterazione <= this.maxIterazioni; iterazione++) {
        // Il modello riceve tutta la conversazione e l'elenco dei tool.
        this.log.registra({ tipo: "richiesta_modello", iterazione, messaggi: messaggi.length });
        const risposta = await this.modello.chat(messaggi, tools);
        this.log.registra({ tipo: "risposta_modello", iterazione, ...risposta });

        const { ingresso, uscita } = risposta.token;
        tokenTotali.ingresso += ingresso;
        tokenTotali.uscita += uscita;

        // Condizione di arresto: se il modello non chiede tool, il suo testo è la
        // risposta finale per l'operatore.
        if (risposta.chiamate.length === 0) {
          this.ricorda(richiesta, risposta.testo);
          return this.concludi({
            risposta: risposta.testo,
            motivo: "risposta_finale",
            iterazioni: iterazione,
            token: tokenTotali,
            scritture,
          });
        }

        // Altrimenti il modello ha chiesto uno o più tool. La sua risposta entra
        // nella conversazione, così al prossimo giro sa che cosa aveva chiesto.
        messaggi.push({ ruolo: "modello", testo: risposta.testo, chiamate: risposta.chiamate });

        // Le chiamate si eseguono una alla volta, nell'ordine deciso dal modello.
        // Il testo di ognuna (risultato o errore) entra nella conversazione come
        // messaggio "tool": il modello lo legge al prossimo giro.
        for (const chiamata of risposta.chiamate) {
          const { nome } = chiamata;
          const esitoTool = await this.eseguiChiamata(chiamata, tools, scritture);
          messaggi.push({ ruolo: "tool", nomeTool: nome, testo: esitoTool });
        }
      }
    } catch (errore) {
      this.log.registra({ tipo: "errore", messaggio: testoErrore(errore) });
      this.azzeraMemoria();
      return this.concludi({
        risposta:
          "Si è verificato un errore durante l'esecuzione della richiesta. " +
          "Alcune operazioni potrebbero essere già state eseguite: controlla prima di riprovare.",
        motivo: "errore",
        iterazioni: iterazione,
        token: tokenTotali,
        scritture,
      });
    }

    // Limite di giri raggiunto senza una risposta finale. Il messaggio dice che
    // cosa è successo e avvisa che qualche scrittura potrebbe essere già avvenuta.
    this.azzeraMemoria();
    return this.concludi({
      risposta:
        "Non sono riuscito a completare la richiesta entro il numero massimo di passaggi. " +
        "Alcune operazioni potrebbero essere già state eseguite: controlla prima di riprovare, " +
        "poi riformula la richiesta in modo più preciso.",
      motivo: "max_iterazioni",
      iterazioni: this.maxIterazioni,
      token: tokenTotali,
      scritture,
    });
  }

  // Ogni uscita dal ciclo passa da qui: registra la fine nel log, con il
  // motivo dell'arresto, e restituisce l'esito.
  private concludi(esito: EsitoAgente): EsitoAgente {
    this.log.registra({ tipo: "fine", ...esito });
    return esito;
  }

  // Dimentica gli scambi precedenti: la prossima richiesta parte da zero.
  // La usano la Cli (comando "nuova") e lo script degli scenari.
  azzeraMemoria(): void {
    this.storia = [];
  }

  // Aggiunge alla memoria lo scambio appena concluso e tiene solo gli ultimi
  // maxScambi. Ogni scambio sono due messaggi (richiesta e risposta), quindi
  // si tengono gli ultimi 2 * maxScambi messaggi.
  private ricorda(richiesta: string, risposta: string): void {
    this.storia.push({ ruolo: "utente", testo: richiesta }, { ruolo: "modello", testo: risposta, chiamate: [] });
    this.storia = this.storia.slice(-2 * this.maxScambi);
  }

  // Esegue una chiamata chiesta dal modello e restituisce il testo da ridare al
  // modello: il risultato del tool, oppure il motivo per cui non è stato
  // eseguito. Gli errori che il modello può correggere da solo non diventano
  // eccezioni: tornano come testo, così il modello li legge e riprova.
  private async eseguiChiamata(chiamata: ChiamataTool, tools: SpecTool[], scritture: ChiamataTool[]): Promise<string> {
    // Il tool chiesto deve essere tra quelli esposti dal server: un modello può
    // inventarsi un nome.
    const tool: SpecTool | undefined = tools.find((t) => t.nome === chiamata.nome);

    // Tool inesistente: non si chiama niente. Il modello riceve l'avviso con i
    // nomi dei tool disponibili.
    if (!tool) {
      this.log.registra({ tipo: "tool_non_disponibile", tool: chiamata.nome });
      return `Tool ${chiamata.nome} non trovato, i tool disponibili sono: ${tools.map((t) => t.nome).join(", ")}`;
    }

    // Tool che modifica i dati (non dichiarato di sola lettura): prima di
    // eseguirlo serve la conferma dell'operatore. Se la nega, non si chiama
    // niente e il modello riceve il rifiuto.
    if (!tool.soloLettura) {
      const approvata = await this.conferma.conferma(chiamata);
      this.log.registra({ tipo: "conferma", tool: chiamata.nome, argomenti: chiamata.argomenti, concessa: approvata });
      if (!approvata) {
        return "Operazione annullata: l'operatore non ha confermato, quindi i dati non sono stati modificati.";
      }
    }

    // Tool valido: si esegue sul server e al modello torna il testo dell'esito
    // (i dati in JSON, oppure il messaggio d'errore del tool).
    this.log.registra({ tipo: "chiamata_tool", tool: chiamata.nome, argomenti: chiamata.argomenti });
    const inizio = Date.now();
    const esito = await this.mcp.chiamaTool(chiamata.nome, chiamata.argomenti);
    this.log.registra({
      tipo: "risultato_tool",
      tool: chiamata.nome,
      ...esito,
      durataMs: Date.now() - inizio,
    });

    // Una scrittura confermata e andata a buon fine entra nell'elenco: è la
    // prova di che cosa è cambiato davvero nel database.
    if (!tool.soloLettura && !esito.errore) {
      scritture.push(chiamata);
    }
    return esito.testo;
  }
}

// Il testo di un errore qualunque: quello che arriva in un catch può essere
// di qualsiasi tipo, non per forza un Error.
function testoErrore(errore: unknown): string {
  return errore instanceof Error ? errore.message : String(errore);
}
