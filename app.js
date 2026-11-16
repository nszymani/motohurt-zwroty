// =====================================================================
//  MotoHurt – obsługa zwrotów
//  Cała logika aplikacji. Dane biorą się z plików w folderze "dane":
//  CZESCI, DOSTAWCY, KLIENCI, ZAMOWIENIA.
// =====================================================================

// Dane naszej firmy (nadawca na dokumencie)
const FIRMA = {
  nazwa: "MotoHurt Sp. z o.o.",
  adres: "ul. Przykładowa 1, 00-950 Warszawa",
  magazyn: "Magazyn zwrotów"
};

// ---------- 1. Pomocnicze funkcje ----------

// Zamienia "2026-11-16" na liczbę dni (żeby łatwo odejmować daty)
function naDni(tekstDaty) {
  const [r, m, d] = tekstDaty.split("-").map(Number);
  return Date.UTC(r, m - 1, d) / 86400000;
}

// Zamienia liczbę dni z powrotem na "2026-11-16"
function zDni(dni) {
  return new Date(dni * 86400000).toISOString().slice(0, 10);
}

// "2026-11-16" -> "16.11.2026"
function ladnaData(tekstDaty) {
  const [r, m, d] = tekstDaty.split("-");
  return `${d}.${m}.${r}`;
}

// 1234.5 -> "1 234,50 zł"
function zl(kwota) {
  return kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

// Dzisiejsza data jako "RRRR-MM-DD" (czas lokalny)
function dzisiaj() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

// Zabezpieczenie tekstu przed wstawieniem do HTML
function bezpieczny(tekst) {
  return String(tekst).replace(/[&<>"']/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
}

// Usuwa polskie znaki (do treści kodu QR – czytniki lepiej je obsługują)
function bezOgonkow(tekst) {
  return tekst.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
}

// " 5 ", "nr 5", "005" -> 5  (zostawia same cyfry; brak cyfr -> null)
function poprawNumer(tekst) {
  const cyfry = tekst.replace(/\D/g, "");
  return cyfry ? Number(cyfry) : null;
}

// ---------- 2. Szukanie w bazach ----------

function znajdzZamowienie(numer) {
  const z = ZAMOWIENIA.find(x => x.numer === numer);
  if (!z) return null;
  return {
    zamowienie: z,
    klient: KLIENCI.find(k => k.id === z.klientId),
    czesc: CZESCI.find(c => c.sku === z.sku),
    dostawca: DOSTAWCY.find(d => d.id === z.dostawcaId)
  };
}

// ---------- 3. Liczenie terminu zwrotu ----------

function policzTermin(dataZakupu, limitDni, dataZwrotu) {
  const minelo = naDni(dataZwrotu) - naDni(dataZakupu);   // ile dni minęło od zakupu
  const zostalo = limitDni - minelo;                       // ile dni jeszcze zostało
  return {
    minelo,
    zostalo,
    ostatniDzien: zDni(naDni(dataZakupu) + limitDni),      // do kiedy można odesłać
    mozna: zostalo >= 0                                    // czy jeszcze można zwrócić
  };
}

// Odmiana słowa "dzień"
function dni(n) {
  return Math.abs(n) === 1 ? "dzień" : "dni";
}

// ---------- 4. Wyświetlanie wyniku ----------

let aktualne = null; // tu trzymamy ostatnio znalezione zamówienie

function pokazWynik(dane, dataZwrotu) {
  const { zamowienie: z, klient: k, czesc: c, dostawca: d } = dane;
  const t = policzTermin(z.dataZakupu, d.limitZwrotuDni, dataZwrotu);
  aktualne = { ...dane, termin: t, dataZwrotu };

  // Pasek statusu (zielony / czerwony)
  const status = document.getElementById("status");
  if (t.mozna) {
    status.className = "status ok";
    status.innerHTML = t.zostalo === 0
      ? `<b>Dziś ostatni dzień na zwrot!</b> Odeślij część do hurtowni ${bezpieczny(d.nazwa)} jeszcze dzisiaj.`
      : `<b>Można zwrócić do hurtowni.</b> Zostało <b>${t.zostalo} ${dni(t.zostalo)}</b> (do ${ladnaData(t.ostatniDzien)}).`;
  } else {
    status.className = "status zle";
    status.innerHTML = `<b>Termin zwrotu minął ${-t.zostalo} ${dni(t.zostalo)} temu</b> (był do ${ladnaData(t.ostatniDzien)}). Część trafia na magazyn własny.`;
  }

  // Cztery karty z informacjami
  document.getElementById("info-kto").innerHTML = `
    <p class="duze">${bezpieczny(k.imie)} ${bezpieczny(k.nazwisko)}</p>
    <p>${bezpieczny(k.adres)}</p>
    <p>${bezpieczny(k.telefon)} · ${bezpieczny(k.email)}</p>`;

  document.getElementById("info-kiedy").innerHTML = `
    <p class="duze">${ladnaData(z.dataZakupu)}</p>
    <p>Minęło ${t.minelo} ${dni(t.minelo)} od zakupu</p>
    <p>Limit hurtowni: ${d.limitZwrotuDni} dni</p>`;

  document.getElementById("info-co").innerHTML = `
    <p class="duze">${bezpieczny(c.nazwa)}</p>
    <p>SKU: ${bezpieczny(c.sku)} · ${bezpieczny(c.producent)} · nr kat. ${bezpieczny(c.numerKatalogowy)}</p>
    <p>Ilość: <b>${z.ilosc} szt.</b> × ${zl(z.cenaBrutto)} = <b>${zl(z.ilosc * z.cenaBrutto)}</b></p>`;

  document.getElementById("info-dokad").innerHTML = `
    <p class="duze">${bezpieczny(d.nazwa)}</p>
    <p>${bezpieczny(d.adres)}</p>
    <p>${bezpieczny(d.email)} · tel. ${bezpieczny(d.telefon)}</p>`;

  // Napis na przycisku zależy od tego, czy termin minął
  document.getElementById("przycisk-dokument").textContent =
    t.mozna ? "Generuj dokument zwrotu" : "Generuj dokument przyjęcia na magazyn";
  document.getElementById("przycisk-api").hidden = !t.mozna;

  document.getElementById("wynik").hidden = false;
  document.getElementById("obszar-dokumentu").hidden = true;
  document.getElementById("odpowiedz-api").hidden = true;
}

// ---------- 5. Dokument (wg wzoru) z kodem QR ----------

function generujDokument() {
  const { zamowienie: z, klient: k, czesc: c, dostawca: d, termin: t, dataZwrotu } = aktualne;
  const powod = document.getElementById("pole-powod").value;
  const zwrot = t.mozna;

  const typ = zwrot ? "ZW" : "PM";
  const numerDok = `${typ}/${dataZwrotu.replace(/-/g, "")}/${String(z.numer).padStart(3, "0")}`;
  const tytul = zwrot ? "Dokument zwrotu do dostawcy" : "Przyjęcie na magazyn własny";

  // Co zapisujemy w kodzie QR (pracownik / hurtownia skanuje telefonem)
  const trescQR = bezOgonkow([
    `MOTOHURT ${zwrot ? "ZWROT" : "MAGAZYN"}`,
    `DOK:${numerDok}`,
    `ZAM:${z.numer}`,
    `SKU:${c.sku}`,
    `ILOSC:${z.ilosc}`,
    `DOSTAWCA:${d.id} ${d.nazwa}`,
    `TERMIN:${t.ostatniDzien}`
  ].join("\n"));

  const odbiorca = zwrot
    ? `<b>${bezpieczny(d.nazwa)}</b><br>${bezpieczny(d.adres)}<br>${bezpieczny(d.email)}`
    : `<b>${FIRMA.nazwa}</b><br>${FIRMA.magazyn} – stan własny<br>${FIRMA.adres}`;

  document.getElementById("dokument").innerHTML = `
    <div class="dok-naglowek">
      <div>
        <div class="dok-firma">Moto<span>Hurt</span></div>
        <h3>${tytul}</h3>
        <p>Nr dokumentu: <b>${numerDok}</b></p>
        <p>Data wystawienia: ${ladnaData(dataZwrotu)}</p>
      </div>
      <div class="dok-qr">${zrobKodQR(trescQR, 140)}<small>Zeskanuj, aby odczytać dane zwrotu</small></div>
    </div>

    <div class="dok-strony">
      <div><h4>Nadawca</h4><b>${FIRMA.nazwa}</b><br>${FIRMA.magazyn}<br>${FIRMA.adres}</div>
      <div><h4>${zwrot ? "Odbiorca (hurtownia)" : "Miejsce przyjęcia"}</h4>${odbiorca}</div>
    </div>

    <table class="dok-tabela">
      <thead><tr><th>Lp.</th><th>SKU</th><th>Nazwa części</th><th>Producent / nr kat.</th><th>Ilość</th><th>Cena</th><th>Wartość</th></tr></thead>
      <tbody><tr>
        <td>1</td><td>${bezpieczny(c.sku)}</td><td>${bezpieczny(c.nazwa)}</td>
        <td>${bezpieczny(c.producent)}<br>${bezpieczny(c.numerKatalogowy)}</td>
        <td>${z.ilosc} szt.</td><td>${zl(z.cenaBrutto)}</td><td>${zl(z.ilosc * z.cenaBrutto)}</td>
      </tr></tbody>
    </table>

    <div class="dok-dane">
      <p><span>Numer zamówienia:</span> ${z.numer}</p>
      <p><span>Data zakupu:</span> ${ladnaData(z.dataZakupu)}</p>
      <p><span>Klient zwracający:</span> ${bezpieczny(k.imie)} ${bezpieczny(k.nazwisko)}, ${bezpieczny(k.adres)}</p>
      <p><span>Powód zwrotu:</span> ${bezpieczny(powod)}</p>
      <p><span>Limit zwrotu u dostawcy:</span> ${d.limitZwrotuDni} dni (do ${ladnaData(t.ostatniDzien)})</p>
      <p><span>Status:</span> ${zwrot
        ? `w terminie – zostało ${t.zostalo} ${dni(t.zostalo)}`
        : `po terminie o ${-t.zostalo} ${dni(t.zostalo)} – zwrot do dostawcy niemożliwy`}</p>
    </div>

    <div class="dok-podpisy">
      <div>Wystawił (pracownik MotoHurt)</div>
      <div>${zwrot ? "Przyjął (hurtownia)" : "Przyjął na magazyn"}</div>
    </div>`;

  document.getElementById("obszar-dokumentu").hidden = false;
  document.getElementById("obszar-dokumentu").scrollIntoView({ behavior: "smooth" });
}

// ---------- 6. Mockup API hurtowni (symulacja wysłania powiadomienia) ----------

function powiadomHurtownie() {
  const { zamowienie: z, czesc: c, dostawca: d, termin: t, dataZwrotu } = aktualne;
  const zapytanie = {
    metoda: "POST",
    adres: `https://api.${d.email.split("@")[1]}/zwroty`,
    dane: {
      numerZamowienia: z.numer,
      sku: c.sku,
      ilosc: z.ilosc,
      powod: document.getElementById("pole-powod").value,
      dataNadania: dataZwrotu
    }
  };
  // Udajemy odpowiedź serwera hurtowni
  const odpowiedz = {
    status: "200 OK",
    numerRMA: `RMA-${d.id}-${String(z.numer).padStart(3, "0")}-${dataZwrotu.replace(/-/g, "").slice(4)}`,
    komunikat: `Zgłoszenie przyjęte. Prosimy o nadanie paczki do ${ladnaData(t.ostatniDzien)}.`
  };
  const pole = document.getElementById("odpowiedz-api");
  pole.textContent =
    "→ WYSŁANO (symulacja):\n" + JSON.stringify(zapytanie, null, 2) +
    "\n\n← ODPOWIEDŹ HURTOWNI (symulacja):\n" + JSON.stringify(odpowiedz, null, 2);
  pole.hidden = false;
}

// ---------- 7. Zakładka "Bazy danych" ----------

function tabela(idElementu, naglowki, wiersze) {
  const html = `<table class="tabela">
    <thead><tr>${naglowki.map(n => `<th>${n}</th>`).join("")}</tr></thead>
    <tbody>${wiersze.map(w => `<tr>${w.map(p => `<td>${bezpieczny(p)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
  document.getElementById(idElementu).innerHTML = html;
}

function pokazBazy() {
  tabela("tabela-dostawcy", ["ID", "Nazwa", "Limit zwrotu", "Adres", "E-mail", "Telefon"],
    DOSTAWCY.map(d => [d.id, d.nazwa, d.limitZwrotuDni + " dni", d.adres, d.email, d.telefon]));
  tabela("tabela-zamowienia", ["Numer", "Klient", "SKU", "Ilość", "Cena", "Data zakupu", "Dostawca"],
    ZAMOWIENIA.map(z => {
      const k = KLIENCI.find(x => x.id === z.klientId);
      const d = DOSTAWCY.find(x => x.id === z.dostawcaId);
      return [z.numer, k ? `${k.imie} ${k.nazwisko}` : z.klientId, z.sku, z.ilosc, zl(z.cenaBrutto), z.dataZakupu, d ? d.nazwa : z.dostawcaId];
    }));
  tabela("tabela-klienci", ["ID", "Imię", "Nazwisko", "Adres", "E-mail", "Telefon"],
    KLIENCI.map(k => [k.id, k.imie, k.nazwisko, k.adres, k.email, k.telefon]));
  tabela("tabela-czesci", ["SKU", "Nazwa", "Producent", "Nr katalogowy"],
    CZESCI.map(c => [c.sku, c.nazwa, c.producent, c.numerKatalogowy]));
}

// ---------- 8. Start aplikacji: podpinamy przyciski ----------

document.getElementById("pole-data").value = dzisiaj();
document.getElementById("lista-numerow").innerHTML =
  ZAMOWIENIA.map(z => `<option value="${z.numer}">`).join("");
pokazBazy();

document.getElementById("formularz").addEventListener("submit", e => {
  e.preventDefault();
  const blad = document.getElementById("blad");
  const numer = poprawNumer(document.getElementById("pole-numer").value);
  const dataZwrotu = document.getElementById("pole-data").value || dzisiaj();
  blad.hidden = true;

  if (!numer) {
    blad.textContent = "Wpisz numer zamówienia (liczba od 1 do 100).";
    blad.hidden = false;
    return;
  }
  const dane = znajdzZamowienie(numer);
  if (!dane) {
    document.getElementById("wynik").hidden = true;
    blad.textContent = `Nie znaleziono zamówienia nr ${numer}. Numery zamówień są od 1 do ${ZAMOWIENIA.length}.`;
    blad.hidden = false;
    return;
  }
  if (!dane.klient || !dane.czesc || !dane.dostawca) {
    blad.textContent = `Zamówienie nr ${numer} ma błędne dane w bazie (brak klienta, części albo dostawcy).`;
    blad.hidden = false;
    return;
  }
  if (naDni(dataZwrotu) < naDni(dane.zamowienie.dataZakupu)) {
    blad.textContent = "Data przyjęcia zwrotu nie może być wcześniejsza niż data zakupu.";
    blad.hidden = false;
    return;
  }
  document.getElementById("pole-numer").value = numer;
  pokazWynik(dane, dataZwrotu);
});

document.getElementById("przycisk-dokument").addEventListener("click", generujDokument);
document.getElementById("przycisk-api").addEventListener("click", powiadomHurtownie);
document.getElementById("przycisk-drukuj").addEventListener("click", () => window.print());

// Przełączanie zakładek
document.querySelectorAll(".zakladka").forEach(przycisk => {
  przycisk.addEventListener("click", () => {
    document.querySelectorAll(".zakladka").forEach(p => p.classList.remove("aktywna"));
    przycisk.classList.add("aktywna");
    document.querySelectorAll(".widok").forEach(w => (w.hidden = w.id !== przycisk.dataset.widok));
  });
});
