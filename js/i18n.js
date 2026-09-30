/*
 * Organizador de espacios — traducciones (español, inglés, portugués de Brasil).
 *
 * Cada entrada es [es, en, pt-BR]. Un texto puede ser una cadena con marcadores
 * {nombre} o una función (p) => cadena para los plurales.
 *
 * En el HTML: data-i18n="clave" (texto), data-i18n-html (HTML), data-i18n-title,
 * data-i18n-aria (aria-label) y data-i18n-placeholder.
 */
(function (root) {
  'use strict';

  const LANGS = [
    { code: 'es', name: 'Español', locale: 'es-ES' },
    { code: 'en', name: 'English', locale: 'en-US' },
    { code: 'pt-BR', name: 'Português (BR)', locale: 'pt-BR' }
  ];
  const IDX = { es: 0, en: 1, 'pt-BR': 2 };
  const pl = (n, one, many) => (n === 1 ? one : many);

  const D = {
    // ---- General ------------------------------------------------------------
    'app.title': ['Organizador de espacios', 'Space Organizer', 'Organizador de Espaços'],
    'app.description': ['Calcula la mejor forma de colocar cajas dentro de un espacio y visualízala en 3D y por capas.',
      'Work out the best way to fit boxes into a space and see it in 3D and layer by layer.',
      'Calcule a melhor forma de colocar caixas em um espaço e veja em 3D e por camadas.'],
    'lang.label': ['Idioma', 'Language', 'Idioma'],
    'top.example': ['Ejemplo', 'Example', 'Exemplo'],
    'top.example.title': ['Cargar la configuración de ejemplo', 'Load the example setup', 'Carregar a configuração de exemplo'],
    'top.open': ['Abrir', 'Open', 'Abrir'],
    'top.open.title': ['Abrir un proyecto guardado (.json)', 'Open a saved project (.json)', 'Abrir um projeto salvo (.json)'],
    'top.save': ['Guardar', 'Save', 'Salvar'],
    'top.save.title': ['Guardar el proyecto en un archivo .json', 'Save the project to a .json file', 'Salvar o projeto em um arquivo .json'],
    'panel.aria': ['Configuración', 'Settings', 'Configuração'],
    'workspace.aria': ['Visualización', 'Visualization', 'Visualização'],

    // ---- Contenedor -------------------------------------------------------------
    'c.title': ['Contenedor', 'Container', 'Contêiner'],
    'c.unit': ['Unidad', 'Unit', 'Unidade'],
    'unit.in': ['pulgadas', 'inches', 'polegadas'],
    'dim.w': ['Ancho', 'Width', 'Largura'],
    'dim.h': ['Alto', 'Height', 'Altura'],
    'dim.d': ['Fondo', 'Depth', 'Profundidade'],
    'dims.whd': ['ancho × alto × fondo', 'width × height × depth', 'largura × altura × profundidade'],
    'dims.short': ['an × al × fo', 'w × h × d', 'l × a × p'],
    'c.vol': ['Volumen: {v} {u}³ ({m})', 'Volume: {v} {u}³ ({m})', 'Volume: {v} {u}³ ({m})'],
    'c.volEmpty': ['Introduce las medidas del contenedor.', 'Enter the container dimensions.', 'Informe as medidas do contêiner.'],
    'c.maxw': ['Peso máximo', 'Max. weight', 'Peso máximo'],
    'c.tare': ['Tara (vacío)', 'Tare (empty)', 'Tara (vazio)'],
    'c.tare.title': ['Peso del contenedor vacío, que también se carga', 'Weight of the empty container, which is also carried', 'Peso do contêiner vazio, que também é carregado'],
    'noLimit': ['Sin límite', 'No limit', 'Sem limite'],
    'w.presets.aria': ['Límites legales de carga manual en Chile', 'Legal manual handling limits in Chile', 'Limites legais de carga manual no Chile'],
    'w.presets.label': ['Carga manual en Chile:', 'Manual handling in Chile:', 'Carga manual no Chile:'],
    'w.p25': ['25 kg · general', '25 kg · general', '25 kg · geral'],
    'w.p25.title': ['Código del Trabajo, art. 211-H: máximo para trabajadores en general',
      'Chilean Labour Code, art. 211-H: maximum for workers in general',
      'Código do Trabalho do Chile, art. 211-H: máximo para trabalhadores em geral'],
    'w.p20': ['20 kg · mujeres y menores de 18', '20 kg · women and under-18s', '20 kg · mulheres e menores de 18'],
    'w.p20.title': ['Código del Trabajo, art. 211-J: máximo para mujeres y menores de 18 años',
      'Chilean Labour Code, art. 211-J: maximum for women and workers under 18',
      'Código do Trabalho do Chile, art. 211-J: máximo para mulheres e menores de 18 anos'],
    'w.pnone.title': ['Quitar el límite de peso', 'Remove the weight limit', 'Remover o limite de peso'],
    'w.info.noLimit': ['Sin límite de peso: se calculará el peso total y el centro de gravedad.',
      'No weight limit: total weight and centre of gravity will be calculated.',
      'Sem limite de peso: serão calculados o peso total e o centro de gravidade.'],
    'w.info.noWeights': ['Indica el peso de cada caja para calcular el peso total y el centro de gravedad.',
      'Enter the weight of each box to calculate total weight and centre of gravity.',
      'Informe o peso de cada caixa para calcular o peso total e o centro de gravidade.'],
    'w.info.cap': ['Disponible para las cajas: {cap}.', 'Available for boxes: {cap}.', 'Disponível para as caixas: {cap}.'],
    'w.info.capTare': ['Disponible para las cajas: {cap} ({max} − {tare} de tara).', 'Available for boxes: {cap} ({max} − {tare} tare).', 'Disponível para as caixas: {cap} ({max} − {tare} de tara).'],
    'w.info.needWeights': [' Indica el peso de cada caja para aplicar el límite.', ' Enter the weight of each box to apply the limit.', ' Informe o peso de cada caixa para aplicar o limite.'],

    // ---- Tipos de caja ------------------------------------------------------------
    'types.title': ['Tipos de caja', 'Box types', 'Tipos de caixa'],
    'types.add': ['+ Añadir', '+ Add', '+ Adicionar'],
    'type.color': ['Color', 'Colour', 'Cor'],
    'type.name': ['Nombre', 'Name', 'Nome'],
    'type.use.title': ['Incluir este tipo en el cálculo', 'Include this type in the calculation', 'Incluir este tipo no cálculo'],
    'type.use': ['Usar', 'Use', 'Usar'],
    'type.del': ['Eliminar', 'Delete', 'Excluir'],
    'type.qtyFixed': ['Cantidad', 'Quantity', 'Quantidade'],
    'type.qtyMax': ['Máximo', 'Maximum', 'Máximo'],
    'type.weight': ['Peso (kg)', 'Weight (kg)', 'Peso (kg)'],
    'type.weight.title': ['Peso de una caja en kg', 'Weight of one box in kg', 'Peso de uma caixa em kg'],
    'type.rot': ['Rotación', 'Rotation', 'Rotação'],
    'rot.all': ['Libre', 'Free', 'Livre'],
    'rot.upright': ['Sobre su base', 'On its base', 'Sobre a base'],
    'rot.none': ['Sin rotar', 'No rotation', 'Sem girar'],
    'type.maxLoad': ['Carga máx. encima (kg)', 'Max. load on top (kg)', 'Carga máx. por cima (kg)'],
    'type.maxLoad.title': ['Peso máximo que puede soportar encima una caja de este tipo (incluidas las que tenga apiladas sobre ella). Vacío = sin límite.',
      'Maximum weight a box of this type can bear on top (including everything stacked above it). Empty = no limit.',
      'Peso máximo que uma caixa deste tipo pode suportar por cima (incluindo tudo o que estiver empilhado sobre ela). Vazio = sem limite.'],
    'type.warn.loadNoWeight': ['Indica el peso de las cajas para que se aplique la carga máxima.', 'Enter the box weights so the max. load can be applied.', 'Informe o peso das caixas para que a carga máxima seja aplicada.'],
    'tag.maxLoad': ['aguanta {w}', 'holds {w}', 'suporta {w}'],
    'tag.maxLoad.title': ['Carga máxima que soporta encima', 'Maximum load it can bear on top', 'Carga máxima que suporta por cima'],
    'tip.load': ['Carga encima: {l}', 'Load on top: {l}', 'Carga por cima: {l}'],
    'tip.loadOf': [' (máx. {m})', ' (max. {m})', ' (máx. {m})'],
    'pdf.maxLoad': [' · aguanta {w} encima', ' · holds {w} on top', ' · suporta {w} por cima'],
    'type.noStack': ['No apilable (nada encima)', 'Not stackable (nothing on top)', 'Não empilhável (nada por cima)'],
    'type.noStack.title': ['No se colocará ninguna caja encima de las de este tipo', 'No box will be placed on top of boxes of this type', 'Nenhuma caixa será colocada sobre as caixas deste tipo'],
    'type.warn.dims': ['Las medidas deben ser mayores que 0.', 'Dimensions must be greater than 0.', 'As medidas devem ser maiores que 0.'],
    'type.warn.noFitAll': ['No cabe en el contenedor en ninguna orientación.', 'Does not fit in the container in any orientation.', 'Não cabe no contêiner em nenhuma orientação.'],
    'type.warn.noFitRot': ['No cabe con las rotaciones permitidas.', 'Does not fit with the allowed rotations.', 'Não cabe com as rotações permitidas.'],
    'type.warn.heavy': ['Pesa más que el peso disponible ({cap}): no se podrá incluir.', 'Heavier than the available weight ({cap}): it cannot be included.', 'Pesa mais que o peso disponível ({cap}): não poderá ser incluída.'],
    'type.defaultName': ['Caja {n}', 'Box {n}', 'Caixa {n}'],
    'ex.big': ['Caja grande', 'Large box', 'Caixa grande'],
    'ex.medium': ['Caja mediana', 'Medium box', 'Caixa média'],
    'ex.small': ['Caja pequeña', 'Small box', 'Caixa pequena'],

    // ---- Objetivo -----------------------------------------------------------------
    'obj.title': ['Objetivo', 'Goal', 'Objetivo'],
    'mode.aria': ['Modo', 'Mode', 'Modo'],
    'mode.max': ['Maximizar cantidad', 'Maximize quantity', 'Maximizar quantidade'],
    'mode.fixed': ['Cantidad fija', 'Fixed quantity', 'Quantidade fixa'],
    'bins.label': ['Contenedores', 'Containers', 'Contêineres'],
    'bins.auto': ['Calcular cuántos hacen falta', 'Work out how many are needed', 'Calcular quantos são necessários'],
    'bins.n': ['Número fijo', 'Fixed number', 'Número fixo'],
    'bins.nLabel': ['Número de contenedores', 'Number of containers', 'Número de contêineres'],
    'hint.fixedAuto': ['Indica cuántas cajas de cada tipo necesitas: se calculará cuántos contenedores hacen falta y cómo va cada uno.',
      'Enter how many boxes of each type you need: it will work out how many containers are needed and how to load each one.',
      'Informe quantas caixas de cada tipo você precisa: será calculado quantos contêineres são necessários e como fica cada um.'],
    'hint.fixedN': ['Indica cuántas cajas de cada tipo necesitas: se repartirán en los contenedores indicados y se avisará de las que no quepan.',
      'Enter how many boxes of each type you need: they will be split across the given containers and you will be told which ones do not fit.',
      'Informe quantas caixas de cada tipo você precisa: serão distribuídas nos contêineres indicados e você será avisado das que não couberem.'],
    'hint.maxN': ['Coloca tantas cajas como quepan en los contenedores indicados. Deja "Máximo" vacío para no limitar un tipo.',
      'Fits as many boxes as possible in the given containers. Leave "Maximum" empty to not limit a type.',
      'Coloca o máximo de caixas possível nos contêineres indicados. Deixe "Máximo" vazio para não limitar um tipo.'],
    'hint.max': ['Coloca tantas cajas como quepan. Deja "Máximo" vacío para no limitar un tipo.',
      'Fits as many boxes as possible. Leave "Maximum" empty to not limit a type.',
      'Coloca o máximo de caixas possível. Deixe "Máximo" vazio para não limitar um tipo.'],
    'obj.prio': ['Priorizar', 'Prioritize', 'Priorizar'],
    'obj.prioFixed': ['Si no caben, priorizar', "If they don't fit, prioritize", 'Se não couberem, priorizar'],
    'obj.count': ['Número de cajas', 'Number of boxes', 'Número de caixas'],
    'obj.volume': ['Volumen ocupado', 'Volume used', 'Volume ocupado'],
    'sup.label': ['Apoyo mínimo', 'Minimum support', 'Apoio mínimo'],
    'sup.none': ['Sin restricción', 'No restriction', 'Sem restrição'],
    'sup.pct': ['{p} % de la base', '{p}% of the base', '{p}% da base'],
    'time.label': ['Tiempo de búsqueda', 'Search time', 'Tempo de busca'],
    'time.fast': ['1 s (rápido)', '1 s (fast)', '1 s (rápido)'],
    'time.thorough': ['30 s (exhaustivo)', '30 s (thorough)', '30 s (exaustivo)'],
    'run.go': ['Calcular distribución', 'Calculate layout', 'Calcular distribuição'],
    'run.stop': ['Detener', 'Stop', 'Parar'],
    'run.preparing': ['Preparando…', 'Preparing…', 'Preparando…'],
    'run.progress': ['Buscando… {s} s · mejor: {n} cajas ({p})', 'Searching… {s} s · best: {n} boxes ({p})', 'Buscando… {s} s · melhor: {n} caixas ({p})'],
    'run.progressMulti': ['Buscando… {s} s · contenedor {bin} · {n} cajas colocadas', 'Searching… {s} s · container {bin} · {n} boxes placed', 'Buscando… {s} s · contêiner {bin} · {n} caixas colocadas'],
    'err.container': ['Las medidas del contenedor deben ser mayores que 0.', 'Container dimensions must be greater than 0.', 'As medidas do contêiner devem ser maiores que 0.'],
    'err.noTypes': ['Añade o activa al menos un tipo de caja.', 'Add or enable at least one box type.', 'Adicione ou ative pelo menos um tipo de caixa.'],
    'err.dims': ['Revisa las medidas de las cajas: deben ser mayores que 0.', 'Check the box dimensions: they must be greater than 0.', 'Revise as medidas das caixas: devem ser maiores que 0.'],
    'err.tare': ['La tara del contenedor es igual o mayor que el peso máximo: no queda peso disponible para las cajas.',
      'The container tare is equal to or greater than the max. weight: there is no weight left for boxes.',
      'A tara do contêiner é igual ou maior que o peso máximo: não sobra peso para as caixas.'],
    'err.fixedQty': ['En modo "Cantidad fija" indica cuántas cajas quieres de al menos un tipo.',
      'In "Fixed quantity" mode, enter how many boxes you want of at least one type.',
      'No modo "Quantidade fixa", informe quantas caixas você quer de pelo menos um tipo.'],

    // ---- Resultado ------------------------------------------------------------------
    'res.title': ['Resultado', 'Result', 'Resultado'],
    'res.stale': ['Desactualizado', 'Out of date', 'Desatualizado'],
    'res.empty': ['Configura el contenedor y las cajas y pulsa <b>Calcular distribución</b>.',
      'Set up the container and boxes and press <b>Calculate layout</b>.',
      'Configure o contêiner e as caixas e clique em <b>Calcular distribuição</b>.'],
    'kpi.bins': [p => pl(p.n, 'contenedor', 'contenedores'), p => pl(p.n, 'container', 'containers'), p => pl(p.n, 'contêiner', 'contêineres')],
    'kpi.total': ['cajas en total', 'boxes in total', 'caixas no total'],
    'kpi.avg': ['ocupación media', 'average fill', 'ocupação média'],
    'kpi.placed': ['cajas colocadas', 'boxes placed', 'caixas colocadas'],
    'kpi.vol': ['del volumen ocupado', 'of the volume used', 'do volume ocupado'],
    'kpi.volShort': ['del volumen', 'of the volume', 'do volume'],
    'kpi.maxOf': ['de {w} kg máx.', 'of {w} kg max.', 'de {w} kg máx.'],
    'kpi.totalW': ['peso total', 'total weight', 'peso total'],
    'kpi.boxesW': ['peso de las cajas', 'weight of boxes', 'peso das caixas'],
    'kpi.height': ['de altura usada (de {h})', 'height used (of {h})', 'de altura usada (de {h})'],
    'kpi.heightShort': ['altura (de {h})', 'height (of {h})', 'altura (de {h})'],
    'th.type': ['Tipo', 'Type', 'Tipo'],
    'th.dims': ['Medidas', 'Size', 'Medidas'],
    'th.total': ['Total', 'Total', 'Total'],
    'th.placed': ['Colocadas', 'Placed', 'Colocadas'],
    'th.req': ['Pedidas', 'Requested', 'Pedidas'],
    'th.max': ['Máx.', 'Max.', 'Máx.'],
    'th.no': ['Nº', 'No.', 'Nº'],
    'th.boxes': ['Cajas', 'Boxes', 'Caixas'],
    'th.fill': ['Ocupación', 'Fill', 'Ocupação'],
    'th.weight': ['Peso', 'Weight', 'Peso'],
    'tag.noStack': ['no apilable', 'not stackable', 'não empilhável'],
    'tag.noStack.title': ['No apilable: nada encima', 'Not stackable: nothing on top', 'Não empilhável: nada por cima'],
    'tag.same': ['{k} iguales', '{k} identical', '{k} iguais'],
    'each': ['c/u', 'each', 'cada'],
    'bin.row.title': ['Ver este contenedor', 'View this container', 'Ver este contêiner'],
    'note.noFit': ['{name} no cabe en el contenedor con las rotaciones permitidas.', '{name} does not fit in the container with the allowed rotations.', '{name} não cabe no contêiner com as rotações permitidas.'],
    'note.tooHeavy': ['{name} pesa {w}, más que el peso disponible ({cap}): no se puede incluir.', '{name} weighs {w}, more than the available weight ({cap}): it cannot be included.', '{name} pesa {w}, mais que o peso disponível ({cap}): não pode ser incluída.'],
    'note.unplaced': ['No se han podido colocar {n} × {name}{where}{why}.', 'Could not place {n} × {name}{where}{why}.', 'Não foi possível colocar {n} × {name}{where}{why}.'],
    'note.whereOne': [' en el contenedor', ' in the container', ' no contêiner'],
    'note.whereN': [' en los {n} contenedores', ' in the {n} containers', ' nos {n} contêineres'],
    'note.whyWeight': [' por el límite de peso', ' because of the weight limit', ' pelo limite de peso'],
    'note.whySpace': [' por falta de espacio', ' for lack of space', ' por falta de espaço'],
    'note.needBins': [
      p => `Hacen falta <b>${p.n} ${pl(p.c, 'contenedor', 'contenedores')}</b> para las ${p.total} cajas.`,
      p => `<b>${p.n} ${pl(p.c, 'container is', 'containers are')}</b> needed for the ${p.total} boxes.`,
      p => `São necessários <b>${p.n} ${pl(p.c, 'contêiner', 'contêineres')}</b> para as ${p.total} caixas.`],
    'note.isMin': ['Es el mínimo posible: no se puede hacer con menos contenedores.', 'This is the minimum possible: it cannot be done with fewer containers.', 'É o mínimo possível: não dá para fazer com menos contêineres.'],
    'note.lowerBound': ['Mínimo teórico por {bound}: {lb}. Con cajas enteras no siempre se alcanza: la mejor distribución encontrada necesita {n}.',
      'Theoretical minimum by {bound}: {lb}. With whole boxes it is not always reachable: the best layout found needs {n}.',
      'Mínimo teórico por {bound}: {lb}. Com caixas inteiras nem sempre é alcançável: a melhor distribuição encontrada precisa de {n}.'],
    'bound.vol': ['volumen', 'volume', 'volume'],
    'bound.volW': ['volumen y peso', 'volume and weight', 'volume e peso'],
    'note.notAll': ['No se han podido colocar todas las cajas (ver avisos).', 'Not all boxes could be placed (see warnings).', 'Não foi possível colocar todas as caixas (veja os avisos).'],
    'note.allInN': ['Caben todas las cajas en {n} contenedores.', 'All boxes fit in {n} containers.', 'Todas as caixas cabem em {n} contêineres.'],
    'note.allFit': ['Caben todas las cajas solicitadas.', 'All requested boxes fit.', 'Todas as caixas pedidas cabem.'],
    'note.tryAuto': ['Elige «Calcular cuántos hacen falta» para saber cuántos contenedores necesitas.', 'Choose "Work out how many are needed" to find out how many containers you need.', 'Escolha "Calcular quantos são necessários" para saber quantos contêineres você precisa.'],
    'note.inN': [
      p => `En ${p.n} ${pl(p.c, 'contenedor caben', 'contenedores caben')} ${p.total} cajas${p.each ? ` (${p.each} en cada uno)` : ''}.`,
      p => `${p.total} boxes fit in ${p.n} ${pl(p.c, 'container', 'containers')}${p.each ? ` (${p.each} in each)` : ''}.`,
      p => `Em ${p.n} ${pl(p.c, 'contêiner cabem', 'contêineres cabem')} ${p.total} caixas${p.each ? ` (${p.each} em cada um)` : ''}.`],
    'note.onlyUsed': ['Solo se han usado {n} de {target} contenedores: no hay más cajas que colocar.', 'Only {n} of {target} containers were used: there are no more boxes to place.', 'Só foram usados {n} de {target} contêineres: não há mais caixas para colocar.'],
    'note.weightBinds': ['El límite de peso es lo que limita la carga (quedan {left} libres).', 'The weight limit is what limits the load ({left} left).', 'O limite de peso é o que limita a carga (restam {left} livres).'],
    'note.optimal': ['Solución óptima: se ha alcanzado el máximo teórico.', 'Optimal solution: the theoretical maximum has been reached.', 'Solução ótima: o máximo teórico foi alcançado.'],
    'note.maxBound': ['Máximo teórico por {bound}: {n} cajas (rara vez alcanzable).', 'Theoretical maximum by {bound}: {n} boxes (rarely reachable).', 'Máximo teórico por {bound}: {n} caixas (raramente alcançável).'],
    'note.grouped': ['Hay muchas cajas: se muestran agrupadas en {n} bloques.', 'There are many boxes: they are shown grouped into {n} blocks.', 'Há muitas caixas: são mostradas agrupadas em {n} blocos.'],
    'note.stopped': ['Búsqueda detenida manualmente: se muestra la mejor solución encontrada.', 'Search stopped manually: showing the best solution found.', 'Busca interrompida manualmente: mostrando a melhor solução encontrada.'],
    'res.binsTitle': ['Contenedores', 'Containers', 'Contêineres'],
    'res.binTitle': ['Contenedor {k}', 'Container {k}', 'Contêiner {k}'],
    'res.binTitleOf': ['Contenedor {k} de {n}', 'Container {k} of {n}', 'Contêiner {k} de {n}'],
    'res.boxesDot': ['{n} cajas · ', '{n} boxes · ', '{n} caixas · '],
    'res.volLine': ['{v} de {V} ({p}) · altura usada {top} {u} de {H} {u}', '{v} of {V} ({p}) · height used {top} {u} of {H} {u}', '{v} de {V} ({p}) · altura usada {top} {u} de {H} {u}'],
    'res.meta': [
      p => `${p.it} ${pl(p.c, 'combinación evaluada', 'combinaciones evaluadas')} en ${p.s} s · contenedor ${p.dims}`,
      p => `${p.it} ${pl(p.c, 'combination', 'combinations')} evaluated in ${p.s} s · container ${p.dims}`,
      p => `${p.it} ${pl(p.c, 'combinação avaliada', 'combinações avaliadas')} em ${p.s} s · contêiner ${p.dims}`],
    'w.line': ['Peso: {w} de cajas', 'Weight: {w} of boxes', 'Peso: {w} de caixas'],
    'w.lineTare': [' + {t} de tara = {tot}', ' + {t} tare = {tot}', ' + {t} de tara = {tot}'],
    'w.lineMax': [' · {p} del máximo ({max})', ' · {p} of the maximum ({max})', ' · {p} do máximo ({max})'],
    'cog.line': ['Centro de gravedad a {y} {u} de altura ({p} del alto) · ', 'Centre of gravity at {y} {u} height ({p} of the height) · ', 'Centro de gravidade a {y} {u} de altura ({p} da altura) · '],
    'cog.centered': ['centrado', 'centred', 'centralizado'],
    'cog.off': ['desviado {off} {u} del centro', '{off} {u} off centre', 'deslocado {off} {u} do centro'],

    // ---- Vistas y capas -----------------------------------------------------------------
    'view.aria': ['Vista', 'View', 'Visualização'],
    'view.split': ['Dividida', 'Split', 'Dividida'],
    'view.2d': ['Capas 2D', '2D layers', 'Camadas 2D'],
    'layers.label': ['Capas', 'Layers', 'Camadas'],
    'axis.aria': ['Dirección de las capas', 'Layer direction', 'Direção das camadas'],
    'axis.y.btn': ['Horizontales · Y', 'Horizontal · Y', 'Horizontais · Y'],
    'axis.z.btn': ['Frontales · Z', 'Front · Z', 'Frontais · Z'],
    'axis.x.btn': ['Laterales · X', 'Side · X', 'Laterais · X'],
    'axis.y.title': ['Capas horizontales, de abajo arriba (vista superior)', 'Horizontal layers, bottom to top (top view)', 'Camadas horizontais, de baixo para cima (vista superior)'],
    'axis.z.title': ['Capas verticales de atrás hacia delante (vista frontal)', 'Vertical layers, back to front (front view)', 'Camadas verticais de trás para frente (vista frontal)'],
    'axis.x.title': ['Capas verticales de izquierda a derecha (vista lateral)', 'Vertical layers, left to right (side view)', 'Camadas verticais da esquerda para a direita (vista lateral)'],
    'axis.y.name': ['Capas horizontales (Y)', 'Horizontal layers (Y)', 'Camadas horizontais (Y)'],
    'axis.z.name': ['Capas frontales (Z)', 'Front layers (Z)', 'Camadas frontais (Z)'],
    'axis.x.name': ['Capas laterales (X)', 'Side layers (X)', 'Camadas laterais (X)'],
    'axis.y.view': ['Vista superior', 'Top view', 'Vista superior'],
    'axis.z.view': ['Vista frontal', 'Front view', 'Vista frontal'],
    'axis.x.view': ['Vista lateral (desde la izquierda)', 'Side view (from the left)', 'Vista lateral (pela esquerda)'],
    'axis.y.dir': ['de abajo arriba', 'from bottom to top', 'de baixo para cima'],
    'axis.z.dir': ['de atrás hacia delante', 'from back to front', 'de trás para frente'],
    'axis.x.dir': ['de izquierda a derecha', 'from left to right', 'da esquerda para a direita'],
    'bin.label': ['Contenedor', 'Container', 'Contêiner'],
    'bin.prev': ['Contenedor anterior', 'Previous container', 'Contêiner anterior'],
    'bin.next': ['Contenedor siguiente', 'Next container', 'Próximo contêiner'],
    'bin.option': ['Contenedor {k} de {n} · {c} cajas', 'Container {k} of {n} · {c} boxes', 'Contêiner {k} de {n} · {c} caixas'],
    'bin.sameAs': [' (igual que el {k})', ' (same as {k})', ' (igual ao {k})'],
    'bin.info': ['{p} ocupado', '{p} full', '{p} ocupado'],
    'layer.highlight': ['Resaltar capa en 3D', 'Highlight layer in 3D', 'Destacar camada em 3D'],
    'layer.highlight.title': ['Resalta la capa seleccionada en la vista 3D y atenúa el resto', 'Highlights the selected layer in the 3D view and dims the rest', 'Destaca a camada selecionada na vista 3D e esmaece o resto'],
    'layer.prev': ['Capa anterior', 'Previous layer', 'Camada anterior'],
    'layer.next': ['Capa siguiente', 'Next layer', 'Próxima camada'],
    'layer.aria': ['Capa', 'Layer', 'Camada'],
    'layer.label': ['Capa {i} de {n} · {ax} {lo}–{hi} {u}', 'Layer {i} of {n} · {ax} {lo}–{hi} {u}', 'Camada {i} de {n} · {ax} {lo}–{hi} {u}'],
    'layer.noBoxes': ['Sin cajas', 'No boxes', 'Sem caixas'],
    'export.btn': ['Exportar', 'Export', 'Exportar'],
    'export.btn.title': ['Exportar las capas como PDF o imagen', 'Export the layers as PDF or image', 'Exportar as camadas como PDF ou imagem'],
    'cam.front': ['Frente', 'Front', 'Frente'],
    'cam.top': ['Arriba', 'Top', 'Topo'],
    'cam.side': ['Lateral', 'Side', 'Lateral'],
    'ghost.label': ['Otras capas', 'Other layers', 'Outras camadas'],
    'ghost.before': ['Anteriores sólidas', 'Previous solid', 'Anteriores sólidas'],
    'help3d': ['Arrastra: girar · Rueda: zoom · Clic derecho o Mayús: mover · Doble clic: centrar',
      'Drag: rotate · Wheel: zoom · Right-click or Shift: pan · Double-click: reset',
      'Arraste: girar · Roda: zoom · Clique direito ou Shift: mover · Duplo clique: centralizar'],
    'nogl': ['Tu navegador no admite WebGL: la vista 3D no está disponible, pero puedes usar la vista por capas.',
      'Your browser does not support WebGL: the 3D view is not available, but you can use the layer view.',
      'Seu navegador não suporta WebGL: a vista 3D não está disponível, mas você pode usar a vista por camadas.'],
    'v2d.bin': ['Contenedor {k} · ', 'Container {k} · ', 'Contêiner {k} · '],
    'v2d.cut': ['{view} · corte en {ax} = {lo} {u} (capas {dir})', '{view} · cut at {ax} = {lo} {u} (layers {dir})', '{view} · corte em {ax} = {lo} {u} (camadas {dir})'],
    'v2d.pressRun': ['Pulsa «Calcular distribución»', 'Press "Calculate layout"', 'Clique em "Calcular distribuição"'],
    'sum.hint': ['La vista por capas muestra un corte del contenedor. Usa ‹ › o las flechas del teclado para recorrerlas.',
      'The layer view shows a cut through the container. Use ‹ › or the arrow keys to move through them.',
      'A vista por camadas mostra um corte do contêiner. Use ‹ › ou as setas do teclado para percorrê-las.'],
    'sum.new': ['<b>{n}</b> nuevas en esta capa', '<b>{n}</b> new in this layer', '<b>{n}</b> novas nesta camada'],
    'sum.cont': ['<b>{n}</b> vienen de capas anteriores', '<b>{n}</b> from previous layers', '<b>{n}</b> vêm de camadas anteriores'],
    'sum.weight': ['Peso de la capa: <b>{w}</b>', 'Layer weight: <b>{w}</b>', 'Peso da camada: <b>{w}</b>'],
    'sum.thick': ['Espesor hasta la siguiente capa: <b>{t}</b>', 'Thickness to the next layer: <b>{t}</b>', 'Espessura até a próxima camada: <b>{t}</b>'],
    'tip.block': ['Bloque de {n} cajas', 'Block of {n} boxes', 'Bloco de {n} caixas'],
    'tip.lying': ['Tumbada (su alto original no queda vertical)', 'Lying down (its original height is not vertical)', 'Deitada (a altura original não fica na vertical)'],
    'tip.turned': ['Girada 90° sobre su base', 'Turned 90° on its base', 'Girada 90° sobre a base'],
    'tip.pos': ['Posición', 'Position', 'Posição'],
    'tip.weight': ['Peso: {w}', 'Weight: {w}', 'Peso: {w}'],
    'lv.x': ['X · ancho', 'X · width', 'X · largura'],
    'lv.y': ['Y · alto', 'Y · height', 'Y · altura'],
    'lv.z': ['Z · fondo', 'Z · depth', 'Z · profundidade'],
    'lv.down': [' (hacia abajo)', ' (downwards)', ' (para baixo)'],
    'lv.boxes': ['{n} cajas', '{n} boxes', '{n} caixas'],

    // ---- Proyecto -------------------------------------------------------------------------
    'proj.loaded': ['Proyecto «{f}» cargado.', 'Project "{f}" loaded.', 'Projeto "{f}" carregado.'],
    'proj.invalid': ['No se pudo abrir el archivo: no es un proyecto válido.', 'Could not open the file: it is not a valid project.', 'Não foi possível abrir o arquivo: não é um projeto válido.'],
    'proj.confirmExample': ['¿Cargar la configuración de ejemplo? Se perderá la configuración actual si no la has guardado.',
      'Load the example setup? The current setup will be lost if you have not saved it.',
      'Carregar a configuração de exemplo? A configuração atual será perdida se você não a salvou.'],
    'export.needResult': ['Calcula primero una distribución para poder exportarla.', 'Calculate a layout first to be able to export it.', 'Calcule primeiro uma distribuição para poder exportá-la.'],

    // ---- Diálogo de exportación ------------------------------------------------------------------
    'dlg.title': ['Exportar capas', 'Export layers', 'Exportar camadas'],
    'dlg.format': ['Formato', 'Format', 'Formato'],
    'dlg.pdf': ['PDF con todas las capas', 'PDF with all layers', 'PDF com todas as camadas'],
    'dlg.pdf.desc': ['Portada con el resumen y una página por capa, listo para imprimir.', 'Cover page with the summary and one page per layer, ready to print.', 'Capa com o resumo e uma página por camada, pronto para imprimir.'],
    'dlg.pngLayer': ['Imagen PNG de la capa actual', 'PNG image of the current layer', 'Imagem PNG da camada atual'],
    'dlg.pngLayer.desc': ['La misma página que en el PDF, como imagen.', 'The same page as in the PDF, as an image.', 'A mesma página do PDF, como imagem.'],
    'dlg.png3d': ['Imagen PNG de la vista 3D', 'PNG image of the 3D view', 'Imagem PNG da vista 3D'],
    'dlg.png3d.desc': ['Tal como se ve ahora en pantalla.', 'Exactly as it looks on screen now.', 'Exatamente como aparece agora na tela.'],
    'dlg.axis': ['Dirección de las capas', 'Layer direction', 'Direção das camadas'],
    'dlg.bins': ['Contenedores', 'Containers', 'Contêineres'],
    'dlg.bins.all': ['Todos', 'All', 'Todos'],
    'dlg.bins.current': ['Solo el que se está viendo', 'Only the one being viewed', 'Só o que está sendo visto'],
    'dlg.pages': ['Páginas', 'Pages', 'Páginas'],
    'dlg.pages.all': ['Todas las capas', 'All layers', 'Todas as camadas'],
    'dlg.pages.current': ['Solo la capa actual', 'Only the current layer', 'Só a camada atual'],
    'dlg.paper': ['Papel', 'Paper', 'Papel'],
    'dlg.paper.a4': ['A4 horizontal', 'A4 landscape', 'A4 paisagem'],
    'dlg.paper.letter': ['Carta horizontal', 'Letter landscape', 'Carta paisagem'],
    'dlg.cover': ['Portada con resumen', 'Cover page with summary', 'Capa com resumo'],
    'dlg.with3d': ['Incluir vista 3D', 'Include 3D view', 'Incluir vista 3D'],
    'dlg.before': ['Capas anteriores en gris en la vista 3D', 'Previous layers in grey in the 3D view', 'Camadas anteriores em cinza na vista 3D'],
    'dlg.cancel': ['Cancelar', 'Cancel', 'Cancelar'],
    'dlg.go': ['Exportar', 'Export', 'Exportar'],
    'dlg.info.pages': [p => `${p.n} ${pl(p.n, 'página', 'páginas')}`, p => `${p.n} ${pl(p.n, 'page', 'pages')}`, p => `${p.n} ${pl(p.n, 'página', 'páginas')}`],
    'dlg.info.plans': [
      p => ` · ${p.k} ${pl(p.k, 'distribución distinta', 'distribuciones distintas')} para ${p.n} contenedores.`,
      p => ` · ${p.k} different ${pl(p.k, 'layout', 'layouts')} for ${p.n} containers.`,
      p => ` · ${p.k} ${pl(p.k, 'distribuição diferente', 'distribuições diferentes')} para ${p.n} contêineres.`],
    'dlg.info.layers': [
      p => ` · ${p.n} ${pl(p.n, 'capa', 'capas')} en esta dirección.`,
      p => ` · ${p.n} ${pl(p.n, 'layer', 'layers')} in this direction.`,
      p => ` · ${p.n} ${pl(p.n, 'camada', 'camadas')} nesta direção.`],
    'dlg.info.layer': ['Capa {i} de {n}', 'Layer {i} of {n}', 'Camada {i} de {n}'],
    'dlg.info.otherAxis': [' (primera capa: la actual es de otra dirección).', ' (first layer: the current one is in another direction).', ' (primeira camada: a atual é de outra direção).'],
    'dlg.info.3d': ['Se guarda la vista 3D tal como se ve en pantalla.', 'The 3D view is saved exactly as shown on screen.', 'A vista 3D é salva exatamente como aparece na tela.'],
    'dlg.stale': ['La configuración ha cambiado desde el último cálculo: se exportará el último resultado calculado.',
      'The setup has changed since the last calculation: the last calculated result will be exported.',
      'A configuração mudou desde o último cálculo: será exportado o último resultado calculado.'],
    'dlg.error': ['No se pudo generar el archivo: {e}', 'Could not create the file: {e}', 'Não foi possível gerar o arquivo: {e}'],
    'st.cover': ['Generando portada…', 'Creating cover page…', 'Gerando capa…'],
    'st.page': ['Generando {bin}capa {i} (página {p} de {n})…', 'Creating {bin}layer {i} (page {p} of {n})…', 'Gerando {bin}camada {i} (página {p} de {n})…'],
    'st.pageBin': ['contenedor {k}, ', 'container {k}, ', 'contêiner {k}, '],
    'st.saving': ['Guardando PDF…', 'Saving PDF…', 'Salvando PDF…'],
    'st.image': ['Generando imagen…', 'Creating image…', 'Gerando imagem…'],

    // ---- PDF --------------------------------------------------------------------------------
    'pdf.title': ['Plan de colocación', 'Loading plan', 'Plano de carregamento'],
    'pdf.docTitle': ['Plan de colocación — Organizador de espacios', 'Loading plan — Space Organizer', 'Plano de carregamento — Organizador de Espaços'],
    'pdf.calculated': ['{app} · calculado el {date}', '{app} · calculated on {date}', '{app} · calculado em {date}'],
    'pdf.footer': ['{app} · contenedor {dims}', '{app} · container {dims}', '{app} · contêiner {dims}'],
    'pdf.page': ['Página {p} de {n}', 'Page {p} of {n}', 'Página {p} de {n}'],
    'pdf.sec.container': ['Contenedor', 'Container', 'Contêiner'],
    'pdf.sec.config': ['Configuración', 'Settings', 'Configuração'],
    'pdf.sec.result': ['Resultado', 'Result', 'Resultado'],
    'pdf.sec.howto': ['Cómo leer las páginas', 'How to read the pages', 'Como ler as páginas'],
    'pdf.config': ['{mode} · priorizar {prio} · apoyo mínimo: {sup}', '{mode} · prioritize {prio} · minimum support: {sup}', '{mode} · priorizar {prio} · apoio mínimo: {sup}'],
    'pdf.prio.count': ['número de cajas', 'number of boxes', 'número de caixas'],
    'pdf.prio.volume': ['volumen ocupado', 'volume used', 'volume ocupado'],
    'pdf.sup.none': ['sin restricción', 'no restriction', 'sem restrição'],
    'pdf.maxW': ['Peso máximo: {w}', 'Max. weight: {w}', 'Peso máximo: {w}'],
    'pdf.maxWTare': [' (incluida la tara del contenedor: {t})', ' (including container tare: {t})', ' (incluindo a tara do contêiner: {t})'],
    'pdf.need': [
      p => `Hacen falta ${p.n} ${pl(p.n, 'contenedor', 'contenedores')}`,
      p => `${p.n} ${pl(p.n, 'container is', 'containers are')} needed`,
      p => `São necessários ${p.n} ${pl(p.n, 'contêiner', 'contêineres')}`],
    'pdf.need.min': [' (el mínimo posible).', ' (the minimum possible).', ' (o mínimo possível).'],
    'pdf.need.lb': [' (mínimo teórico: {lb}).', ' (theoretical minimum: {lb}).', ' (mínimo teórico: {lb}).'],
    'pdf.group': ['Contenedores {a}–{b} ({k} iguales)', 'Containers {a}–{b} ({k} identical)', 'Contêineres {a}–{b} ({k} iguais)'],
    'pdf.groupOne': ['Contenedor {a}', 'Container {a}', 'Contêiner {a}'],
    'pdf.groupLine': ['{label}: {n} cajas{each} · {p}', '{label}: {n} boxes{each} · {p}', '{label}: {n} caixas{each} · {p}'],
    'pdf.notFit': ['No caben: {list}', 'Do not fit: {list}', 'Não cabem: {list}'],
    'pdf.tip.bins': ['Las páginas van por contenedor; los contenedores iguales se muestran una sola vez.', 'Pages are grouped by container; identical containers are shown only once.', 'As páginas são por contêiner; contêineres iguais aparecem só uma vez.'],
    'pdf.tip.axis': ['{axis}: capas ordenadas {dir}{count}.', '{axis}: layers ordered {dir}{count}.', '{axis}: camadas ordenadas {dir}{count}.'],
    'pdf.tip.axisCount': [p => ` (${p.n} ${pl(p.n, 'capa', 'capas')})`, p => ` (${p.n} ${pl(p.n, 'layer', 'layers')})`, p => ` (${p.n} ${pl(p.n, 'camada', 'camadas')})`],
    'pdf.tip.cut': ['Cada página muestra el corte de una capa con las medidas en {u}.', 'Each page shows a cut through one layer with dimensions in {u}.', 'Cada página mostra o corte de uma camada com as medidas em {u}.'],
    'pdf.tip.hatch': ['Las cajas rayadas empiezan en una capa anterior y ya están colocadas.', 'Hatched boxes start in a previous layer and are already in place.', 'As caixas hachuradas começam em uma camada anterior e já estão colocadas.'],
    'pdf.tip.3d': ['En la vista 3D, la capa actual va en color y las anteriores en gris.', 'In the 3D view, the current layer is in colour and previous ones in grey.', 'Na vista 3D, a camada atual aparece colorida e as anteriores em cinza.'],
    'pdf.tip.cg': ['La marca rosa «CG» indica el centro de gravedad de la carga.', 'The pink "CG" mark shows the load\'s centre of gravity.', 'A marca rosa "CG" indica o centro de gravidade da carga.'],
    'pdf.tip.coverBin': ['La vista 3D de esta portada es la del contenedor {k}.', 'The 3D view on this cover is container {k}.', 'A vista 3D desta capa é a do contêiner {k}.'],
    'pdf.layerTitle': ['{bin}Capa {i} de {n}', '{bin}Layer {i} of {n}', '{bin}Camada {i} de {n}'],
    'pdf.binPrefix': ['Contenedor {k} · ', 'Container {k} · ', 'Contêiner {k} · '],
    'pdf.binsPrefix': ['Contenedores {a}–{b} · ', 'Containers {a}–{b} · ', 'Contêineres {a}–{b} · '],
    'pdf.sameNote': ['{k} contenedores iguales: repite esta distribución en cada uno', '{k} identical containers: repeat this layout in each one', '{k} contêineres iguais: repita esta distribuição em cada um'],
    'pdf.cutLine': ['{view} · corte en {ax} = {lo} {u} · espesor hasta la siguiente capa: {th} {u}', '{view} · cut at {ax} = {lo} {u} · thickness to the next layer: {th} {u}', '{view} · corte em {ax} = {lo} {u} · espessura até a próxima camada: {th} {u}'],
    'pdf.inLayer': ['En esta capa', 'In this layer', 'Nesta camada'],
    'pdf.newBoxes': [p => `${p.n} ${pl(p.c, 'caja nueva', 'cajas nuevas')}`, p => `${p.n} new ${pl(p.c, 'box', 'boxes')}`, p => `${p.n} ${pl(p.c, 'caixa nova', 'caixas novas')}`],
    'pdf.perBox': [' · {w} c/u', ' · {w} each', ' · {w} cada'],
    'pdf.noStack': [' · no apilable', ' · not stackable', ' · não empilhável'],
    'pdf.noStackName': [' (no apilable)', ' (not stackable)', ' (não empilhável)'],
    'pdf.layerWeight': ['Peso de esta capa: {w}', 'Weight of this layer: {w}', 'Peso desta camada: {w}'],
    'pdf.fromBefore': [p => `${p.n} ${pl(p.c, 'viene', 'vienen')} de capas anteriores`, p => `${p.n} from previous layers`, p => `${p.n} ${pl(p.c, 'vem', 'vêm')} de camadas anteriores`],
    'pdf.hatched': ['(rayadas: ya están colocadas)', '(hatched: already in place)', '(hachuradas: já estão colocadas)'],

    // ---- Nombres de archivo ---------------------------------------------------------------------
    'file.layers': ['capas', 'layers', 'camadas'],
    'file.layer': ['capa', 'layer', 'camada'],
    'file.container': ['contenedor', 'container', 'conteiner'],
    'file.view3d': ['vista-3d', '3d-view', 'vista-3d']
  };

  let lang = 'es';

  function t(key, p) {
    const e = D[key];
    if (!e) return key;
    let s = e[IDX[lang]];
    if (s == null) s = e[0];
    if (typeof s === 'function') return s(p || {});
    return p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m)) : s;
  }

  function locale() { return (LANGS.find(l => l.code === lang) || LANGS[0]).locale; }

  function normalize(code) {
    if (!code) return null;
    code = String(code).toLowerCase();
    if (code.startsWith('pt')) return 'pt-BR';
    if (code.startsWith('en')) return 'en';
    if (code.startsWith('es')) return 'es';
    return null;
  }

  // Idioma inicial: ?lang= en la URL, el guardado o el del navegador.
  function detect(saved) {
    try {
      const q = normalize(new URLSearchParams(location.search).get('lang'));
      if (q) return q;
    } catch (e) { /* sin URL */ }
    const s = normalize(saved);
    if (s) return s;
    for (const l of (navigator.languages || [navigator.language])) { const n = normalize(l); if (n) return n; }
    return 'es';
  }

  // Aplica las traducciones a los elementos con data-i18n*.
  function apply(rootEl) {
    const r = rootEl || document;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    r.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    r.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  function setLang(code) {
    lang = normalize(code) || 'es';
    document.documentElement.lang = lang;
    document.title = t('app.title');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t('app.description');
    apply();
  }

  root.I18n = { t, setLang, apply, detect, locale, LANGS, get lang() { return lang; }, _dict: D };
})(window);
