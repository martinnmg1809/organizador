# Organizador de espacios

Calcula la mejor forma de colocar cajas rectangulares dentro de un espacio (contenedor)
y la muestra en 3D y por capas.

## Cómo usarlo

**En línea:** <https://martinnmg1809.github.io/organizador/> — funciona en el ordenador,
la tablet o el móvil, sin instalar nada.

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
- **Modos**
  - *Maximizar cantidad*: mete tantas cajas como quepan (el campo "Máximo" es opcional).
  - *Cantidad fija*: intenta colocar las cantidades indicadas y, si caben todas,
    busca la colocación más baja y compacta.
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
js/app.js         Interfaz y coordinación
```

## Cómo calcula

1. **Programación dinámica guillotina** (modo maximizar): obtiene la mejor colocación
   entre las que se pueden separar con cortes rectos, probando todas las orientaciones.
2. **Búsqueda GRASP con espacios máximos**: construye miles de soluciones colocando bloques
   de cajas en el hueco más bajo y conserva la mejor. Parte de las iteraciones reconstruyen
   solo el final de la mejor solución para mejorarla.

Después, las cajas se "dejan caer" (gravedad) y se comprueba el apoyo mínimo. El cálculo se
ejecuta en segundo plano (Web Worker) para que la página no se congele.
