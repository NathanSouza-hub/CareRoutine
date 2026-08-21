# Perfis compartilhados, atribuição e tempo real — Design

**Data:** 2026-08-21
**Status:** Fase 1 de 2 (Fase 2 — fluxo de plantão em anotações de enfermagem — fica para depois)

## Contexto e objetivo

Hoje o Lory's Care é single-user: uma conta (`users`, e-mail + senha) é dona de um ou mais
pacientes, e todo dado (sinais vitais, medicamentos, atividades, agenda, anotações) é filtrado
por `patient_id IN (SELECT id FROM patients WHERE user_id = $userId)`.

Uma equipe de 4 a 7 cuidadores vai passar a usar a mesma conta. Precisamos que:

1. Cada cuidador se identifique ao usar o sistema, sem precisar de senha própria (seleção estilo
   Netflix, por avatar).
2. Todo registro criado (sinal vital, dose administrada, atividade concluída, evento da agenda,
   anotação de enfermagem) mostre quem fez e a que horas, ao lado do título — não centralizado.
3. Um cuidador atualizando algo apareça **instantaneamente** na tela dos outros, sem precisar
   recarregar a página.

Fora de escopo nesta fase: o fluxo de plantão (relatório único no início do turno + entradas
rápidas subsequentes em anotações de enfermagem) — é a Fase 2, depende desta base pronta.

## 1. Perfis de cuidador

### Modelo de dados

Nova tabela, **não reaproveitando** o nome "perfil" (já usado pela tela "Meu perfil", que
continua sendo os dados da própria conta: e-mail, senha, telefone, avatar da conta):

```sql
CREATE TABLE caregiver_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_color VARCHAR(20) NOT NULL,   -- ex.: "#2f6f6f", usado no círculo de iniciais
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_caregiver_profiles_user_id ON caregiver_profiles (user_id);
```

Sem senha/PIN — a confiança é a mesma que já existe hoje entre quem tem acesso ao e-mail/senha
da conta. `avatar_color` é suficiente para o grid estilo Netflix (círculo colorido com iniciais,
mesmo padrão visual já usado no `sidebar-user-card__avatar` atual); não precisamos de upload de
imagem por perfil.

`is_active` permite "desativar" um cuidador que saiu da equipe sem apagar o histórico de
registros que ele já fez (mantém a integridade referencial e a atribuição antiga).

### Gestão dos perfis

Tela nova em "Meu perfil" (ou seção própria) para o dono da conta cadastrar/editar/remover
cuidadores: nome + cor do avatar. CRUD simples, mesmo padrão dos outros módulos
(repository → service → controller → routes, `requireAuth` de conta).

### Fluxo de seleção (estilo Netflix)

- Login por e-mail/senha continua igual (`POST /api/auth/login`), emite o JWT de conta como
  hoje.
- Depois do login, se não houver um `caregiver_profiles.id` salvo localmente (ou se o usuário
  clicar em "Trocar cuidador"), mostra uma tela de seleção: grid de avatares com nome embaixo,
  buscados em `GET /api/caregiver-profiles`. Clicar num avatar não faz nenhuma chamada de
  autenticação — só salva o `profileId` escolhido em `localStorage`
  (`loreroutine:profileId`/`loreroutine:profileName`), igual ao padrão já usado para
  `loreroutine:patientId`.
- Esse `profileId` passa a ser enviado em todo request autenticado via header
  `X-Profile-Id`. O backend valida, em cada rota que grava um registro, que o `profileId`
  recebido pertence à conta do JWT (`caregiver_profiles.user_id = req.userId`) antes de usar
  para atribuição — sem isso, ignora/erro 400 (não é uma fronteira de segurança, é
  consistência de dado).
- "Trocar cuidador": botão ao lado do card do usuário na sidebar (onde hoje mostra
  "Cuidador" estático) que limpa o `profileId` salvo e volta pra tela de seleção, sem deslogar
  da conta.
- Se não houver nenhum perfil cadastrado ainda (conta nova), pula a seleção e deixa seguir sem
  atribuição — evita travar quem ainda não migrou para o fluxo de equipe.

## 2. Atribuição ("quem fez")

Adiciona `author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL`
(nullable — perfil pode ser removido sem apagar o histórico) nas tabelas que representam uma
ação pontual de um cuidador:

| Tabela | O que representa a ação |
|---|---|
| `vital_signs` | quem fez a medição |
| `medication_administrations` | quem administrou/marcou a dose |
| `routine_completions` | quem concluiu/marcou a atividade |
| `events` | quem criou o evento (`author_profile_id`) e quem concluiu (`completed_by_profile_id`, mesma FK) |
| `nursing_notes` | quem escreveu a anotação — **substitui** o campo de texto livre `author_name` |

`medications` e `routines` (as tabelas de "plano/tratamento", não de execução) não ganham
atribuição nesta fase — o pedido foi sobre quem *fez o registro*, e o registro relevante ali é a
dose/conclusão, não o cadastro do tratamento. Se fizer falta depois, é uma extensão pequena do
mesmo padrão.

### `nursing_notes.author_name` → `author_profile_id`

O formulário de nova anotação para de pedir o nome do cuidador (campo removido) — passa a usar
automaticamente o `profileId` da sessão. Migração:

- Adiciona `author_profile_id`, nullable.
- Os 6 registros de teste hoje existentes (`author_name` como "jose", "Mauricio" etc., que não
  correspondem a nenhum cuidador real) ficam com `author_profile_id = NULL` e mantêm o
  `author_name` antigo só para exibição histórica (coluna não é removida, vira "nome
  registrado antes dos perfis existirem" — fallback de exibição quando `author_profile_id` for
  nulo).
- Novos registros sempre gravam `author_profile_id`; o backend deixa de aceitar `authorName`
  do corpo da requisição.

### Exibição na UI

Em cada tela (anotações, sinais vitais, medicamentos, atividades, agenda), o nome de quem fez +
horário aparece **ao lado** do título do registro (ex.: badge pequeno "Maria • 14:32" ao lado do
cabeçalho da linha/card), não mais centralizado nem em coluna separada obrigatória. Nas tabelas
que já têm coluna "Cuidador" (é o caso de anotações), a coluna continua existindo, só passa a
ser preenchida automaticamente em vez de digitada.

## 3. Tempo real (Server-Sent Events)

### Por que SSE em vez de WebSocket

Os cuidadores só *recebem* atualizações ao vivo — quem grava continua usando a API REST normal
(POST/PUT/PATCH/DELETE). Não existe necessidade de um canal bidirecional. SSE dá push
servidor→cliente sobre HTTP puro, com reconexão automática nativa do navegador
(`EventSource`), sem novo protocolo nem dependência pesada — muito mais simples de manter que
`ws`/`socket.io` para esse caso de uso.

### Mecanismo

- Novo módulo `src/realtime/change-bus.js`: mantém um `Map<userId, Set<ServerResponse>>` das
  conexões SSE abertas, com `subscribe(userId, res)`, `unsubscribe(userId, res)` e
  `publish(userId, { resource, action })` (ex.: `{ resource: "vitals", action: "created" }`).
  Fica em memória — como o backend hoje roda como processo único, sem cluster/load balancer,
  isso é suficiente; não precisa de Redis pub/sub nesta fase.
- Rota nova `GET /api/stream` (fora do padrão REST dos outros módulos, sem `requireAuth`
  padrão porque `EventSource` não manda headers customizados — o token vem via querystring,
  `?token=...`, validado manualmente com o mesmo `authService.verifyToken`). Mantém a conexão
  aberta, escreve `retry: 3000\n\n` e depois um evento a cada mudança.
- Cada controller, após uma escrita bem-sucedida (create/update/delete/patch de status), chama
  `changeBus.publish(userId, { resource, action })`. É uma linha por handler mutante — não
  precisa mudar os services.
- No frontend, `js/live-updates.js` (novo, carregado em todas as páginas autenticadas) abre um
  `EventSource` para `/api/stream?token=...` uma vez por página, e escuta os eventos. Cada
  página registra quais `resource` lhe interessam (ex.: `sinais-vitais.html` re-executa
  `loadHistory()` quando chega `{resource: "vitals"}`) — reaproveita as funções `load*()` que já
  existem em cada `*.js`, sem duplicar lógica de renderização.
- Reconexão: comportamento padrão do `EventSource` (tenta de novo sozinho); não precisamos de
  lógica extra.

### Escopo do broadcast

`changeBus.publish` é por `userId` (conta), não por `profileId` — todo mundo da mesma conta
recebe todo evento, que é exatamente o comportamento pedido ("todos verem a mesma coisa").

## Migrações necessárias

1. `015_create_caregiver_profiles.sql`
2. `016_add_author_profile_id_to_vital_signs.sql`
3. `017_add_author_profile_id_to_medication_administrations.sql`
4. `018_add_author_profile_id_to_routine_completions.sql`
5. `019_add_profile_ids_to_events.sql` (`author_profile_id` + `completed_by_profile_id`)
6. `020_add_author_profile_id_to_nursing_notes.sql`

## Testes

Seguindo o padrão já usado no backend (`node:test`, mocks de repository):

- `caregiver-profiles-service.test.js`: CRUD, validação de nome, isolamento por conta.
- Para cada service existente (vitals, medications, routines, events, nursing-notes): teste
  novo confirmando que `authorProfileId`/`completedByProfileId` recebido é repassado ao
  repository, e que um `profileId` de outra conta é rejeitado.
- `change-bus.test.js`: publish/subscribe em memória (sem precisar de servidor HTTP real).

## Fora de escopo (Fase 2)

Fluxo de plantão em anotações de enfermagem: primeiro registro do dia/turno pede os dados
completos (data, turno — cuidador já vem do perfil logado), registros seguintes do mesmo
plantão só pedem horário + título/resumo curto, agrupados visualmente sob o mesmo cabeçalho de
plantão. Depende desta Fase 1 estar pronta (identidade do cuidador já resolvida).

## Decisões em aberto para revisão

- Nome da tabela/conceito: "cuidadores" (`caregiver_profiles`) para não colidir com "Meu
  perfil" (dados da conta). Confirmar se o termo em português na UI deve ser "Cuidadores" ou
  outro.
- `avatar_color`: círculo com iniciais, sem upload de foto por cuidador (a conta já tem avatar
  próprio com foto). Confirmar se está ok ou se querem foto por cuidador também.
