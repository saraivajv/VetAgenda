# VetAgenda - Sistema de Gestão Veterinária

O **VetAgenda** é um sistema web responsivo e moderno para clínicas veterinárias que atende tanto a equipe médica quanto os tutores dos animais. Esta versão foi convertida em uma Single Page Application (SPA) para garantir máxima fluidez de navegação e persistência de dados.

---

## 🚀 Funcionalidades Principais

1. **Tela de Login com Perfis**:
   - Acesso simulado rápido para testar os diferentes fluxos da aplicação.
   - Perfis pré-definidos: **Dr. Silva (Veterinário)** e **Carlos Mendes (Tutor)**.
   
2. **Painel Dinâmico (Dashboard)**:
   - Exibição de estatísticas e listagens inteligentes que se adaptam ao perfil logado.
   - **Visão Veterinário**: Consultas do dia, total de pacientes, consultas aguardando confirmação e ações rápidas (confirmar, cancelar, finalizar atendimento).
   - **Visão Tutor**: Pets cadastrados, total de consultas ativas, data da última vacinação e histórico de agendamentos.

3. **Agenda Clínica Completa** *(Apenas para equipe clínica/Vets)*:
   - Calendário compacto lateral totalmente interativo. Dias com consultas possuem um indicador verde.
   - Filtros dinâmicos por Veterinário Responsável e por Status da Consulta (Aguardando, Confirmado, Concluído, Cancelado).
   - Tabela de consultas diárias com botões de ação integrados.

4. **Marcação de Consulta (Selects Encadeados)**:
   - Escolha do Pet (Tutor vê apenas seus animais; Veterinário vê todos).
   - Filtro inteligente de Veterinário de acordo com a Especialidade Médica selecionada.
   - Calendário para seleção de data (bloqueia datas retroativas).
   - Grade de horários com **verificação de disponibilidade**: se o veterinário já possuir consulta agendada naquela data e horário (ou se o horário já passou hoje), o slot fica indisponível para seleção.
   - Card lateral com o resumo dinâmico e interativo do agendamento em tempo real.

5. **Tela de Confirmação**:
   - Feedback visual moderno com animação de sucesso.
   - Resumo completo da consulta (nome do animal, data, horário, médico, status).

6. **Pacientes & Ficha Clínica (Histórico do Pet)**:
   - Lista lateral dos pets cadastrados (filtrável com busca em tempo real).
   - Ficha com detalhes vitais (idade, peso, tutor, alergias).
   - Linha do tempo clínica contendo o histórico detalhado de consultas anteriores, vacinas, exames e procedimentos.
   - **Formulário de Cadastro de Pets**: Permite que tutores e veterinários cadastrem novos animais que serão salvos no sistema.
   - **Evolução Clínica** *(Apenas para Veterinários)*: Formulário no rodapé da ficha para que Dr. Silva adicione novas observações clínicas, vacinas ou prescrições diretamente no prontuário do pet.

---

## 🛠️ Como Executar o Projeto

Como o VetAgenda é desenvolvido inteiramente com tecnologias web nativas (HTML5, Vanilla CSS3 e Vanilla JS), **não é necessária nenhuma etapa de build ou compilação**.

Você pode rodar o projeto de três formas simples:

### Opção 1: Servidor Local Python (Recomendado)
Se você tiver o Python instalado em sua máquina, execute o comando abaixo no terminal na pasta raiz do projeto:
```bash
python3 -m http.server 8000
```
Em seguida, abra o seu navegador e acesse: [http://localhost:8000](http://localhost:8000)

### Opção 2: VS Code Live Server
Se você utiliza o **Visual Studio Code**, basta instalar a extensão **Live Server**, abrir o arquivo `index.html` e clicar em **"Go Live"** no canto inferior direito do editor.

### Opção 3: Executar Diretamente no Navegador
Você também pode simplesmente dar um duplo clique no arquivo `index.html` ou arrastá-lo para a janela de qualquer navegador (Chrome, Safari, Edge, Firefox).

---

## 🔑 Credenciais para Teste Rápido

Para facilitar a navegação no sistema, a tela de login possui dois botões de **Acesso Rápido** que preenchem e autenticam os perfis automaticamente:

* **Veterinário (Dr. Silva)**:
  - E-mail: `dr.silva@vetagenda.com`
  - Senha: `123` (ou qualquer senha)
  - Permissões: Visualiza a agenda geral da clínica, gerencia todas as consultas de hoje, acessa todas as fichas de pacientes e adiciona evoluções/prontuários clínicos no histórico de qualquer pet.

* **Tutor (Carlos Mendes)**:
  - E-mail: `carlos@vetagenda.com`
  - Senha: `123` (ou qualquer senha)
  - Permissões: Gerencia seus próprios pets (Rex, Luna, Pipoca), cadastra novos pets, marca novas consultas com selects inteligentes e acompanha o status de seus agendamentos.

---

## 💾 Persistência de Dados

O aplicativo utiliza o **`localStorage`** do navegador. Isso significa que:
* Qualquer nova consulta criada
* Qualquer alteração de status de agendamento (Confirmar/Cancelar/Concluir)
* Qualquer prontuário clínico adicionado
* Qualquer novo pet cadastrado

Será persistido mesmo se você atualizar a página ou fechar o navegador!
