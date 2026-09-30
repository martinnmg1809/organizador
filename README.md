# Organizador de espacios

Calcula la mejor forma de colocar cajas rectangulares dentro de un espacio (contenedor)
y la muestra en 3D y por capas.

## Cómo usarlo

**En línea:** <https://martinnmg1809.github.io/organizador/> — funciona en el ordenador,
la tablet o el móvil, sin instalar nada.

**Idiomas:** español, inglés y portugués de Brasil (selector arriba a la derecha). Para
compartir un enlace en un idioma concreto: `?lang=es`, `?lang=en` o `?lang=pt-BR`
(por ejemplo <https://martinnmg1809.github.io/organizador/?lang=en>).

**Sin conexión:** abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge o Firefox).
No hace falta instalar nada, ni un servidor, ni conexión a internet.

La carpeta es autocontenida: puedes copiarla o moverla a donde quieras (otro PC, un USB…)
siempre que mantengas juntos `index.html`, `css/` y `js/`.

## Funciones

- **Contenedor**: ancho (X), alto (Y) y fondo (Z), en mm, cm, m o pulgadas.
- **Tipos de caja**: medidas, color, rotación permitida (libre, solo girar sobre la base
  o sin rotar), cantidad y opción **No apilable**: no se coloca nada encima de esas cajas
  (la columna sobre ellas queda libre hasta el techo), aunque ellas sí pueden ir encima
  de otras. Para cajas frágiles que además deban ir de pie, combínalo con
  "Solo girar sobre la base".
- **Carga máxima encima** (por tipo de caja, en kg): el peso que puede soportar una caja
  sobre ella. El peso baja en cascada por contacto (repartido según el área de apoyo), así
  que una caja de abajo carga con todo lo que tiene encima, no solo con la que la toca.
  Ninguna caja supera su límite y el tooltip muestra la carga que soporta cada una.
  Requiere indicar el peso de las cajas.
- **Peso**: cada tipo de caja puede tener un peso (kg) y el contenedor un **peso máximo** y
  una **tara** (su peso vacío). Botones rápidos con los límites legales de carga manual en
  Chile: **25 kg** (Código del Trabajo, art. 211-H) y **20 kg** para mujeres y menores de
  18 años (art. 211-J); las trabajadoras embarazadas no pueden realizar carga manual
  (art. 211-I). El cálculo:
  - nunca supera el peso disponible (máximo − tara) y elige las cajas que más aportan por kg;
  - coloca las cajas más densas abajo y, entre soluciones igual de buenas, prefiere la de
    centro de gravedad más bajo y centrado (más estable y cómoda de cargar);
  - muestra el peso total, el peso de cada capa y el centro de gravedad (marca «CG» en 3D).
- **Modos**
  - *Maximizar cantidad*: mete tantas cajas como quepan (el campo "Máximo" es opcional).
  - *Cantidad fija*: intenta colocar las cantidades indicadas y, si caben todas,
    busca la colocación más baja y compacta.
- **Varios contenedores** (todos iguales, con el mismo límite de peso cada uno):
  - *Cantidad fija → Calcular cuántos hacen falta*: reparte las cajas pedidas y dice cuántos
    contenedores se necesitan, comparándolo con el mínimo teórico por volumen y peso.
  - *Cantidad fija → Número fijo*: reparte las cajas en *n* contenedores y avisa de las que
    no caben.
  - *Maximizar → n contenedores*: cuántas cajas caben en *n* contenedores.
  - Los contenedores con la misma distribución se agrupan («1–3, 3 iguales»); un selector
    permite ver cada contenedor en 3D y por capas, y el PDF incluye las páginas de cada
    distribución distinta.
- **Priorizar**: número de cajas o volumen ocupado.
- **Apoyo mínimo**: exige que cada caja apoye un porcentaje de su base (evita cajas "flotando").
- **Vista 3D**: arrastra para girar, rueda para zoom, clic derecho o Mayús + arrastrar
  para desplazar y doble clic para centrar. Al pasar el ratón por una caja se ven sus datos.
- **Vista por capas** en los 3 ejes (horizontales Y, frontales Z, laterales X): corte 2D
  de la capa, con las cajas que vienen de capas anteriores rayadas. En 3D, la capa
  seleccionada se resalta y el resto se atenúa (opacidad ajustable). Las flechas del teclado
  recorren las capas.
- **Exportar** (botón junto a las capas):
  - *PDF con todas las capas*: portada con el resumen y la vista 3D, y una página por capa
    con el corte acotado, la vista 3D de esa capa (las anteriores en gris) y la lista de
    cajas que hay que colocar. Listo para imprimir como instrucciones de montaje.
  - *PNG de la capa actual*: la misma página, como imagen.
  - *PNG de la vista 3D* tal como se ve en pantalla.
- **Idiomas**: toda la interfaz, los avisos, los diagramas y el PDF están en español, inglés
  y portugués de Brasil, con el formato de números y fechas de cada idioma.
- **Guardar / Abrir** proyectos como archivo `.json`. La última configuración también se
  recuerda automáticamente en el navegador.

## Estructura

```
index.html        Página principal
css/styles.css    Estilos (tema claro y oscuro automático)
js/packer.js      Motor de empaquetado 3D
js/viewer3d.js    Visor 3D (WebGL, sin librerías externas)
js/layerview.js   Vista 2D por capas (el mismo dibujo sirve para pantalla, PNG y PDF)
js/pdf.js         Generador de PDF propio (vectorial, sin dependencias)
js/export.js      Exportación de capas a PDF / PNG
js/i18n.js        Traducciones (es, en, pt-BR)
js/app.js         Interfaz y coordinación
tools/version-assets.js  Añade ?v=<huella> a los CSS/JS de index.html
```

## Publicar cambios

Antes de cada commit que se vaya a publicar en GitHub Pages:

```
node tools/version-assets.js
```

Así cada archivo modificado tiene una URL nueva y los navegadores no usan la versión
antigua que tengan en caché.

## Cómo calcula

1. **Programación dinámica guillotina** (modo maximizar): obtiene la mejor colocación
   entre las que se pueden separar con cortes rectos, probando todas las orientaciones.
2. **Búsqueda GRASP con espacios máximos**: construye miles de soluciones colocando bloques
   de cajas en el hueco más bajo y conserva la mejor. Parte de las iteraciones reconstruyen
   solo el final de la mejor solución para mejorarla.

Con varios contenedores, se llenan uno tras otro con lo que queda por colocar; si la
distribución de un contenedor sigue sirviendo, se reutiliza sin recalcular.

Después, las cajas se "dejan caer" (gravedad) y se comprueba el apoyo mínimo. El cálculo se
ejecuta en segundo plano (Web Worker) para que la página no se congele.
