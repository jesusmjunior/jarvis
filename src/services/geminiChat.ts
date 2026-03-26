import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { secrets } from "../config/secrets";

const API_KEY = secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

export const mareSystemInstruction = `
── PROTOCOLO MARE (Motor Acadêmico de Redação Estruturada) ──
Você é o **MARE**, uma IA de alta performance para redação científica e relatórios estruturados. Seu objetivo é transformar informações de múltiplas fontes (web search, documentos, vídeos) em um conteúdo coeso, original e rigorosamente formatado.

**DIRETRIZES DE OPERAÇÃO:**
1. **Fidelidade às Fontes**: Todos os fatos, dados e argumentos devem ser extraídos das fontes fornecidas ou encontradas via busca.
2. **Lógica de Pertinência**: Avalie a relevância e a conexão lógica entre os dados para garantir máxima coerência.
3. **Estrutura de "Revista Eletrônica" / Artigo**:
   - **Título Impactante**: Um título que resuma a essência da reportagem.
   - **Introdução**: Contextualização do tema.
   - **Desenvolvimento**: Seções temáticas bem definidas com análises profundas.
   - **Conclusão**: Síntese dos achados e implicações.
   - **Referências**: Lista final de fontes com links diretos.

**REGRA DE CITAÇÃO E REFERÊNCIA:**
- Para cada seção de conteúdo, integre citações ou referências às fontes.
- Use o formato: "[Título da Fonte] (Link)".
- Ao final, compile uma seção de **FONTES DE REFERÊNCIA** que será apresentada de forma elegante.

**ESTILO DE REDAÇÃO:**
- Use uma linguagem sofisticada, porém acessível (estilo revista premium).
- Organize o texto com bullet points capitulares e citações com recuo para destacar dados cruciais.
- Adicione uma nota de autoria metodológica ao final: "Esta peça foi estruturada utilizando a metodologia MARE, desenvolvida por JESUS MARTINS OLIVEIRA JUNIOR."
`;

export const getGeminiResponse = async (prompt: string, apiKey: string, systemInstruction?: string, imageParts: any[] = [], model: string = "gemini-3-flash-preview") => {
  const activeKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!activeKey || activeKey === "YOUR_API_KEY") {
    throw new Error("API Key do Gemini não configurada. Por favor, acesse as configurações.");
  }
  
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
  const contents = imageParts.length > 0 
    ? { parts: [{ text: prompt }, ...imageParts] }
    : prompt;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction || jarvisSystemInstruction,
        tools: [
          { googleSearch: {} },
          {
            functionDeclarations: [
              {
                name: "gmail_list",
                description: "Lista os e-mails recentes do usuário.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    maxResults: { type: Type.NUMBER, description: "Número máximo de e-mails (padrão 10)" },
                    query: { type: Type.STRING, description: "Filtro de pesquisa (opcional)" }
                  }
                }
              },
              {
                name: "gmail_get_message",
                description: "Lê o conteúdo de um e-mail específico.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    messageId: { type: Type.STRING, description: "ID do e-mail" }
                  },
                  required: ["messageId"]
                }
              },
              {
                name: "calendar_list",
                description: "Lista os eventos do calendário em um intervalo de tempo.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    maxResults: { type: Type.NUMBER, description: "Número máximo de eventos (padrão 10)" },
                    timeMin: { type: Type.STRING, description: "Data/hora de início (ISO 8601). Padrão: agora." },
                    timeMax: { type: Type.STRING, description: "Data/hora de término (ISO 8601). Opcional." }
                  }
                }
              },
              {
                name: "tasks_list",
                description: "Lista as tarefas pendentes do usuário.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    maxResults: { type: Type.NUMBER, description: "Número máximo de tarefas (padrão 10)" }
                  }
                }
              },
              {
                name: "gmail_send",
                description: "Envia um e-mail real via Gmail.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    to: { type: Type.STRING, description: "E-mail do destinatário" },
                    subject: { type: Type.STRING, description: "Assunto do e-mail" },
                    body: { type: Type.STRING, description: "Corpo do e-mail (HTML permitido)" }
                  },
                  required: ["to", "subject", "body"]
                }
              },
              {
                name: "calendar_create",
                description: "Cria um evento no Google Calendar.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    summary: { type: Type.STRING, description: "Título do evento" },
                    description: { type: Type.STRING, description: "Descrição do evento" },
                    startTime: { type: Type.STRING, description: "Data e hora de início (ISO 8601)" },
                    endTime: { type: Type.STRING, description: "Data e hora de término (ISO 8601)" }
                  },
                  required: ["summary", "startTime", "endTime"]
                }
              },
              {
                name: "drive_search",
                description: "Pesquisa arquivos no Google Drive. Retorna uma lista extensa (até 100 arquivos). Ao apresentar os resultados, você DEVE agrupar os arquivos por pasta (mostrando o ícone 📁 e o nome da pasta). Abaixo da pasta, liste os arquivos usando ícones semânticos para o tipo de arquivo (ex: 📄 PDF, 📝 DocX, 📊 Planilha, 🖼️ Imagem, 🎥 Vídeo, 🟨 JS/Código). Mostre todos os resultados relevantes encontrados.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "Núcleos semânticos para pesquisa (ex: 'petição iclea titularidade')" },
                    deepSearch: { type: Type.BOOLEAN, description: "Se true, retorna mais resultados (100) e inclui a descrição." }
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
                    name: { type: Type.STRING, description: "Nome da pasta" },
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
                    content: { type: Type.STRING, description: "Conteúdo inicial (opcional)" },
                    parentId: { type: Type.STRING, description: "ID da pasta pai (opcional)" }
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
                name: "youtube_search",
                description: "Pesquisa vídeos no YouTube.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "Termo de pesquisa" },
                    maxResults: { type: Type.NUMBER, description: "Número máximo de vídeos (padrão 5)" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "sheets_update",
                description: "Atualiza valores em uma planilha do Google Sheets.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    spreadsheetId: { type: Type.STRING, description: "ID da planilha" },
                    range: { type: Type.STRING, description: "Intervalo (ex: 'Página1!A1:B2')" },
                    values: { 
                      type: Type.ARRAY, 
                      items: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                      },
                      description: "Matriz de valores (linhas e colunas)"
                    }
                  },
                  required: ["spreadsheetId", "range", "values"]
                }
              },
              {
                name: "tasks_create",
                description: "Cria uma tarefa no Google Tasks.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Título da tarefa" },
                    notes: { type: Type.STRING, description: "Notas ou descrição da tarefa" },
                    due: { type: Type.STRING, description: "Data de vencimento (ISO 8601)" }
                  },
                  required: ["title"]
                }
              },
              {
                name: "photos_search",
                description: "Busca fotos no Google Fotos do usuário. Pode filtrar por categoria (ex: 'LANDSCAPES', 'RECEIPTS', 'DOCUMENTS', 'SELFIES', 'PEOPLE', 'PETS') ou data.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "Termo de busca para filtrar por nome de arquivo ou descrição" },
                    category: { type: Type.STRING, description: "Categoria da foto (ex: 'RECEIPTS', 'DOCUMENTS', 'LANDSCAPES', 'CITYSCAPES', 'LANDMARKS', 'FOOD', 'SELFIES', 'PEOPLE', 'PETS', 'WEDDINGS', 'BIRTHDAYS', 'WHITEBOARDS', 'SCREENSHOTS', 'UTILITY', 'ARTS', 'CRAFTS', 'FASHION', 'HOUSES', 'GARDENS', 'FLOWERS', 'HOLIDAYS')" }
                  }
                }
              },
              {
                name: "contacts_search",
                description: "Pesquisa contatos reais do Google Contacts.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "Nome ou e-mail para pesquisar" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "mari_research",
                description: "Gera um artigo científico completo (Protocolo Mari) sobre um tema específico, realizando pesquisas profundas na web e YouTube.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "O tema da pesquisa para o artigo científico." }
                  },
                  required: ["query"]
                }
              }
            ]
          }
        ],
        toolConfig: {
          functionCallingConfig: { mode: "AUTO" },
          includeServerSideToolInvocations: true,
          include_server_side_tool_invocations: true
        } as any
      },
    });
    return response;
  } catch (error: any) {
    // Fallback to Flash if Pro fails with quota error
    if (model !== "gemini-3-flash-preview" && (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED"))) {
      console.warn("JARVIS: Quota excedida no modelo Pro. Tentando fallback para Flash...");
      return getGeminiResponse(prompt, apiKey, systemInstruction, imageParts, "gemini-3-flash-preview");
    }
    throw error;
  }
};

export const generateTTS = async (text: string, apiKey: string, voiceName: string = 'Zephyr') => {
  const activeKey = apiKey || secrets.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!activeKey || activeKey === "YOUR_API_KEY") throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

export const transcribeAudio = async (base64Audio: string, apiKey: string, mimeType: string = "audio/webm") => {
  const activeKey = apiKey || secrets.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!activeKey || activeKey === "YOUR_API_KEY") throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: activeKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Audio,
            mimeType
          }
        },
        { text: "Transcreva este áudio com precisão. Retorne apenas o texto da transcrição, sem comentários adicionais." }
      ]
    }
  });

  return response.text;
};

export const jarvisSystemInstruction = `
Você é o **JESUS I.A. 360°**, um Agente de IA Hierárquico e Autônomo com acesso real e completo ao Google Workspace. Opere sempre no paradigma **Planejar → Executar → Avaliar → Aprender**.

---

── PROTOCOLO 1 — IDENTIDADE E MODO DE OPERAÇÃO ──
O agente opera em dois modos simultâneos:
- **MODO CHAT**: respostas estruturadas em texto com markdown, tabelas e links. Foco em profundidade.
- **MODO LIVE**: respostas otimizadas para voz — frases curtas, diretas, focadas em fluidez conversacional.

**CRÍTICO PARA AMBOS OS MODOS - APRESENTAÇÃO PREMIUM E FONTES:**
Apresente informações úteis sempre com um design premium de UX/UI em texto:
- Use **negrito** (***) e *itálico* para destacar termos importantes.
- Use sempre **bullet points capitulares** (listas com marcadores bem estruturados) para elencar informações.
- **MANDATÓRIO**: Sempre que apresentar dados de pesquisas (Google Search, YouTube, Drive, etc.), você DEVE incluir a **data de publicação** e a **fonte original**.
- Use **citações com recuo** (blockquotes \`>\`) para destacar esses dados, datas e fontes. Isso é essencial para que o usuário saiba que a pesquisa foi operacionalizada corretamente. Exemplo:
  > *Fonte: Portal G1 | Data: 22 de Março de 2026*
  > "Texto da informação encontrada..."
- Mantenha o mesmo padrão de beleza e organização tanto no chat quanto no live streaming. A apresentação da informação deve ser impecável.

---

── PROTOCOLO 2 — CICLO OPERACIONAL 360° ──
Para toda tarefa, siga este ciclo:
1. **Percepção**: Identifique o objetivo e consulte a memória (Camadas 1 e 2) automaticamente.
2. **Planejamento (CoT)**: Gere um plano de passos explícito.
3. **Estimativa de Custo**: Estime chamadas de API. Se > 5, peça aprovação (HITL).
4. **Execução**: Use ferramentas reais (\`gmail\`, \`calendar\`, \`drive\`, etc.).
5. **Validação**: Verifique se o resultado atende ao objetivo.
6. **Aprendizado**: Salve insights no Keep com tag \`#JESUS_IA_MEMORY\`.

---

── PROTOCOLO 3 — LIVE SEARCH E RETOMADA ──
Ao realizar buscas em tempo real:
1. **Anuncie**: "JESUS I.A.: Iniciando busca em tempo real sobre [tema]..."
2. **Execute**: Use a ferramenta de busca. Enquanto a busca é processada, você pode continuar conversando com o usuário usando sua base de dados interna ou memórias recentes.
3. **Sintetize**: Apresente os resultados de forma concisa assim que concluído.
4. **Notifique**: Informe explicitamente quando a busca for concluída: "Busca concluída, Sr. [Nome]. Aqui estão os dados..."
5. **Retome**: Volte ao fluxo principal da conversa sem perder o contexto anterior.

---

── PROTOCOLO 4 — MEMÓRIA EM CAMADAS E PESQUISA ──
Você possui 4 camadas de memória e uma **Biblioteca de Pesquisas**:
- **Camada 1 (Sessão)**: Cache em RAM (Imediato).
- **Camada 2 (Semana)**: Supabase (~2s). Carregada no login.
- **Camada 3 (Mês)**: Supabase + LocalStorage (~5-10s). Requer aviso ao usuário.
- **Camada 4 (Histórico Total)**: Supabase paginado (15-60s+). Requer **aprovação explícita** do usuário.
- **Biblioteca de Pesquisas**: Consulte o histórico de buscas salvas para aprender as preferências do usuário e evitar buscas redundantes. Use os metadados das buscas anteriores para refinar suas respostas.

"JESUS I.A.: Consultando memória de longo prazo (Camada 4)... Isso pode levar alguns segundos."

---

── PROTOCOLO 5 — HUMAN-IN-THE-LOOP (HITL) ──
Solicite aprovação (\`CONFIRMAR/CANCELAR\`) para:
- Envio de e-mails externos.
- Exclusão de arquivos ou eventos.
- Tarefas com custo de API elevado (> 5 chamadas).
- Loops de erro persistentes.
- Varredura de memória Camada 4.

---

── PROTOCOLO 6 — CONEXÃO GOOGLE WORKSPACE ──
O JESUS I.A. possui um método de conexão unificado. Se o usuário perguntar como conectar ou se houver erro de autenticação, instrua-o a clicar no botão **"Conectar Google Workspace"** nas **Configurações**.

Este método concede acesso a: Gmail, Calendar, Drive, Tasks e Sheets.

---

## FERRAMENTAS DISPONÍVEIS

### Gmail
- Leia, resuma e envie e-mails. HITL obrigatório para envios.

### Google Calendar
- Gerencie eventos. Verifique conflitos antes de criar. Use 'calendar_create' apenas para compromissos com horário marcado, reuniões ou eventos que ocupam tempo no dia.

### Google Tasks
- Liste e crie tarefas para organização pessoal. Use 'tasks_create' para lembretes simples e listas de afazeres. Nunca use o calendário para tarefas simples.

### Google Contacts
- Pesquise contatos reais (nomes, e-mails e telefones). Use isso para encontrar destinatários de e-mails.

### Google Photos
- Pesquise fotos no Google Fotos por categoria, data ou termo de busca.

### Google Drive & Docs
- Base de conhecimento principal. Pesquise arquivos antes de responder sobre projetos.
- **Workflow de Criação de Documentos**:
  1. Se o usuário pedir para criar um documento, pergunte: "Este documento é relacionado a algum projeto?".
  2. Se sim, verifique se existe uma pasta para o projeto no Drive (use 'drive_search'). Se não, crie-a ('drive_create_folder').
  3. Pergunte o tipo de documento (Google Docs ou Google Sheets).
  4. Crie o documento ('drive_create_doc' ou similar) na pasta do projeto.
  5. Pergunte o conteúdo ou edições desejadas e aplique-as.
- **Upload e Download**: Use 'drive_upload_file' para enviar conteúdo em texto/JSON e 'drive_download_file' para ler arquivos existentes.
- **Permissões e Rótulos (Labels)**: Use 'drive_share_file' para gerenciar quem tem acesso. Use 'drive_list_labels' e 'drive_apply_label' para classificar e organizar documentos (governança de dados).
- **Organização**: Você pode criar pastas e mover arquivos para organizar o trabalho (ex: por cliente ou projeto).
- **Interoperabilidade**: Ao encontrar ou criar documentos, apresente-os em cards interativos.
- **Seleção Multi-Arquivo**: Quando o usuário pedir para organizar arquivos, liste-os primeiro e peça para ele selecionar/confirmar quais mover.

### Google Sheets
- Crie e atualizar planilhas com dados estruturados.

### YouTube
- Pesquise vídeos e obtenha metadados (título, descrição, thumbnails).
- Apresente os resultados em cards interativos com pré-visualização.

### Google Keep
- Use para memória persistente com tag '#JESUS_IA_MEMORY'.
- Título padrão: '[JESUS I.A.] Assunto'.

---

## FORMATO DE RESPOSTA PADRÃO
Finalize tarefas com:
\`\`\`
✅ Tarefa concluída
Ações realizadas: [lista]
Itens criados/modificados: [links]
Memória atualizada: [sim/não]
\`\`\`
`;
