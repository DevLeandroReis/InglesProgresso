# Inglês Progresso

Página única (HTML + CSS + JS) para acompanhar seu cronograma diário por 4 meses.

## Recursos
- Tabela com horários e atividades do dia.
- Progresso visual com barras de conclusão para cada atividade.
- Sistema de conquistas baseado em "dias perfeitos" (todas atividades concluídas).
- Clique nos botões "Marcar hoje" para registrar atividades concluídas.
- Salva automaticamente no navegador (localStorage).
- Notificações locais para lembrar dos horários de estudo.
- Permite ajustar a data de início e a duração (padrão: 4 meses).
- Backup automático opcional para arquivo .json no disco (navegadores compatíveis: Chrome/Edge recentes).

## Como usar
1. Abra o arquivo `index.html` no seu navegador (duplo clique ou arraste para a janela do navegador).
2. Ajuste a "Data de início" se quiser começar em outro dia.
3. Clique em "Marcar hoje" diariamente para cada atividade conforme você as completa.
4. Ative notificações para ser lembrado dos horários de estudo.
5. Acompanhe seu progresso nas barras de conclusão e conquiste prêmios a cada 7 dias perfeitos.

> Dica: Adicione a página aos favoritos do seu navegador para acesso rápido.

## Estrutura
- `index.html` – Página principal.
- `styles.css` – Estilos.
- `script.js` – Lógica (renderização, progresso, notificações, conquistas).
- `sw.js` – Service Worker para notificações.

Nenhuma dependência externa além de fontes Google.
