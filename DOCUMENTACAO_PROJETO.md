# Documentacao do Projeto

## 1. O que e este projeto

Este projeto e um sistema de atendimento automatico para academias, studios e negocios fitness.

A ideia principal e permitir que alunos e clientes conversem com a academia por canais como WhatsApp, Instagram, Messenger, TikTok ou site, recebam respostas inteligentes, tirem duvidas, agendem aulas, confirmem pagamentos e, quando necessario, sejam transferidos para um atendente humano.

O bot principal se chama Sofia, mas esse nome pode ser personalizado para cada cliente.

## 2. Qual problema ele resolve

Academias e studios costumam receber muitas mensagens repetidas todos os dias:

- horarios de aula;
- valores;
- disponibilidade de professores;
- agendamento, reagendamento e cancelamento;
- confirmacao de pagamento;
- duvidas sobre planos;
- pedidos que precisam ir para atendimento humano.

Sem automacao, isso toma tempo da equipe e pode gerar atrasos, esquecimentos ou respostas inconsistentes.

Este sistema centraliza esse atendimento e usa inteligencia artificial para responder de forma natural, mantendo historico, contexto e regras de negocio.

## 3. Como funciona na pratica

O cliente manda uma mensagem por um canal, por exemplo WhatsApp.

Essa mensagem entra no Chatwoot, que organiza as conversas e permite atendimento humano quando necessario.

Depois, a mensagem passa por um gateway que transforma o conteudo recebido em um formato padrao. Assim, o sistema consegue tratar mensagens vindas de canais diferentes do mesmo jeito.

Em seguida, o motor de IA interpreta a mensagem, consulta a base de conhecimento da academia, entende a intencao do cliente e decide o que fazer:

- responder uma duvida;
- buscar horarios disponiveis;
- iniciar um agendamento;
- cancelar ou remarcar uma aula;
- criar uma cobranca;
- transferir para um atendente humano.

Todas as acoes importantes ficam registradas em banco de dados para auditoria e acompanhamento.

## 4. Principais partes do sistema

### Canais de atendimento

O sistema foi pensado para receber mensagens de varios canais:

- WhatsApp;
- Instagram;
- Messenger;
- TikTok;
- site.

No primeiro marco, o foco principal e WhatsApp integrado ao Chatwoot.

### Chatwoot

O Chatwoot funciona como central de conversas.

Ele permite acompanhar os atendimentos, transferir uma conversa do bot para uma pessoa e depois devolver o atendimento para o bot com o contexto preservado.

### Motor de inteligencia artificial

O motor de IA e responsavel por entender o que o cliente quer.

Ele usa:

- historico recente da conversa;
- estado atual do atendimento;
- lista de profissionais;
- servicos disponiveis;
- horarios disponiveis;
- base de conhecimento da academia.

O objetivo e evitar respostas genericas e repetidas. O bot precisa lembrar o que o cliente ja informou, como nome do professor, modalidade e horario desejado.

### RAG e base de conhecimento

RAG e o mecanismo que permite ao bot consultar informacoes da academia antes de responder.

Neste projeto, a fonte de conteudo vem do Notion. O sistema sincroniza esse conteudo, divide em partes menores, gera embeddings e salva no banco com pgvector.

Assim, quando o aluno pergunta algo como "qual o horario do pilates?", o bot pode buscar informacoes reais na base antes de responder.

### Agenda

O modulo de agenda permite:

- agendar aulas ou sessoes;
- reagendar;
- cancelar;
- consultar horarios;
- verificar disponibilidade;
- sincronizar com Google Calendar;
- validar elegibilidade do cliente no Nexfit.

O sistema deve sempre confirmar disponibilidade antes de criar um agendamento, para evitar duplicidade ou conflito de horario.

### Pagamentos

O modulo de pagamentos usa a API do Asaas.

Depois de um agendamento, o sistema pode criar uma cobranca, acompanhar a confirmacao de pagamento por webhook e atualizar o status no banco.

### Auditoria, erros e alertas

O sistema registra eventos importantes para facilitar suporte e investigacao.

Existem tabelas para:

- auditoria de alteracoes;
- fila de erros;
- incidentes;
- tentativas de reprocessamento.

Quando algum servico externo falha, como Google Calendar, Asaas ou Chatwoot, o erro deve ser registrado e enviado para uma fila de tratamento.

## 5. Painel administrativo

O projeto tambem inclui um painel admin.

Esse painel e usado pelo operador ou desenvolvedor para configurar cada academia ou studio atendido pelo sistema.

No painel e possivel gerenciar:

- clientes/tenants;
- nome do bot;
- nome do studio;
- tom de comunicacao;
- mensagens padrao;
- profissionais;
- apelidos dos profissionais;
- especialidades;
- servicos;
- horarios de funcionamento;
- integracoes;
- fila de erros;
- auditoria.

Cada academia e tratada como um tenant. Isso permite que o mesmo sistema atenda varios clientes, cada um com suas proprias configuracoes.

## 6. Conceito de multi-tenancy

Multi-tenancy significa que o sistema pode atender varios clientes diferentes usando a mesma base de codigo.

Exemplo:

- Studio Fit SP;
- Academia Zona Norte;
- Pilates Central.

Cada um pode ter:

- seu proprio nome de bot;
- seus proprios profissionais;
- seus proprios horarios;
- suas proprias chaves de integracao;
- sua propria base de conhecimento;
- seus proprios usuarios no painel.

Isso permite escalar o produto sem precisar criar um sistema separado para cada cliente.

## 7. Como o bot deve se comportar

O bot deve falar como uma pessoa que trabalha na academia, nao como um robo.

Regras importantes:

- responder em portugues brasileiro natural;
- escrever mensagens curtas;
- fazer apenas uma pergunta por mensagem;
- nao pedir de novo informacoes que o cliente ja deu;
- nao inventar horarios;
- confirmar profissional, modalidade e horario antes de agendar;
- transferir para humano quando o cliente estiver frustrado;
- preservar o contexto depois de um atendimento humano.

Exemplo:

Cliente: "Quero marcar pilates com a Ana amanha"

Resposta esperada:

"Boa, a Ana tem pilates sim. Tenho esses horarios:
1. 08:00
2. 10:30
3. 15:00"

O bot nao deve responder algo generico como:

"Por favor informe qual servico deseja agendar."

## 8. Dados principais do sistema

O banco de dados guarda informacoes como:

- clientes;
- conversas;
- mensagens;
- agendamentos;
- pagamentos;
- logs de auditoria;
- erros;
- incidentes;
- tenants;
- configuracoes por tenant;
- profissionais;
- servicos.

Um ponto importante e a deduplicacao de clientes. O telefone normalizado deve ser usado como chave principal para evitar criar o mesmo cliente varias vezes.

## 9. Marcos de entrega

O projeto esta dividido em quatro marcos.

### Marco 1: Nucleo Omnichannel + RAG

Entrega a base do atendimento:

- WhatsApp funcionando;
- Chatwoot integrado;
- identidade do cliente sem duplicidade;
- RAG consultando Notion;
- handoff humano;
- logs e incidentes basicos.

### Marco 2: Motor de Agenda

Entrega a parte de agendamento:

- criar, remarcar, cancelar e consultar agendamentos;
- sincronizar com Google Calendar;
- validar elegibilidade no Nexfit;
- evitar duplicidade com locks e idempotencia;
- registrar auditoria.

### Marco 3: Canais expandidos, pagamentos e automacoes

Expande o produto:

- Instagram;
- Messenger;
- TikTok;
- site;
- pagamentos via Asaas;
- lembretes automaticos;
- recuperacao de falhas pela fila de erros.

### Marco 4: Producao com clientes piloto

Leva o sistema para uso real com clientes piloto:

- implantacao em 2 clientes;
- monitoramento assistido;
- alertas de desconexao;
- jornada completa validada;
- estabilidade em producao.

## 10. Integracoes externas

O sistema depende de algumas integracoes:

- Supabase: banco de dados e autenticacao;
- OpenAI: inteligencia artificial e embeddings;
- Notion: base de conhecimento;
- Evolution API: WhatsApp;
- Chatwoot: central de atendimento;
- Google Calendar: agenda;
- Nexfit: elegibilidade do aluno;
- Asaas: cobrancas e pagamentos;
- Telegram e e-mail: alertas.

As chaves dessas integracoes devem ser configuradas por variaveis de ambiente ou por configuracoes protegidas no painel.

## 11. Regras importantes de seguranca e consistencia

O sistema deve seguir algumas regras em todos os modulos:

- nunca duplicar cliente se o telefone ja existir;
- nunca processar o mesmo webhook duas vezes;
- nunca confirmar agendamento sem verificar disponibilidade;
- nunca mostrar chaves sensiveis completas no painel;
- registrar erros importantes;
- enviar falhas para a fila de erros;
- manter historico e contexto da conversa;
- usar feature flags para canais ainda nao validados.

## 12. Resumo em uma frase

Este projeto e uma plataforma de atendimento omnichannel com IA para academias e studios, capaz de responder clientes, consultar uma base de conhecimento, fazer agendamentos, processar pagamentos, transferir para humanos e registrar tudo com seguranca e auditoria.
