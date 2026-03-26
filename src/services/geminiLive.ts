import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { secrets } from '../config/secrets';

export enum LiveConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  SEARCHING = 'SEARCHING',
  ERROR = 'ERROR'
}

export interface LiveSession {
  sendRealtimeInput: (input: any) => Promise<void>;
  sendToolResponse: (response: any) => Promise<void>;
  close: () => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private session: any = null;
  private status: LiveConnectionStatus = LiveConnectionStatus.IDLE;
  private onMessageCallback: ((message: LiveServerMessage) => void) | null = null;
  private onErrorCallback: ((error: any) => void) | null = null;
  private onStatusChangeCallback: ((status: LiveConnectionStatus) => void) | null = null;

  constructor(apiKey: string) {
    const activeKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
    if (activeKey && activeKey !== "YOUR_API_KEY") {
      this.ai = new GoogleGenAI({ apiKey: activeKey });
    }
  }

  private setStatus(status: LiveConnectionStatus) {
    this.status = status;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  public async connect(callbacks: {
    onMessage: (message: LiveServerMessage) => void;
    onError: (error: any) => void;
    onStatusChange: (status: LiveConnectionStatus) => void;
  }, systemInstruction?: string, voiceName: string = "Zephyr", isConversationMode: boolean = false) {
    if (!this.ai) throw new Error("Gemini API Key not configured");

    this.onMessageCallback = callbacks.onMessage;
    this.onErrorCallback = callbacks.onError;
    this.onStatusChangeCallback = callbacks.onStatusChange;

    this.setStatus(LiveConnectionStatus.CONNECTING);

    try {
      console.log("Connecting to Gemini Live with voice:", voiceName, "Conversation Mode:", isConversationMode);
      
      const defaultSystemInstruction = `JESUS I.A. 360° (Modo Live). Protocolo MARE.
OBJETIVO: Interação humana sequencial ("Human-in-the-loop") para reportagens de revista e gestão de documentos.

DIRETRIZES DE FLUXO (OBRIGATÓRIO - NÃO PULE ETAPAS):
1. **Criação de Nota (PRIMEIRO PASSO)**: Antes de qualquer pesquisa, SEMPRE use a ferramenta 'create_note' para criar um cartão na tela com o tema solicitado e informações adicionais que você já possui na sua base de conhecimento.
2. **Apresentação Inicial**: Apresente a nota criada e pergunte se o usuário concorda com o conteúdo, se deseja editar ou apagar.
3. **Aguardar Autorização**: NÃO dispare YouTube, MARI ou qualquer outra pesquisa automaticamente. Aguarde o usuário autorizar explicitamente a pesquisa baseada na nota.
4. **Execução Sequencial**: Só use ferramentas de pesquisa (youtube_search, mari_research, etc.) após autorização explícita do usuário sobre a nota.
5. **Voz vs Texto**: Respostas curtas e amigáveis na voz; profundidade, elegância e markdown no texto transcrito. Referencie fontes com links REAIS ao final. NUNCA invente links.
6. **Cloud Vision**: Use 'vision_analyze' para analisar imagens enviadas pelo usuário ou links de imagens.

GOOGLE DRIVE & WORKSPACE (PESQUISA SEMÂNTICA):
- Ao pesquisar no Drive ('drive_search'), use os detalhes da nota inicial (ex: "documento jurídico", "inquérito", "petição") para refinar a busca.
- A ferramenta retorna resultados com pontuação de similaridade e cores (Verde: Alta, Amarelo: Média, Vermelho: Baixa).
- Apresente os resultados agrupados por tipo (Planilhas, Documentos, PDFs, etc.) e mencione as datas de criação e modificação.
- Priorize os documentos "Verdes" como os mais prováveis de serem o que o usuário procura.
- Use 'generate_image' para criar imagens artísticas e ilustrações quando o usuário solicitar ou no Modo Imagem.`;

      const conversationModeInstruction = `JESUS I.A. 360° (MODO CONVERSA ATIVO).
OBJETIVO: Diálogo fluido, empático e focado na base de conhecimento interna.

DIRETRIZES DO MODO CONVERSA:
1. FOCO NO DIÁLOGO: Priorize a conversa direta e o uso da sua base de conhecimento interna para responder.
2. BUSCA WEB LIMITADA: Use a ferramenta 'googleSearch' APENAS se estritamente necessário para compreensão do contexto atual. Limite-se a no máximo 7 fontes relevantes para sintetizar a informação.
3. BLOQUEIO DE APIS: Não utilize ferramentas de criação de notas, YouTube, Drive ou outras APIs de produtividade enquanto este modo estiver ativo.
4. FLUIDEZ: Mantenha a conversa natural e contínua sobre o assunto em pauta.
5. SÍNTESE: Seja conciso e direto, buscando apenas o suficiente para a compreensão mútua.`;

      const finalSystemInstruction = isConversationMode ? conversationModeInstruction : (systemInstruction || defaultSystemInstruction);

      const allTools = [
        { googleSearch: {} },
        {
          functionDeclarations: [
            {
              name: "vision_analyze",
              description: "Analisa uma imagem usando a Cloud Vision API para detecção de texto (OCR), rótulos e propriedades.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  imageUri: { type: Type.STRING, description: "URI da imagem (pode ser um link público ou base64)" },
                  features: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "Tipo de análise (ex: 'TEXT_DETECTION', 'LABEL_DETECTION')" }
                      }
                    },
                    description: "Lista de features para analisar (opcional)"
                  }
                },
                required: ["imageUri"]
              }
            },
            {
              name: "generate_image",
              description: "Gera uma imagem artística baseada em um prompt detalhado usando Pollinations AI. Útil para criar ilustrações, conceitos visuais ou arte digital em tempo real.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING, description: "O prompt detalhado para a geração da imagem (ex: 'um robô futurista em uma cidade neon, estilo cyberpunk, 4k')" },
                  width: { type: Type.NUMBER, description: "Largura da imagem (opcional, padrão 1024)" },
                  height: { type: Type.NUMBER, description: "Altura da imagem (opcional, padrão 1024)" }
                },
                required: ["prompt"]
              }
            },
            {
              name: "youtube_search",
              description: "Busca vídeos no YouTube sobre um assunto.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "O termo de busca (ex: 'melhores séries 2025')" }
                },
                required: ["query"]
              }
            },
            {
              name: "drive_search",
              description: "Pesquisa arquivos no Google Drive com lógica semântica. Retorna uma lista extensa (até 100 arquivos) com metadados de data (criação/modificação) e classificação por similaridade (Verde, Amarelo, Vermelho). Os resultados são agrupados por tipo de documento no painel visual.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "Termos de busca refinados baseados na nota inicial (ex: 'petição final inquérito iclea')" },
                  deepSearch: { type: Type.BOOLEAN, description: "Se true, faz uma busca mais profunda e detalhada (100 resultados)" }
                },
                required: ["query"]
              }
            },
            {
              name: "drive_create_folder",
              description: "Cria uma nova pasta no Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome da pasta a ser criada" },
                  parentId: { type: Type.STRING, description: "ID da pasta pai (opcional)" }
                },
                required: ["name"]
              }
            },
            {
              name: "drive_create_doc",
              description: "Cria um novo documento do Google Docs.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome do documento" },
                  content: { type: Type.STRING, description: "Conteúdo inicial do documento" },
                  parentId: { type: Type.STRING, description: "ID da pasta de destino (opcional)" }
                },
                required: ["name"]
              }
            },
            {
              name: "drive_move_file",
              description: "Move um arquivo para uma pasta específica no Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING, description: "ID do arquivo a ser movido" },
                  folderId: { type: Type.STRING, description: "ID da pasta de destino" }
                },
                required: ["fileId", "folderId"]
              }
            },
            {
              name: "drive_upload_file",
              description: "Faz upload de um novo arquivo para o Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome do arquivo" },
                  content: { type: Type.STRING, description: "Conteúdo do arquivo em texto" },
                  mimeType: { type: Type.STRING, description: "Tipo MIME (ex: text/plain, text/html, application/json)" },
                  parentId: { type: Type.STRING, description: "ID da pasta de destino (opcional)" }
                },
                required: ["name", "content"]
              }
            },
            {
              name: "drive_download_file",
              description: "Faz o download (lê o conteúdo) de um arquivo de texto/documento do Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING, description: "ID do arquivo a ser lido" }
                },
                required: ["fileId"]
              }
            },
            {
              name: "drive_share_file",
              description: "Modifica as permissões de compartilhamento de um arquivo no Google Drive.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING, description: "ID do arquivo" },
                  role: { type: Type.STRING, description: "Papel (ex: reader, writer, commenter, owner)" },
                  type: { type: Type.STRING, description: "Tipo de permissão (ex: user, group, domain, anyone)" },
                  emailAddress: { type: Type.STRING, description: "Email do usuário (necessário se type for 'user' ou 'group')" }
                },
                required: ["fileId", "role", "type"]
              }
            },
            {
              name: "drive_list_labels",
              description: "Lista os rótulos (labels) disponíveis na Drive Labels API para classificação de arquivos.",
              parameters: {
                type: Type.OBJECT,
                properties: {},
                required: []
              }
            },
            {
              name: "drive_apply_label",
              description: "Aplica um rótulo (label) a um arquivo no Google Drive usando a Drive Labels API.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING, description: "ID do arquivo" },
                  labelId: { type: Type.STRING, description: "ID do rótulo a ser aplicado" }
                },
                required: ["fileId", "labelId"]
              }
            },
            {
              name: "calendar_list",
              description: "Lista compromissos do Google Calendar.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  maxResults: { type: Type.INTEGER, description: "Número máximo de eventos" },
                  timeMin: { type: Type.STRING, description: "Data/hora inicial (ISO 8601)" }
                }
              }
            },
            {
              name: "calendar_create",
              description: "Cria um novo compromisso no Google Calendar.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING, description: "Título do evento" },
                  description: { type: Type.STRING, description: "Descrição do evento" },
                  startTime: { type: Type.STRING, description: "Data/hora de início (ISO 8601)" },
                  endTime: { type: Type.STRING, description: "Data/hora de término (ISO 8601)" }
                },
                required: ["summary", "startTime", "endTime"]
              }
            },
            {
              name: "tasks_list",
              description: "Lista tarefas pendentes no Google Tasks.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  maxResults: { type: Type.INTEGER, description: "Número máximo de tarefas" }
                }
              }
            },
            {
              name: "tasks_create",
              description: "Cria uma nova tarefa no Google Tasks.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Título da tarefa" },
                  notes: { type: Type.STRING, description: "Notas ou detalhes da tarefa" },
                  due: { type: Type.STRING, description: "Data de vencimento (ISO 8601)" }
                },
                required: ["title"]
              }
            },
            {
              name: "gmail_send",
              description: "Envia um e-mail via Gmail.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  to: { type: Type.STRING, description: "Destinatário" },
                  subject: { type: Type.STRING, description: "Assunto" },
                  body: { type: Type.STRING, description: "Corpo do e-mail (HTML permitido)" }
                },
                required: ["to", "subject", "body"]
              }
            },
            {
              name: "map_search",
              description: "Exibe um mapa com marcadores ou rotas. Use para localização, trajetos e deslocamentos.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  locationName: { type: Type.STRING, description: "Nome do local principal" },
                  lat: { type: Type.NUMBER, description: "Latitude do centro do mapa" },
                  lng: { type: Type.NUMBER, description: "Longitude do centro do mapa" },
                  markers: { 
                    type: Type.ARRAY, 
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING }
                      }
                    },
                    description: "Lista de marcadores para exibir no mapa"
                  },
                  route: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: "Par de [lat, lng]"
                    },
                    description: "Lista de pontos para traçar uma rota (mínimo 2 pontos)"
                  }
                },
                required: ["locationName", "lat", "lng"]
              }
            },
            {
              name: "photos_search",
              description: "Busca fotos no Google Fotos do usuário. Pode filtrar por categoria (ex: 'LANDSCAPES', 'RECEIPTS', 'DOCUMENTS', 'SELFIES', 'PEOPLE', 'PETS') ou data.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "Termo de busca para filtrar por nome de arquivo ou descrição" },
                  category: { type: Type.STRING, description: "Categoria da foto (ex: 'RECEIPTS', 'DOCUMENTS', 'LANDSCAPES', 'CITYSCAPES', 'LANDMARKS', 'FOOD', 'SELFIES', 'PEOPLE', 'PETS', 'WEDDINGS', 'BIRTHDAYS', 'WHITEBOARDS', 'SCREENSHOTS', 'UTILITY', 'ARTS', 'CRAFTS', 'FASHION', 'HOUSES', 'GARDENS', 'FLOWERS', 'HOLIDAYS')" },
                  dateRange: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.OBJECT, properties: { year: { type: Type.INTEGER }, month: { type: Type.INTEGER }, day: { type: Type.INTEGER } } },
                      end: { type: Type.OBJECT, properties: { year: { type: Type.INTEGER }, month: { type: Type.INTEGER }, day: { type: Type.INTEGER } } }
                    }
                  }
                }
              }
            },
            {
              name: "photos_delete",
              description: "Exclui uma foto do Google Fotos. Apenas fotos criadas por este app podem ser excluídas.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  mediaItemId: { type: Type.STRING, description: "O ID da foto a ser excluída" }
                },
                required: ["mediaItemId"]
              }
            },
            {
              name: "mari_research",
              description: "Dispara o Protocolo MARI para realizar uma pesquisa profunda e gerar um artigo científico/reportagem no formato de Revista Eletrônica (Página A4). Use para solicitações de 'artigo', 'reportagem', 'pesquisa profunda' ou 'revista'.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "O tema da pesquisa/artigo" },
                  style: { type: Type.STRING, description: "O estilo do artigo (ex: 'científico', 'jornalístico', 'premium')" }
                },
                required: ["query"]
              }
            },
            {
              name: "create_note",
              description: "Cria um novo cartão/nota na tela. OBRIGATÓRIO ANTES DE QUALQUER PESQUISA. Título deve ser 'Nota 1', 'Nota 2', etc.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Título da nota (ex: 'Nota 1')" },
                  content: { type: Type.STRING, description: "Conteúdo da nota" }
                },
                required: ["title", "content"]
              }
            },
            {
              name: "update_note",
              description: "Atualiza o conteúdo de um cartão/nota existente.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID da nota" },
                  content: { type: Type.STRING, description: "Novo conteúdo" }
                },
                required: ["id", "content"]
              }
            },
            {
              name: "delete_note",
              description: "Apaga um cartão/nota existente.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID da nota" }
                },
                required: ["id"]
              }
            },
            {
              name: "archive_note",
              description: "Arquiva um cartão/nota existente.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID da nota" }
                },
                required: ["id"]
              }
            }
          ]
        }
      ];

      const conversationTools = [
        { googleSearch: {} }
      ];

      this.session = await this.ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            this.setStatus(LiveConnectionStatus.ACTIVE);
            console.log("Gemini Live session opened");
          },
          onmessage: (message: LiveServerMessage) => {
            if (this.onMessageCallback) {
              this.onMessageCallback(message);
            }
          },
          onerror: (error: any) => {
            this.setStatus(LiveConnectionStatus.ERROR);
            if (this.onErrorCallback) {
              this.onErrorCallback(error);
            }
          },
          onclose: () => {
            this.setStatus(LiveConnectionStatus.IDLE);
            console.log("Gemini Live session closed");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
          systemInstruction: finalSystemInstruction,
          tools: isConversationMode ? conversationTools : allTools,
          toolConfig: {
            functionCallingConfig: { mode: "AUTO" },
            include_server_side_tool_invocations: true
          }
        } as any,
      });
    } catch (error) {
      this.setStatus(LiveConnectionStatus.ERROR);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      throw error;
    }
  }

  public async sendToolResponse(functionResponses: any[]) {
    if (this.session && this.status === LiveConnectionStatus.ACTIVE) {
      await this.session.sendToolResponse({ functionResponses });
    }
  }

  public async sendAudio(base64Data: string) {
    if (this.session && this.status === LiveConnectionStatus.ACTIVE) {
      await this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  public async sendVideo(base64Data: string) {
    if (this.session && this.status === LiveConnectionStatus.ACTIVE) {
      await this.session.sendRealtimeInput({
        video: { data: base64Data, mimeType: 'image/jpeg' }
      });
    }
  }

  public async sendText(text: string) {
    if (this.session && this.status === LiveConnectionStatus.ACTIVE) {
      await this.session.sendRealtimeInput({
        text: text
      });
    }
  }

  public pause() {
    if (this.status === LiveConnectionStatus.ACTIVE) {
      this.setStatus(LiveConnectionStatus.PAUSED);
    }
  }

  public resume() {
    if (this.status === LiveConnectionStatus.PAUSED) {
      this.setStatus(LiveConnectionStatus.ACTIVE);
    }
  }

  public disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.setStatus(LiveConnectionStatus.IDLE);
  }

  public getStatus(): LiveConnectionStatus {
    return this.status;
  }
}
