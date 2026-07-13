-- Recusar ligações (voz/vídeo) + aviso automático por mensagem.
-- O conector já lê essas colunas; aqui elas ganham lugar no banco e na tela de Config.
alter table settings add column if not exists call_reject_enabled boolean not null default true;
alter table settings add column if not exists call_reject_message text;
