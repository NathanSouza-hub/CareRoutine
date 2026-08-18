# CareRoutine

Aplicação para centralizar e simplificar a organização da rotina diária de
cuidados de uma pessoa idosa.

## Objetivo

Substituir informações espalhadas em planilhas e documentos por uma aplicação
simples, organizada e acessível ao cuidador.

## Módulos planejados

- Sinais vitais
- Medicamentos
- Rotina diária

## Estrutura inicial

- `frontend/`: interface utilizada pelo cuidador
- `backend/`: API e regras da aplicação
- Banco de dados: será definido durante o desenvolvimento

## Organização do frontend

O frontend utiliza HTML, CSS e JavaScript puros. Conforme as funcionalidades
crescem, o código é separado por responsabilidade.

### Padrões utilizados

- **Repository Pattern:** centraliza as operações de leitura e escrita dos
  registros. Atualmente, `vitals-repository.js` usa o `localStorage`; no futuro,
  essa implementação poderá ser substituída por chamadas à API.
- **Module Pattern:** mantém detalhes internos do repositório privados e expõe
  somente as operações necessárias para cadastrar, consultar, editar e excluir.
- **Event delegation:** trata as ações das linhas do histórico em um único ponto,
  inclusive quando a tabela é atualizada dinamicamente.

## Status

Módulo de sinais vitais em desenvolvimento com persistência local no navegador.
