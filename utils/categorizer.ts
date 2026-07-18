import { ItemCategory } from '@/types/pantry';

type CategoryRule = {
  keywords: string[];
  category: ItemCategory;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    keywords: [
      'leche', 'yogur', 'yogurt', 'queso', 'mantequilla', 'nata', 'crema',
      'kefir', 'requesón', 'ricotta', 'mozzarella', 'brie', 'cheddar',
      'dairy', 'milk', 'butter', 'cream', 'cheese',
    ],
    category: 'Lácteos',
  },
  {
    keywords: [
      'pollo', 'pechuga', 'muslo', 'carne', 'ternera', 'cerdo', 'jamón',
      'salchichón', 'chorizo', 'lomo', 'filete', 'costilla', 'cordero',
      'pavo', 'conejo', 'salmón', 'atún', 'merluza', 'gambas', 'langostino',
      'bacalao', 'sardina', 'anchoa', 'mejillón', 'calamar', 'pulpo',
      'chicken', 'beef', 'pork', 'salmon', 'tuna', 'fish', 'meat',
    ],
    category: 'Carnes',
  },
  {
    keywords: [
      'manzana', 'plátano', 'naranja', 'limón', 'fresa', 'uva', 'kiwi',
      'mango', 'piña', 'sandía', 'melón', 'cereza', 'ciruela', 'melocotón',
      'pera', 'tomate', 'lechuga', 'zanahoria', 'cebolla', 'ajo', 'pepino',
      'pimiento', 'brócoli', 'coliflor', 'espinaca', 'espárrago', 'berenjena',
      'calabacín', 'patata', 'boniato', 'remolacha', 'apio', 'puerro',
      'fruta', 'verdura', 'vegetal', 'ensalada',
      'apple', 'banana', 'orange', 'strawberry', 'tomato', 'potato', 'fruit',
    ],
    category: 'Frutas y Verduras',
  },
  {
    keywords: [
      'pan', 'baguette', 'croissant', 'bollería', 'bizcocho', 'magdalena',
      'tostada', 'brioche', 'churro', 'galleta', 'cookie', 'cake',
      'muffin', 'donut', 'bread', 'bakery',
    ],
    category: 'Panadería',
  },
  {
    keywords: [
      'agua', 'zumo', 'jugo', 'refresco', 'cerveza', 'vino', 'cava',
      'whisky', 'ron', 'vodka', 'gin', 'tónica', 'soda', 'cola',
      'limonada', 'té', 'café', 'infusión', 'batido', 'smoothie',
      'bebida', 'drink', 'juice', 'water', 'wine', 'beer',
    ],
    category: 'Bebidas',
  },
  {
    keywords: [
      'helado', 'congelado', 'pizza congelada', 'hamburguesa congelada',
      'croqueta', 'nugget', 'fish finger', 'edamame', 'espinacas congeladas',
      'guisantes congelados', 'ice cream', 'frozen',
    ],
    category: 'Congelados',
  },
  {
    keywords: [
      'limpiador', 'detergente', 'suavizante', 'lejía', 'fregasuelos',
      'bayeta', 'esponja', 'papel higiénico', 'papel cocina', 'bolsa basura',
      'jabón', 'gel', 'champú', 'acondicionador', 'pasta de dientes',
      'desodorante', 'cleaning', 'soap', 'shampoo', 'toothpaste',
    ],
    category: 'Limpieza',
  },
  {
    keywords: [
      'medicamento', 'pastilla', 'comprimido', 'cápsula', 'jarabe',
      'ibuprofeno', 'paracetamol', 'aspirina', 'vitamina', 'suplemento',
      'probiótico', 'antihistamínico', 'antibiótico', 'pomada', 'crema medicinal',
      'medicine', 'vitamin', 'supplement', 'pharmacy',
    ],
    category: 'Farmacia',
  },
  {
    keywords: [
      'arroz', 'pasta', 'macarrón', 'espagueti', 'fideos', 'lentejas',
      'garbanzos', 'alubias', 'judías', 'harina', 'azúcar', 'sal',
      'aceite', 'vinagre', 'mayonesa', 'ketchup', 'mostaza', 'salsa',
      'conserva', 'lata', 'bote', 'mermelada', 'miel', 'colacao',
      'cereales', 'avena', 'quinoa', 'cuscús', 'rice', 'pasta', 'beans',
      'sugar', 'flour', 'oil', 'sauce', 'jam',
    ],
    category: 'Despensa',
  },
];

/**
 * Asigna automáticamente una categoría basándose en el nombre del producto.
 * Compara el nombre (normalizado a minúsculas) contra una lista de keywords.
 * @param name - Nombre del producto
 * @returns Categoría más probable o 'Otros' si no hay coincidencia
 */
export function autoCategory(name: string): ItemCategory {
  if (!name || name.trim().length === 0) return 'Otros';

  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalized.includes(normalizedKeyword)) {
        return rule.category;
      }
    }
  }

  return 'Otros';
}
