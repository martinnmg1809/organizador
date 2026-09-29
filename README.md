# Organizador de espacios

Calcula la mejor forma de colocar cajas rectangulares dentro de un espacio (contenedor)
y la muestra en 3D y por capas.

## Cómo usarlo

Abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge o Firefox).
No hace falta instalar nada, ni un servidor, ni conexión a internet.

La carpeta es autocontenida: puedes copiarla o moverla a donde quieras (otro PC, un USB…)
siempre que mantengas juntos `index.html`, `css/` y `js/`.

## Funciones

- **Contenedor**: ancho (X), alto (Y) y fondo (Z), en mm, cm, m o pulgadas.
- **Tipos de caja**: medidas, color, rotación permitida (libre, solo girar sobre la base
  o sin rotar) y cantidad.
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
- **Guardar / Abrir** proyectos como archivo `.json`. La última configuración también se
  recuerda automáticamente en el navegador.

## Estructura

```
index.html        Página principal
css/styles.css    Estilos (tema claro y oscuro automático)
js/packer.js      Motor de empaquetado 3D
js/viewer3d.js    Visor 3D (WebGL, sin librerías externas)
js/layerview.js   Vista 2D por capas
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
