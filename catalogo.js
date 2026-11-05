// Categorías y nombres transcritos del catálogo impreso. Los precios y el stock
// se consultan en cada solicitud; el PDF no publica valores ni disponibilidad.
const categories = [
  'Todo', 'Vajilla y cristalería', 'Servicio y menaje', 'Exhibidores',
  'Estructuras', 'Mesas y bases', 'Sillas y salas', 'Letras y LED',
  'Iluminación', 'Decoración', 'Flores', 'Telas y textiles'
];

const products = [];
function add(page, names, category, firstImage = 0) {
  names.forEach((name, i) => products.push({
    id: `${page}-${i + 1}`, name, category, page,
    image: `assets/catalog/p${String(page).padStart(2, '0')}-${String(firstImage + i + 1).padStart(2, '0')}.webp`
  }));
}

add(3, ['Plato llano', 'Plato para torta'], 'Vajilla y cristalería');
add(4, ['Base de plato · modelo 1', 'Base de plato · modelo 2', 'Base de plato · modelo 3', 'Base de plato · modelo 4', 'Base de plato · modelo 5', 'Base de plato · modelo 6', 'Base de plato · modelo 7', 'Ensaladera'], 'Vajilla y cristalería');
add(5, ['Copa de champán lisa', 'Copa de champán dorada', 'Copa de vino', 'Copa Margarita', 'Copa de cóctel'], 'Vajilla y cristalería');
add(6, ['Vaso liso clásico', 'Vaso Rocks', 'Vaso Collins', 'Vaso Cubero', 'Vaso Buchón'], 'Vajilla y cristalería');
add(7, ['Jarras', 'Dispensadores', 'Hielera con pinzas', 'Soporte para copas'], 'Servicio y menaje');
add(8, ['Samovares', 'Fuente de chocolate', 'Charolas'], 'Servicio y menaje');
add(9, ['Cubiertos plateados', 'Cubiertos dorados'], 'Servicio y menaje');
add(10, ['Exhibidor de alimentos · modelo 1', 'Exhibidor de alimentos · modelo 2', 'Exhibidor de alimentos · modelo 3', 'Exhibidor de alimentos · modelo 4', 'Exhibidor de alimentos · modelo 5', 'Exhibidor de alimentos · modelo 6', 'Exhibidor de alimentos · modelo 7', 'Exhibidor de alimentos · modelo 8'], 'Exhibidores');
add(11, ['Exhibidor de alimentos · modelo 9', 'Exhibidor de alimentos · modelo 10', 'Exhibidor de alimentos · modelo 11', 'Exhibidor de alimentos · modelo 12', 'Exhibidor tipo pirámide', 'Exhibidor de copas'], 'Exhibidores');
add(12, ['Arco Backing', 'Arco estilo Art Deco', 'Arco túnel circular', 'Aro aéreo cuadrado', 'Aro aéreo redondo'], 'Estructuras');
add(13, ['Arco de corazón', 'Arco túnel', 'Arco dosel Backing', 'Arco armable'], 'Estructuras');
add(14, ['Estructura circular', 'Estructura mediana', 'Estructura expandible', 'Estructura grande'], 'Estructuras');
add(15, ['Mampara grande', 'Mampara mediana', 'Mampara espejo'], 'Estructuras');
add(16, ['Arco arcoíris 3D', 'Mampara arco blanco', 'Arcos blancos', 'Arco romano', 'Arco fondo arcoíris'], 'Estructuras');
add(17, ['Backing ondulado 3D', 'Arco mixtilíneo', 'Telón arco 3D', 'Arco centro de rejilla', 'Pegboard', 'Arco cuadrado'], 'Estructuras');
add(18, ['Arco cuadrado de escalera', 'Panel de madera', 'Arco café', 'Arco heptagonal', 'Marco selfie'], 'Estructuras');
add(19, ['Bases blancas', 'Mesa bar rústica', 'Mesa Lira', 'Mesa torneada', 'Mesa pirámide'], 'Mesas y bases');
add(20, ['Mesa plateada', 'Mesa cuadrada de vidrio', 'Mesa pasabocas · 3 divisiones', 'Carrosa para torta', 'Base de torta alta'], 'Mesas y bases');
add(21, ['Base de pasabocas x6', 'Mesa tipo rombo', 'Mesa dorada redonda', 'Mesa cruz redonda', 'Mesa reloj de arena'], 'Mesas y bases');
add(22, ['Mesa cubo de color', 'Mesa espejo', 'Mesa cubículo negro', 'Mesa tipo hongo', 'Mesa torta café'], 'Mesas y bases');
add(23, ['Mesa lila arcoíris', 'Mesa base blanca', 'Mesas acrílicas', 'Mesa inglesa', 'Mesa dorada'], 'Mesas y bases');
add(24, ['Mesa inglesa café', 'Mesa imperial', 'Mesa medialuna café', 'Mesa redonda para 8', 'Mesa redonda para 10'], 'Mesas y bases');
add(25, ['Mesa maleta', 'Mesa infantil', 'Cilindros de madera', 'Cilindro ranurado', 'Cilindros lisos de madera'], 'Mesas y bases');
add(26, ['Silla trono grande'], 'Sillas y salas');
add(27, ['Silla con aro', 'Silla Pavo Real', 'Silla trono pequeña', 'Silla Victoriana'], 'Sillas y salas');
add(28, ['Silla Tiffany', 'Silla Rimax', 'Silla Crossback', 'Silla infantil'], 'Sillas y salas');
add(29, ['Silla tipo diván · modelo 1', 'Silla tipo diván · modelo 2', 'Silla tipo diván · modelo 3', 'Silla tipo diván · modelo 4'], 'Sillas y salas');
add(30, ['Silla tipo diván · modelo 5', 'Silla tipo diván · modelo 6', 'Silla tipo diván · modelo 7', 'Silla tipo diván · modelo 8'], 'Sillas y salas');
add(31, ['Tocador', 'Nochero', 'Sala Lounge'], 'Sillas y salas');
add(32, ['Números mini LED', 'Números pequeños LED', 'Número 15 LED'], 'Letras y LED');
add(33, ['Número grande LED · modelo 1', 'Número grande LED · modelo 2', 'Números medianos de madera', 'Letras decorativas LED (1,20 m)', 'Letras LED'], 'Letras y LED');
add(34, ['Plataforma', 'Plataforma estilo torta', 'Plataforma grande', 'Mariposa LED'], 'Letras y LED');
add(35, ['Estrella LED', 'Alas LED', 'Corazón LED', 'Un amor por siempre', 'Felices por siempre'], 'Letras y LED');
add(36, ['Mr & Mrs', 'Feliz día', 'Mi primera comunión', 'Mi grado', 'Mi bautizo'], 'Letras y LED');
add(37, ['Nuestra boda', 'Happy Birthday', 'Mis 15', 'Quince', 'Love'], 'Letras y LED');
add(38, ['Feliz día', 'Let’s Party', 'Sofía', 'Mi grado', 'Forma de corazón'], 'Letras y LED');
add(39, ['Tatiana', 'Juliana', 'Oh Baby'], 'Letras y LED');
add(40, ['Chaimers morado', 'Chaimers rosa palo', 'Chaimers plateado', 'Chaimers negro con brillos', 'Chaimers tornasol'], 'Iluminación');
add(41, ['Chaimers negro', 'Chaimers dorado', 'Chaimers verde', 'Chaimers rojo'], 'Iluminación');
add(42, ['Candelabro de 8 brazos', 'Candelabro votivo de copa y bola', 'Candelabro copa dorada', 'Portavelas centro de mesa'], 'Iluminación');
add(43, ['Faroles dorados', 'Faroles negros', 'Cilindros de cristal · modelo 1', 'Cilindros de cristal · modelo 2', 'Cilindros de cristal · modelo 3', 'Cilindros de cristal · modelo 4', 'Cilindros de cristal · modelo 5', 'Cilindros de cristal · modelo 6', 'Cilindros de cristal · modelo 7', 'Cilindros de cristal · modelo 8', 'Cilindros de cristal · modelo 9'], 'Iluminación');
add(44, ['Portanúmeros con mensaje', 'Busto de David', 'Florero tipo copa', 'Soportes metálicos'], 'Decoración');
add(45, ['Columnas blancas', 'Columnas doradas', 'Columnas de madera', 'Soporte para lámparas', 'Soportes de globos'], 'Decoración');
add(46, ['Caballete de metal', 'Caballete de madera'], 'Exhibidores');
add(47, ['Lámpara de ratán', 'Lámpara de bambú', 'Lámpara de araña'], 'Iluminación');
add(48, ['Decoración de techo · modelo 1', 'Decoración de techo · modelo 2', 'Decoración de techo · modelo 3', 'Decoración de techo · modelo 4'], 'Decoración');
add(49, ['Decoración de techo · modelo 5', 'Decoración de techo · modelo 6', 'Decoración de techo · modelo 7'], 'Decoración');
add(50, ['Cofre dorado pequeño', 'Cofre plateado y dorado', 'Cofre de mimbre · modelo 1', 'Cofre de mimbre · modelo 2'], 'Decoración');
add(51, ['Figura decorativa · modelo 1', 'Figura decorativa · modelo 2', 'Figura decorativa · modelo 3', 'Figura decorativa · modelo 4', 'Figura decorativa · modelo 5', 'Figura decorativa · modelo 6'], 'Decoración');
add(52, ['Figura decorativa · modelo 7', 'Cojines'], 'Decoración');
add(53, ['Cubos Baby', 'Caja fantasía', 'Peluches'], 'Decoración');
add(54, ['Corona', 'Moño gigante', 'Castillo', 'Planetas', 'Cisne'], 'Decoración');
add(55, ['Concha de mar', 'Decoración náutica', 'Candelabros', 'Sombrero'], 'Decoración');
add(56, ['Espejo mariposa', 'Espejo para 15 o bodas', 'Mensaje para boda'], 'Decoración');
add(57, ['Torta decorativa · modelo 1', 'Torta decorativa · modelo 2', 'Torta decorativa · modelo 3', 'Torta decorativa · modelo 4', 'Torta decorativa · modelo 5', 'Torta decorativa · modelo 6', 'Torta decorativa · modelo 7', 'Torta decorativa · modelo 8'], 'Decoración');
add(58, ['Canasta o cesto · modelo 1', 'Canasta o cesto · modelo 2', 'Canasta o cesto · modelo 3', 'Canasta o cesto · modelo 4', 'Canasta o cesto · modelo 5', 'Canasta o cesto · modelo 6', 'Canasta o cesto · modelo 7', 'Canasta o cesto · modelo 8', 'Canasta o cesto · modelo 9', 'Canasta o cesto · modelo 10', 'Canasta o cesto · modelo 11', 'Canasta o cesto · modelo 12'], 'Decoración');
add(59, ['Cerca retráctil', 'Flores blancas', 'Hortensia rosada', 'Rosas'], 'Flores');
add(60, ['Claveles', 'Enredaderas', 'Crisantemo', 'Hellebore'], 'Flores');
for (let p = 61; p <= 66; p++) add(p, Array.from({ length: p === 61 ? 5 : p === 62 || p === 63 || p === 65 ? 9 : p === 64 ? 4 : 6 }, (_, i) => `Tela para mampara · modelo ${i + 1 + (p === 61 ? 0 : p === 62 ? 5 : p === 63 ? 14 : p === 64 ? 23 : p === 65 ? 27 : 36)}`), 'Telas y textiles');
for (let p = 67; p <= 69; p++) add(p, Array.from({ length: p === 67 ? 9 : p === 68 ? 7 : 3 }, (_, i) => `Textil de cilindro · modelo ${i + 1 + (p === 67 ? 0 : p === 68 ? 9 : 16)}`), 'Telas y textiles');
add(70, ['Textil circular'], 'Telas y textiles');
