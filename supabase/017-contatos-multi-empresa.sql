-- Multi-empresa: o MESMO contato (jid) pode existir em empresas diferentes.
-- Sobrou uma restrição antiga que exigia jid único globalmente, o que impedia
-- um paciente de falar com dois números (empresas) diferentes. A chave correta
-- é (company_id, jid), que o conector já usa. Aqui só removemos a trava antiga.
alter table contacts drop constraint if exists contacts_jid_key;
