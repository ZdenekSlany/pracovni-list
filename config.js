/*
 * Konfigurace formuláře Pracovní list Fleetware.
 * Změna adresy nebo seznamů možností nevyžaduje úpravu kódu, stačí upravit
 * tento soubor a stránku znovu nasadit.
 */
window.PL_CONFIG = {
  // Verze struktury dat, zapisuje se do JSON a CSV.
  schemaVersion: "1.0",

  // Adresa RADIUM, na kterou technik list posílá. ZATÍM TESTOVACÍ – nahradit finální adresou.
  recipientEmail: "zdenek.slany@gmail.com",

  // Prováděná činnost
  activities: ["Montáž", "Demontáž", "Přemontáž", "Programování", "Servis"],

  // Typ zařízení
  deviceTypes: ["CP40", "TLT150", "TLT130"],

  // Typy zařízení, u kterých jsou Číslo sítě a AR zařízení povinné
  deviceTypesRequiringNetwork: ["CP40"],

  // Použitý materiál. Poslední volba (materialOther) zobrazí textové pole pro vlastní název.
  materials: ["CP40", "TLT130", "TLT150", "CI5", "CI6", "CAN SNIFFER", "CAR2COM", "MS", "NKS", "Jiný"],
  materialOther: "Jiný",
  maxMaterials: 20,

  // Možnosti pro vstupy SWIN1–13 a COM1–3
  peripheralOptions: ["PTO", "TABLET", "FMS", "CWI", "CWI READY", "STÁNÍ"],
  swinCount: 13,
  comCount: 3,
  otherPeripheralCount: 2,

  // Firma technika
  companies: ["RADIUM", "T-CARS"],

  // Body výstupní kontroly (každý ANO / NE)
  checklist: [
    "Nastavení servisní konfigurace",
    "Test GPS signálu",
    "Test GSM/GPRS signálu a připojení",
    "Test vstupů, výstupů, snímačů",
    "Test průtokoměru",
    "Kontrola funkčnosti hladinoměru",
    "Kontrola funkčnosti FMS",
    "Test ostatních periférií CI, CT",
    "Vymazání Flash paměti",
    "Test funkčnosti el. zařízení vozidla",
    "Kontrola vozidla řidičem"
  ]
};
