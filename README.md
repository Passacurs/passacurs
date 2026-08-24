# 📚 Passacurs

**Intercanvi gratuït de llibres escolars**

Passacurs és una aplicació web progressiva (PWA) que connecta famílies per intercanviar llibres de text escolars de manera gratuïta. Estalvia diners, reutilitza i ajuda al medi ambient.

---

## ✨ Funcionalitats

- 📷 **Escaneig de codi de barres** per afegir llibres fàcilment
- 🔍 **Cerca per ISBN** amb dades automàtiques (títol, autor, editorial, portada)
- 🔄 **Sistema de cua** per gestionar l'interès en un exemplar
- 💬 **Contacte per WhatsApp** amb missatge preconfigurat
- 📍 **Filtre per municipi** (Catalunya)
- 🔔 **Avisos en temps real** quan apareix un llibre que busques
- ♻️ Totalment **gratuït**

---

## 🛠️ Stack tecnològic

| Capa | Tecnologia |
|------|-----------|
| Frontend | HTML + CSS + JavaScript |
| Backend / Base de dades | Supabase |
| Allotjament | Vercel |
| Dades de llibres | Google Books API + Open Library API |
| Escàner | html5-qrcode |

---

## 🗃️ Estructura de la base de dades

```
USUARIS         → Dades de registre i contacte
LLIBRES         → Dades mestres per ISBN
OFERTES         → Exemplars oferts per usuaris
DEMANDES        → Llibres buscats per usuaris
CUES            → Sistema de cua per cada exemplar
LLISTES_ESPERA  → Llibres buscats sense oferta activa
AVISOS          → Notificacions internes (badges)
```

---

## 🚀 Instal·lació local

```bash
# Clona el repositori
git clone https://github.com/passacurs/passacurs.git
cd passacurs
```

Obre `index.html` directament al navegador, o fes servir l'extensió **Live Server** de VS Code per veure els canvis en temps real.

---

## ⚙️ Configuració de Supabase

A l'arxiu `js/config.js` omple les teves claus:

```javascript
const SUPABASE_URL = 'la_teva_url_de_supabase';
const SUPABASE_ANON_KEY = 'la_teva_clau_anonima_de_supabase';
```

---

## ⚖️ Legal

Aquesta aplicació compleix el **Reglament General de Protecció de Dades (RGPD)** i la **LOPD-GDD**. Les dades dels usuaris s'utilitzen exclusivament per facilitar l'intercanvi de llibres entre famílies.

---

## 🤝 Contribucions

Les contribucions són benvingudes! Si trobes un error o tens una idea de millora, obre un [issue](https://github.com/passacurs/passacurs/issues) o envia una pull request.

---

## 📄 Llicència

MIT License — lliure d'usar, modificar i distribuir.

---

Fet amb ❤️ per a les famílies de Catalunya
