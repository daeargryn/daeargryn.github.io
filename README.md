# I miei tool

Sito personale pubblicato con GitHub Pages.

```
index.html        home con l'elenco dei tool
bus/index.html    orari linee 136 · 138 · 157 (Cosenza – Rende – Unical)
.nojekyll         pubblica i file così come sono, senza elaborazione Jekyll
```

## Aggiungere un tool

1. Crea una cartella con il nome del tool, es. `meteo/`, e mettici dentro `index.html`.
2. Nella home (`index.html`) copia un blocco `<a class="tool">` e cambia `href="meteo/"`, nome e descrizione.
3. Fai commit e push: dopo un minuto è online su `.../meteo/`.

## Note

- La pagina Bus usa la posizione solo dal sito in https (non funziona aprendo il file dal telefono).
- Gli orari vengono dai quadri feriali della Regione Calabria: vanno aggiornati quando cambia il periodo.
