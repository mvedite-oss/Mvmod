const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
let user = null, profile = null, cfg = {}, cache = [], filtro = 'Todos', busca = '';
const CATS = ['Jogo', 'Skin', 'Xite'], ICON = { Jogo: '🎮', Skin: '🎨', Xite: '🔥' };
const isAdmin = () => profile?.role === 'admin';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2800); }
const fmt = d => new Date(d).toLocaleDateString('pt-BR');

async function upload(file, pasta) {
  const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${file.name.split('.').pop()}`;
  const { error } = await sb.storage.from('media').upload(path, file);
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

async function loadUser() {
  const { data } = await sb.auth.getSession();
  user = data.session?.user || null; profile = null;
  if (user) ({ data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single());
  if (profile?.blocked) { await sb.auth.signOut(); user = profile = null; toast('Sua conta está bloqueada.'); }
}
async function loadCfg() {
  const { data } = await sb.from('site_settings').select('*').eq('id', 1).single();
  cfg = data || {};
  const r = document.documentElement;
  r.dataset.theme = cfg.theme || 'dark';
  if (cfg.primary_color) r.style.setProperty('--p', cfg.primary_color);
  r.style.setProperty('--r', cfg.button_style === 'reto' ? '4px' : '14px');
  r.style.setProperty('--card', cfg.card_size === 'grande' ? '300px' : '210px');
}
function nav() {
  $('nav').innerHTML = user
    ? `<span>${esc(profile?.username || 'Conta')}</span>${isAdmin() ? '<a class="btn sm" href="#/admin">Painel ADM</a>' : ''}<button class="ghost sm" onclick="sair()">Sair</button>`
    : `<a class="btn ghost sm" href="#/login">Entrar</a><a class="btn sm" href="#/cadastro">Cadastrar</a>`;
}
async function sair() { await sb.auth.signOut(); location.hash = '#/'; }

/* ---------- ROTAS ---------- */
async function route() {
  const [, p, id] = (location.hash || '#/').split('/');
  nav(); window.scrollTo(0, 0);
  if (p === 'c') return detalhe(id);
  if (p === 'login' || p === 'cadastro') return authPage(p);
  if (p === 'recuperar') return recuperar();
  if (p === 'admin') return isAdmin() ? admin('dash') : (app.innerHTML = '<p class="empty">Acesso restrito ao administrador.</p>');
  home();
}

/* ---------- HOME ---------- */
async function home() {
  app.innerHTML = '<p class="empty">Carregando…</p>';
  const { data, error } = await sb.from('contents').select('*').eq('published', true).order('created_at', { ascending: false });
  if (error) return app.innerHTML = `<p class="empty">Erro ao carregar: ${esc(error.message)}</p>`;
  cache = data;
  const f = cache.find(c => c.featured);
  app.innerHTML = `
    ${f ? `<a href="#/c/${f.id}" class="hero" style="background-image:url('${esc(f.banner_url || f.cover_url)}')"><div class="in"><span class="tag">Destaque</span><h1>${esc(f.featured_title || f.name)}</h1><p>${esc(f.featured_desc || f.description || '')}</p><br><span class="btn">Ver conteúdo</span></div></a>`
      : `<div class="hero"><div class="in"><h1>Seu catálogo gamer</h1><p>Encontre jogos, skins e conteúdos.</p></div></div>`}
    <div class="search"><input id="q" placeholder="Pesquisar…" value="${esc(busca)}"></div>
    <div class="cats">${['Todos', ...CATS].map(c => `<button class="${c === filtro ? '' : 'ghost'} sm" data-c="${c}">${ICON[c] || '✨'} ${c}</button>`).join('')}</div>
    <h2>Últimos conteúdos</h2><div class="grid" id="lista"></div>`;
  $('q').oninput = e => { busca = e.target.value; lista(); };
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { filtro = b.dataset.c; home(); });
  lista();
}
function lista() {
  const l = cache.filter(c => (filtro === 'Todos' || c.category === filtro) && c.name.toLowerCase().includes(busca.toLowerCase()));
  $('lista').innerHTML = l.length ? l.map(c => `
    <a class="card" href="#/c/${c.id}"><div class="img" style="background-image:url('${esc(c.cover_url)}')"></div>
    <div class="bd"><h3>${esc(c.name)}</h3><span class="tag">${esc(c.category)}</span> <span class="tag ${c.status === 'Atualizado' ? 'ok' : ''}">${esc(c.status)}</span><br><small>v${esc(c.version)} · ${fmt(c.created_at)}</small></div></a>`).join('')
    : '<p class="empty">Nenhum conteúdo encontrado.</p>';
}

/* ---------- DETALHE ---------- */
async function detalhe(id) {
  const { data: c } = await sb.from('contents').select('*, versions(*, downloads(url))').eq('id', id).single();
  if (!c) return app.innerHTML = '<p class="empty">Conteúdo não encontrado.</p>';
  const vs = (c.versions || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  app.innerHTML = `
    <div class="hero" style="background-image:url('${esc(c.banner_url || c.cover_url)}');min-height:220px"><div class="in"><span class="tag">${esc(c.category)}</span> <span class="tag ok">${esc(c.status)}</span><h1>${esc(c.name)}</h1></div></div>
    <div class="box" style="margin-top:16px"><p>${esc(c.description).replace(/\n/g, '<br>')}</p></div>
    <h2>Versões disponíveis</h2>
    ${vs.length ? vs.map(v => { const url = v.downloads?.[0]?.url; return `<div class="ver"><b>v${esc(v.version)}</b> ${v.is_current ? '<span class="tag ok">Mais recente</span>' : '<span class="tag">Anterior</span>'} <small>${fmt(v.created_at)}</small>
      <p>${esc(v.notes || '').replace(/\n/g, '<br>')}</p><br>
      ${user ? (url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Baixar</a>` : '<small>Download indisponível.</small>') : '<a class="btn sm" href="#/login">Entrar para acessar</a>'}</div>`; }).join('') : '<p class="empty">Nenhuma versão publicada.</p>'}`;
}

/* ---------- AUTH ---------- */
function authPage(tipo) {
  const cad = tipo === 'cadastro';
  app.innerHTML = `<div class="box narrow"><h2>${cad ? 'Criar conta' : 'Entrar'}</h2>
    ${cad ? '<label>Nome de usuário</label><input id="u">' : ''}
    <label>E-mail</label><input id="e" type="email"><label>Senha</label><input id="s" type="password">
    ${cad ? '<label>Confirmar senha</label><input id="s2" type="password">' : ''}
    <button id="go" style="width:100%">${cad ? 'Criar conta' : 'Entrar'}</button><br><br>
    <small>${cad ? '<a href="#/login">Já tenho conta</a>' : '<a href="#/cadastro">Criar conta</a> · <a href="#/recuperar">Esqueci a senha</a>'}</small></div>`;
  $('go').onclick = async () => {
    const email = $('e').value.trim(), password = $('s').value;
    if (cad) {
      if (password.length < 6) return toast('A senha precisa de 6+ caracteres.');
      if (password !== $('s2').value) return toast('As senhas não conferem.');
      const { error } = await sb.auth.signUp({ email, password, options: { data: { username: $('u').value.trim() } } });
      if (error) return toast(error.message);
      toast('Conta criada! Confirme o e-mail se solicitado.');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return toast('E-mail ou senha incorretos.');
    }
    await loadUser(); location.hash = '#/';
  };
}
function recuperar() {
  app.innerHTML = `<div class="box narrow"><h2>Recuperar senha</h2><label>E-mail</label><input id="e" type="email"><button id="go" style="width:100%">Enviar link</button></div>`;
  $('go').onclick = async () => { const { error } = await sb.auth.resetPasswordForEmail($('e').value.trim(), { redirectTo: location.origin + location.pathname }); toast(error ? error.message : 'Link enviado para o seu e-mail.'); };
}

/* ---------- PAINEL ADM ---------- */
const TABS = [['dash', 'Dashboard'], ['novo', 'Criar conteúdo'], ['cards', 'Gerenciar'], ['dest', 'Destaques'], ['users', 'Usuários'], ['visual', 'Visual']];
async function admin(tab) {
  app.innerHTML = `<h2>Painel ADM</h2><div class="tabs">${TABS.map(([k, n]) => `<button class="${k === tab ? '' : 'ghost'} sm" onclick="admin('${k}')">${n}</button>`).join('')}</div><div id="ad"></div>`;
  ({ dash: aDash, novo: aNovo, cards: aCards, dest: aDest, users: aUsers, visual: aVisual })[tab]();
}
async function aDash() {
  const [c, u] = await Promise.all([sb.from('contents').select('category,published'), sb.from('profiles').select('id', { count: 'exact', head: true })]);
  const n = (f) => c.data.filter(f).length;
  const st = [['Conteúdos', c.data.length], ['Jogos', n(x => x.category === 'Jogo')], ['Skins', n(x => x.category === 'Skin')], ['Xite', n(x => x.category === 'Xite')], ['Publicados', n(x => x.published)], ['Usuários', u.count]];
  $('ad').innerHTML = `<div class="stats">${st.map(([a, b]) => `<div class="box"><small>${a}</small><b>${b}</b></div>`).join('')}</div>`;
}
function aNovo() {
  $('ad').innerHTML = `<div class="box"><h2>Criar novo conteúdo</h2>
    <label>Nome</label><input id="n" placeholder="Ex.: Skin Carioca">
    <div class="two"><div><label>Categoria</label><select id="cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div><label>Versão inicial</label><input id="ver" value="1.0"></div></div>
    <label>Foto de capa (galeria do celular ou computador)</label><input id="cov" type="file" accept="image/*">
    <img id="pv" class="prev" hidden>
    <label>Banner de destaque (opcional)</label><input id="ban" type="file" accept="image/*">
    <label>Descrição</label><textarea id="d" rows="4"></textarea>
    <label>Novidades da versão</label><textarea id="nt" rows="2"></textarea>
    <label>Link de download autorizado (opcional)</label><input id="dl" placeholder="https://…">
    <div class="two"><div><label>Status</label><select id="stt"><option>Atualizado</option><option>Antigo</option></select></div>
    <div><label>Situação</label><select id="pub"><option value="1">Publicado</option><option value="0">Rascunho</option></select></div></div>
    <button id="sv">Publicar card</button></div>`;
  $('cov').onchange = e => { const f = e.target.files[0]; if (f) { $('pv').src = URL.createObjectURL(f); $('pv').hidden = false; } };
  $('sv').onclick = async () => {
    const b = $('sv'); b.disabled = true; b.textContent = 'Enviando…';
    try {
      if (!$('n').value.trim()) throw { message: 'Digite o nome.' };
      const cover = $('cov').files[0] ? await upload($('cov').files[0], 'capas') : null;
      const banner = $('ban').files[0] ? await upload($('ban').files[0], 'banners') : null;
      const { data: c, error } = await sb.from('contents').insert({ name: $('n').value.trim(), category: $('cat').value, description: $('d').value, cover_url: cover, banner_url: banner, version: $('ver').value, status: $('stt').value, published: $('pub').value === '1' }).select().single();
      if (error) throw error;
      const { data: v, error: e2 } = await sb.from('versions').insert({ content_id: c.id, version: $('ver').value, notes: $('nt').value, is_current: true }).select().single();
      if (e2) throw e2;
      if ($('dl').value.trim()) await sb.from('downloads').insert({ version_id: v.id, url: $('dl').value.trim() });
      toast('Publicado!'); admin('cards');
    } catch (e) { toast(e.message || 'Erro ao salvar.'); b.disabled = false; b.textContent = 'Publicar card'; }
  };
}
async function aCards() {
  const { data } = await sb.from('contents').select('*').order('created_at', { ascending: false });
  $('ad').innerHTML = `<div class="box">${data.length ? data.map(c => `<div class="row"><div><b>${esc(c.name)}</b><br><small>${c.category} · v${esc(c.version)} · ${c.published ? 'Publicado' : 'Rascunho'}</small></div>
    <div><button class="ghost sm" onclick="togPub('${c.id}',${!c.published})">${c.published ? 'Ocultar' : 'Publicar'}</button>
    <button class="ghost sm" onclick="novaVersao('${c.id}')">+ Versão</button>
    <button class="ghost sm" onclick="trocaFoto('${c.id}')">Trocar foto</button>
    <button class="red sm" onclick="delCard('${c.id}')">Excluir</button></div></div>`).join('') : '<p class="empty">Nenhum conteúdo ainda.</p>'}</div>`;
}
async function togPub(id, v) { await sb.from('contents').update({ published: v }).eq('id', id); aCards(); }
async function delCard(id) { if (confirm('Excluir este conteúdo?')) { await sb.from('contents').delete().eq('id', id); toast('Excluído.'); aCards(); } }
function trocaFoto(id) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { try { const url = await upload(i.files[0], 'capas'); await sb.from('contents').update({ cover_url: url }).eq('id', id); toast('Foto trocada.'); } catch (e) { toast(e.message); } };
  i.click();
}
async function novaVersao(id) {
  const ver = prompt('Número da nova versão (ex.: 1.2):'); if (!ver) return;
  const notes = prompt('Novidades desta versão:') || '', link = prompt('Link de download autorizado (opcional):') || '';
  await sb.from('versions').update({ is_current: false }).eq('content_id', id);
  const { data: v, error } = await sb.from('versions').insert({ content_id: id, version: ver, notes, is_current: true }).select().single();
  if (error) return toast(error.message);
  if (link) await sb.from('downloads').insert({ version_id: v.id, url: link });
  await sb.from('contents').update({ version: ver, status: 'Atualizado' }).eq('id', id);
  toast('Versão publicada.'); aCards();
}
async function aDest() {
  const { data } = await sb.from('contents').select('id,name,featured').eq('published', true);
  $('ad').innerHTML = `<div class="box"><h2>Destaque da página inicial</h2>
    <label>Card em destaque</label><select id="fc"><option value="">— Nenhum —</option>${data.map(c => `<option value="${c.id}" ${c.featured ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>Título especial</label><input id="ft"><label>Descrição</label><textarea id="fd" rows="2"></textarea>
    <label>Banner (opcional)</label><input id="fb" type="file" accept="image/*"><button id="sv">Salvar destaque</button></div>`;
  $('sv').onclick = async () => {
    try {
      await sb.from('contents').update({ featured: false }).eq('featured', true);
      if ($('fc').value) {
        const u = { featured: true, featured_title: $('ft').value || null, featured_desc: $('fd').value || null };
        if ($('fb').files[0]) u.banner_url = await upload($('fb').files[0], 'banners');
        await sb.from('contents').update(u).eq('id', $('fc').value);
      }
      toast('Destaque salvo.');
    } catch (e) { toast(e.message); }
  };
}
async function aUsers() {
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  $('ad').innerHTML = `<div class="box">${data.map(u => `<div class="row"><div><b>${esc(u.username)}</b> ${u.role === 'admin' ? '<span class="tag">ADM</span>' : ''} ${u.blocked ? '<span class="tag" style="border-color:#e11d48">Bloqueado</span>' : ''}<br><small>Desde ${fmt(u.created_at)}</small></div>
    ${u.role === 'admin' ? '' : `<div><button class="${u.blocked ? '' : 'red'} sm" onclick="bloq('${u.id}',${!u.blocked})">${u.blocked ? 'Desbloquear' : 'Bloquear'}</button></div>`}</div>`).join('')}</div>`;
}
async function bloq(id, v) { await sb.from('profiles').update({ blocked: v }).eq('id', id); aUsers(); }
function aVisual() {
  const o = (k, a) => a.map(([v, n]) => `<option value="${v}" ${cfg[k] === v ? 'selected' : ''}>${n}</option>`).join('');
  $('ad').innerHTML = `<div class="box"><h2>Personalizar visual</h2>
    <label>Tema</label><select id="th">${o('theme', [['dark', 'Escuro'], ['light', 'Claro']])}</select>
    <label>Cor principal</label><input id="pc" type="color" value="${cfg.primary_color || '#8b5cf6'}">
    <label>Botões</label><select id="bs">${o('button_style', [['arredondado', 'Arredondados'], ['reto', 'Retos']])}</select>
    <label>Cards</label><select id="cs">${o('card_size', [['compacto', 'Compactos'], ['grande', 'Grandes']])}</select>
    <button id="sv">Salvar visual</button></div>`;
  $('sv').onclick = async () => {
    const { error } = await sb.from('site_settings').update({ theme: $('th').value, primary_color: $('pc').value, button_style: $('bs').value, card_size: $('cs').value }).eq('id', 1);
    if (error) return toast(error.message);
    await loadCfg(); toast('Visual atualizado.');
  };
}

/* ---------- INÍCIO ---------- */
(async () => {
  await loadUser(); await loadCfg();
  sb.auth.onAuthStateChange(async () => { await loadUser(); nav(); });
  window.addEventListener('hashchange', route); route();
})();
