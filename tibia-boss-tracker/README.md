# Tibia Boss Tracker

Sitio estático + un script que corre una vez por día. No hace falta servidor.

```
index.html              front (lee bosses.json y data/history.json)
bosses.json             bosses trackeables: nombre en la API, días de ventana, fuente
data/history.json       última vez que se vio cada boss en cada mundo (lo escribe el script)
scripts/update.mjs      consulta TibiaData y actualiza history.json
.github/workflows/      cron 23:30 hora Buenos Aires (02:30 UTC)
```

## Por qué hay un "back" (aunque chico)

La API solo devuelve las kills del último día y la última semana. Para saber
"cuándo fue la última vez" hay que ir guardando un historial. Ese es el único
trabajo del script: cada noche mira los ~100 mundos y anota fecha y mundo donde
murió el boss.

## Puesta en marcha

1. Subí esta carpeta a un repo de GitHub.
2. Activá GitHub Pages (Settings → Pages → rama `main`, carpeta raíz).
3. Corré el workflow una vez a mano (Actions → "Actualizar boss stats" → Run workflow).
4. Local: `node scripts/update.mjs` y servilo con `npx serve .` (el front usa `fetch`,
   no funciona abriendo el .html con doble clic).

El botón "Refrescar datos" vuelve a leer `history.json` (el sitio no consulta
la API directamente: son ~100 requests pesados por mundo).

## Agregar un boss

Una entrada nueva en `bosses.json`. `aliases` va en minúsculas y es el nombre
tal como aparece en kill statistics. `days: null` = sin ventana conocida.

## Ajuste a verificar

En `scripts/update.mjs`, `STATS_DAY_OFFSET = 1` asume que a las 23:30 las stats
reflejan el día anterior. Si ves que las fechas quedan corridas un día, ponelo en 0.

## Más adelante: bosses no trackeables (Orc Hills)

Usar `"source": "manual"` en `bosses.json`. El script ya ignora esos bosses; falta
un input en el front que escriba la fecha (en el navegador con localStorage, o en
`history.json` vía un pequeño endpoint si querés compartirlo).
