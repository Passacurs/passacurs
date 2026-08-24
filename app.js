// ============================================
// PASSACURS — Lògica principal
// ============================================

// Inicialitza Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuariActual = null;

// ---- INICIALITZACIÓ ----
window.addEventListener('load', async () => {
  // Registra el service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }

  // Comprova si hi ha sessió activa
  const { data: { session } } = await sb.auth.getSession();
  usuariActual = session?.user ?? null;

  // Amaga el splash
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 400);
    mostraUI(!!usuariActual);
  }, 1000);
});

// ---- MOSTRA LA UI SEGONS SESSIÓ ----
function mostraUI(logat) {
  document.getElementById('capçalera').style.display = '';
  document.getElementById('main').style.display = '';
  document.getElementById('ads-banner').style.display = '';
  document.getElementById('nav-bar').style.display = logat ? 'grid' : 'none';

  if (logat) {
    mostraVista('inici');
    carregaAvisos();
  } else {
    mostraVista('login');
  }
}

// ---- NAVEGACIÓ ENTRE VISTES ----
function mostraVista(id) {
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
  document.getElementById(`vista-${id}`)?.classList.add('activa');

  // Actualitza nav bar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('actiu'));
  const navActiu = document.getElementById(`nav-${id}`);
  if (navActiu) navActiu.classList.add('actiu');

  // Scroll a dalt
  document.getElementById('main').scrollTo(0, 0);
}

// ---- LOGIN ----
async function iniciaSessio() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return alert('Omple tots els camps');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return alert('Credencials incorrectes');

  usuariActual = data.user;
  mostraUI(true);
}

// ---- REGISTRE ----
async function registraUsuari() {
  const nom = document.getElementById('reg-nom').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const telefon = document.getElementById('reg-telefon').value.trim();
  const provincia = document.getElementById('reg-provincia').value;
  const municipi = document.getElementById('reg-municipi').value;
  const password = document.getElementById('reg-password').value;
  const privacitat = document.getElementById('reg-privacitat').checked;

  if (!nom || !email || !telefon || !provincia || !municipi || !password) {
    return alert('Omple tots els camps obligatoris');
  }
  if (!privacitat) {
    return alert('Has d\'acceptar la Política de Privacitat i les Condicions d\'Ús');
  }
  if (password.length < 8) {
    return alert('La contrasenya ha de tenir mínim 8 caràcters');
  }

  // Crea l'usuari a Supabase Auth
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return alert('Error al crear el compte: ' + error.message);

  // Guarda les dades addicionals a la taula usuaris
  const { error: err2 } = await sb.from('usuaris').insert({
    id: data.user.id,
    nom_usuari: nom,
    email,
    telefon,
    municipi,
    provincia
  });
  if (err2) return alert('Error al guardar les dades: ' + err2.message);

  usuariActual = data.user;
  mostraUI(true);
}

// ---- TANCAR SESSIÓ ----
async function tancaSessio() {
  await sb.auth.signOut();
  usuariActual = null;
  mostraUI(false);
}

// ---- CERCA PER ISBN (ofereixo) ----
async function cercaISBN() {
  const isbn = document.getElementById('isbn-entrada').value.trim();
  if (!isbn || isbn.length < 10) return alert('Introdueix un ISBN vàlid');

  // 1r intent: Google Books
  let dades = await cercaGoogleBooks(isbn);

  // 2n intent: Open Library
  if (!dades) dades = await cercaOpenLibrary(isbn);

  // 3r: formulari manual
  if (!dades) {
    alert('No hem trobat el llibre automàticament. Omple les dades manualment.');
    mostrarFormulariManual();
    return;
  }

  // Mostra el resultat
  document.getElementById('isbn-portada').src = dades.portada || 'icona.png';
  document.getElementById('isbn-titol').textContent = dades.titol;
  document.getElementById('isbn-meta').textContent = `${dades.autor || '—'} · ${dades.editorial || '—'} · ${dades.any || '—'}`;
  document.getElementById('resultat-isbn').style.display = '';

  // Guarda les dades per publicar
  window._llibreActual = { isbn13: isbn, ...dades };
}

async function cercaGoogleBooks(isbn) {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const d = await r.json();
    if (!d.items?.length) return null;
    const info = d.items[0].volumeInfo;
    return {
      titol: info.title || '',
      autor: info.authors?.join(', ') || '',
      editorial: info.publisher || '',
      any: info.publishedDate?.substring(0, 4) || '',
      portada: info.imageLinks?.thumbnail?.replace('http:', 'https:') || 'icona.png',
      idioma: info.language || 'ca',
      pagines: info.pageCount || null
    };
  } catch { return null; }
}

async function cercaOpenLibrary(isbn) {
  try {
    const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const d = await r.json();
    const llibre = d[`ISBN:${isbn}`];
    if (!llibre) return null;
    return {
      titol: llibre.title || '',
      autor: llibre.authors?.map(a => a.name).join(', ') || '',
      editorial: llibre.publishers?.[0]?.name || '',
      any: llibre.publish_date?.substring(0, 4) || '',
      portada: llibre.cover?.medium || '',
      idioma: '',
      pagines: llibre.number_of_pages || null
    };
  } catch { return null; }
}

// ---- PUBLICA UN LLIBRE ----
async function publicaLlibre() {
  const estat = document.getElementById('estat-exemplar').value;
  if (!estat) return alert('Selecciona l\'estat de l\'exemplar');
  if (!window._llibreActual) return alert('Primer cerca un llibre per ISBN');

  // 1. Guarda o recupera el llibre a la taula LLIBRES
  let { data: llibre } = await sb.from('llibres')
    .select('id')
    .eq('isbn13', window._llibreActual.isbn13)
    .single();

  if (!llibre) {
    const { data: nouLlibre, error } = await sb.from('llibres').insert({
      ...window._llibreActual
    }).select().single();
    if (error) return alert('Error: ' + error.message);
    llibre = nouLlibre;
  }

  // 2. Crea l'oferta
  const { error } = await sb.from('ofertes').insert({
    usuari_id: usuariActual.id,
    llibre_id: llibre.id,
    estat_exemplar: estat,
    estat_oferta: 'disponible'
  });

  if (error) return alert('Error en publicar: ' + error.message);

  // 3. Comprova si algú esperava aquest llibre i crea avisos
  await notificaListesEspera(llibre.id);

  alert('Llibre publicat correctament!');
  document.getElementById('isbn-entrada').value = '';
  document.getElementById('resultat-isbn').style.display = 'none';
  window._llibreActual = null;
  mostraVista('inici');
}

async function notificaListesEspera(llibreId) {
  const { data: esperes } = await sb.from('llistes_espera')
    .select('usuari_id')
    .eq('llibre_id', llibreId)
    .eq('estat', 'activa');

  if (!esperes?.length) return;

  const avisos = esperes.map(e => ({
    usuari_id: e.usuari_id,
    tipus: 'llibre_disponible',
    contingut_json: { llibre_id: llibreId },
    llegit: false
  }));

  await sb.from('avisos').insert(avisos);
}

// ---- CERCA DE LLIBRES (busco) ----
let isbnsBusco = 1;

function afegeixISBN() {
  isbnsBusco++;
  const div = document.createElement('div');
  div.className = 'form-grup';
  div.innerHTML = `
    <label>ISBN #${isbnsBusco}</label>
    <input type="number" class="isbn-busco" placeholder="9788430770..." inputmode="numeric">
  `;
  document.getElementById('llista-isbns-busco').appendChild(div);
}

async function cercaLlibres() {
  const inputs = document.querySelectorAll('.isbn-busco');
  const isbns = Array.from(inputs)
    .map(i => i.value.trim())
    .filter(v => v.length >= 10);

  if (!isbns.length) return alert('Introdueix almenys un ISBN');

  // Guarda les demandes
  for (const isbn of isbns) {
    await guardaDemanda(isbn);
  }

  // Cerca ofertes disponibles
  const { data: resultats } = await sb
    .from('ofertes')
    .select(`
      id, estat_oferta, estat_exemplar,
      usuari_id,
      llibres!inner(id, isbn13, titol, autor, editorial, any_publicacio, portada_url),
      usuaris!inner(nom_usuari, municipi)
    `)
    .in('llibres.isbn13', isbns)
    .eq('estat_oferta', 'disponible');

  mostraResultats(resultats || [], isbns);
}

async function guardaDemanda(isbn) {
  // Busca el llibre a la BD
  let { data: llibre } = await sb.from('llibres').select('id').eq('isbn13', isbn).single();

  // Si no existeix, el crea amb dades de l'API
  if (!llibre) {
    const dades = await cercaGoogleBooks(isbn) || await cercaOpenLibrary(isbn);
    if (dades) {
      const { data } = await sb.from('llibres').insert({ isbn13: isbn, ...dades }).select().single();
      llibre = data;
    }
  }

  if (!llibre) return;

  // Afegeix la demanda si no existeix
  await sb.from('demandes').upsert({
    usuari_id: usuariActual.id,
    llibre_id: llibre.id,
    estat: 'activa'
  }, { onConflict: 'usuari_id,llibre_id' });

  // Comprova si hi ha ofertes disponibles, si no, afegeix a llista d'espera
  const { data: ofertes } = await sb.from('ofertes')
    .select('id')
    .eq('llibre_id', llibre.id)
    .eq('estat_oferta', 'disponible');

  if (!ofertes?.length) {
    await sb.from('llistes_espera').upsert({
      usuari_id: usuariActual.id,
      llibre_id: llibre.id,
      estat: 'activa'
    }, { onConflict: 'usuari_id,llibre_id' });
  }
}

function mostraResultats(resultats, isbnsOriginales) {
  const contenidor = document.getElementById('llista-resultats');
  document.getElementById('resultats-busco').style.display = '';

  if (!resultats.length) {
    contenidor.innerHTML = `
      <div class="card estat-buit">
        <div class="buit-icona">😔</div>
        <p>No hem trobat cap dels teus llibres disponible ara.<br>Et notificarem quan apareguin!</p>
      </div>`;
    return;
  }

  // Agrupa per usuari oferidor
  const perUsuari = {};
  resultats.forEach(r => {
    const uid = r.usuari_id;
    if (!perUsuari[uid]) {
      perUsuari[uid] = {
        nom: r.usuaris.nom_usuari,
        municipi: r.usuaris.municipi,
        ofertes: []
      };
    }
    perUsuari[uid].ofertes.push(r);
  });

  contenidor.innerHTML = '';

  Object.entries(perUsuari)
    .sort((a, b) => b[1].ofertes.length - a[1].ofertes.length)
    .forEach(([uid, dades]) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '12px';

      const llibresHTML = dades.ofertes.map(o => `
        <div class="llibre-item">
          <img class="llibre-portada" src="${o.llibres.portada_url || 'icona.png'}" alt="">
          <div class="llibre-info">
            <p class="llibre-titol">${o.llibres.titol}</p>
            <p class="llibre-meta">${o.llibres.editorial || ''} · ${o.llibres.any_publicacio || ''}</p>
            <span class="pill disponible">${formatEstat(o.estat_exemplar)}</span>
          </div>
        </div>
      `).join('');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <p style="font-weight:600; font-size:15px;">${dades.nom}</p>
            <p style="font-size:12px; color:var(--gris-text);">📍 ${dades.municipi}</p>
          </div>
          <span style="font-size:12px; background:var(--verd-clar); color:var(--verd-fosc); padding:4px 10px; border-radius:20px; font-weight:500;">
            ${dades.ofertes.length} llibre${dades.ofertes.length > 1 ? 's' : ''}
          </span>
        </div>
        ${llibresHTML}
        <button class="btn-primary" style="margin-top:12px;"
          onclick="mostraPerfilOferidor('${uid}', '${dades.nom}', '${dades.municipi}')">
          Veure tots els seus llibres i contactar
        </button>
      `;

      contenidor.appendChild(card);
    });
}

// ---- PERFIL OFERIDOR + WHATSAPP ----
async function mostraPerfilOferidor(uid, nom, municipi) {
  document.getElementById('nom-oferidor').textContent = nom;
  document.getElementById('municipi-oferidor').textContent = `📍 ${municipi}`;

  const { data: ofertes } = await sb.from('ofertes')
    .select('id, estat_exemplar, estat_oferta, llibres(titol, autor, editorial, portada_url)')
    .eq('usuari_id', uid)
    .eq('estat_oferta', 'disponible');

  const contenidor = document.getElementById('llista-llibres-oferidor');
  contenidor.innerHTML = (ofertes || []).map(o => `
    <div class="llibre-item">
      <img class="llibre-portada" src="${o.llibres.portada_url || 'icona.png'}" alt="">
      <div class="llibre-info" style="flex:1;">
        <p class="llibre-titol">${o.llibres.titol}</p>
        <p class="llibre-meta">${o.llibres.editorial || ''}</p>
        <span class="pill disponible">${formatEstat(o.estat_exemplar)}</span>
      </div>
      <input type="checkbox" class="check-llibre"
        data-titol="${o.llibres.titol}"
        data-id="${o.id}"
        style="width:20px; height:20px; accent-color:var(--verd); flex-shrink:0; margin-top:4px;">
    </div>
  `).join('');

  // Guarda l'uid per al WhatsApp
  window._oferidorActual = { uid, nom };
  mostraVista('perfil-oferidor');
}

async function obreWhatsApp() {
  const seleccionats = Array.from(document.querySelectorAll('.check-llibre:checked'));
  if (!seleccionats.length) return alert('Marca almenys un llibre');

  const llistat = seleccionats.map(c => `✅ ${c.dataset.titol}`).join('\n');

  // Obté el telèfon de l'oferidor
  const { data: usuari } = await sb.from('usuaris')
    .select('telefon')
    .eq('id', window._oferidorActual.uid)
    .single();

  if (!usuari) return alert('No hem pogut obtenir el contacte');

  const telefon = usuari.telefon.replace(/\s/g, '').replace(/^0034/, '34').replace(/^\+/, '');

  // Obté el nom de l'usuari actual
  const { data: jo } = await sb.from('usuaris')
    .select('nom_usuari, municipi')
    .eq('id', usuariActual.id)
    .single();

  const missatge = encodeURIComponent(
    `Hola! T'escric des de Passacurs 📚\n\n` +
    `Estic interessat/da en aquests llibres que tens publicats:\n\n` +
    `${llistat}\n\n` +
    `Podríem quedar per recollir-los? Gràcies!\n` +
    `— ${jo?.nom_usuari || ''} (${jo?.municipi || ''})`
  );

  // Afegeix a la cua els llibres seleccionats
  for (const check of seleccionats) {
    await afegeixACua(check.dataset.id);
  }

  window.open(`https://wa.me/${telefon}?text=${missatge}`, '_blank');
}

async function afegeixACua(ofertaId) {
  // Comprova la posició actual
  const { data: cua } = await sb.from('cues')
    .select('posicio')
    .eq('oferta_id', ofertaId)
    .eq('estat', 'activa')
    .order('posicio', { ascending: false })
    .limit(1);

  const novaPos = cua?.length ? cua[0].posicio + 1 : 1;

  await sb.from('cues').upsert({
    oferta_id: ofertaId,
    usuari_id: usuariActual.id,
    posicio: novaPos,
    estat: 'activa'
  }, { onConflict: 'oferta_id,usuari_id' });

  // Si és el 1r de la cua, marca l'oferta com a reservada
  if (novaPos === 1) {
    await sb.from('ofertes').update({ estat_oferta: 'reservat' }).eq('id', ofertaId);
  }
}

// ---- AVISOS ----
async function carregaAvisos() {
  const { data: avisos } = await sb.from('avisos')
    .select('*')
    .eq('usuari_id', usuariActual.id)
    .eq('llegit', false)
    .order('data_creacio', { ascending: false });

  const count = avisos?.length || 0;
  const badge = document.getElementById('badge-avisos');

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';

    // Mostra el primer avís a l'inici
    if (avisos[0].tipus === 'llibre_disponible') {
      document.getElementById('avis-nou-llibre').style.display = '';
    }
  } else {
    badge.style.display = 'none';
  }
}

// ---- MUNICIPIS (desplegable) ----
const municipis = {
  barcelona: ['Barcelona', 'Badalona', 'Hospitalet de Llobregat', 'Sabadell', 'Terrassa', 'Mataró', 'Santa Coloma de Gramenet', 'Cornellà de Llobregat', 'Sant Boi de Llobregat', 'Manresa', 'Rubí', 'Viladecans', 'El Prat de Llobregat', 'Granollers', 'Cerdanyola del Vallès', 'Castelldefels', 'Mollet del Vallès', 'Gavà', 'Esplugues de Llobregat', 'Sant Cugat del Vallès'],
  girona: ['Girona', 'Banyoles', 'Blanes', 'Figueres', 'Lloret de Mar', 'Olot', 'Roses', 'Salt', 'Sant Feliu de Guíxols', 'Palafrugell'],
  lleida: ['Lleida', 'Balaguer', 'Cervera', 'Mollerussa', 'Tàrrega', 'La Seu d\'Urgell'],
  tarragona: ['Tarragona', 'Cambrils', 'El Vendrell', 'Reus', 'Salou', 'Torredembarra', 'Tortosa', 'Valls', 'Vila-seca']
};

function carregaMunicipis() {
  const provincia = document.getElementById('reg-provincia').value;
  const select = document.getElementById('reg-municipi');
  select.innerHTML = '<option value="">Selecciona municipi...</option>';
  select.disabled = !provincia;

  if (provincia && municipis[provincia]) {
    municipis[provincia].sort().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
  }
}

// ---- HELPERS ----
function formatEstat(estat) {
  const mapa = {
    'nou': 'Nou',
    'com_nou': 'Com nou',
    'bo': 'Bo',
    'acceptable': 'Acceptable',
    'molt_usat': 'Molt usat'
  };
  return mapa[estat] || estat;
}

function mostrarFormulariManual() {
  // TODO: mostrar camps manuals de títol, autor, editorial, any
}
