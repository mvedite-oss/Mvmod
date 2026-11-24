# MV MODS

Site estático (HTML + CSS + JavaScript) com banco de dados Supabase. Hospedagem: GitHub Pages.

## Passo a passo
1. Crie um projeto grátis em supabase.com.
2. No Supabase: **SQL Editor** > cole o conteúdo de `supabase/schema.sql` > **Run**.
3. Em **Project Settings > API** copie a *Project URL* e a chave *anon public* e cole em `js/config.js`.
4. Em **Authentication > URL Configuration**, coloque a URL do seu GitHub Pages em *Site URL*.
5. Suba todos estes arquivos para um repositório no GitHub (index.html na raiz) e ative **Settings > Pages > Deploy from branch (main)**.
6. Abra o site, crie sua conta e rode no SQL Editor a linha final do `schema.sql` (a que torna você ADM).
7. Entre de novo: aparece o botão **Painel ADM**.

## Observações
- Nunca coloque a chave `service_role` no site.
- Hospede apenas conteúdo próprio ou autorizado; nada que burle antitrapaça ou contas de jogos.
- Excluir um usuário de vez é feito em Supabase > Authentication > Users (o site só bloqueia/desbloqueia).
