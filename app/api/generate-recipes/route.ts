import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Specify the Edge Runtime for better performance with AI streaming/calls
export const runtime = 'edge';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'La API Key de Gemini no está configurada.' },
        { status: 500 }
      );
    }

    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No se enviaron productos de la despensa.' },
        { status: 400 }
      );
    }

    // Format the items to a readable list for the prompt
    const itemList = items.map((item: any) => {
      let expiryInfo = 'Sin fecha';
      if (item.expiryStatus === 'expired') expiryInfo = 'CADUCADO';
      else if (item.expiryStatus === 'critical') expiryInfo = `Caduco en ${item.daysUntilExpiry} días (URGENTE)`;
      else if (item.expiryStatus === 'warning') expiryInfo = `Caduca en ${item.daysUntilExpiry} días`;
      else if (item.daysUntilExpiry !== null) expiryInfo = `Caduca en ${item.daysUntilExpiry} días`;

      return `- ${item.name} (Cantidad: ${item.quantity || 'Desconocida'} ${item.unit || ''}) [${expiryInfo}]`;
    }).join('\n');

    const prompt = `
Eres un Chef IA experto en aprovechamiento culinario ("Zero Waste Chef"). 
Tu objetivo es darme recetas deliciosas usando ESTRICTAMENTE o principalmente los ingredientes que tengo en mi despensa.

Aquí está el inventario de mi despensa, incluyendo su estado de caducidad:
${itemList}

Debes devolver EXACTAMENTE 3 opciones de recetas en formato JSON estructurado, sin texto Markdown alrededor (solo el JSON válido).

El JSON debe tener la siguiente estructura exacta:
{
  "recipes": [
    {
      "type": "urgency", 
      "title": "Título de la receta",
      "description": "Breve descripción de por qué recomiendas esta receta (ej. 'Perfecta para gastar esos huevos y la leche que están a punto de caducar').",
      "difficulty": "Fácil" | "Media" | "Difícil",
      "time": "Tiempo en minutos (ej. '30 min')",
      "ingredientsUsed": ["lista", "de", "ingredientes", "de", "la", "despensa"],
      "extraIngredient": "Solo 1 ingrediente recomendado que NO esté en la despensa para mejorar el plato (ej. 'Queso Parmesano'). Si no hace falta ninguno, devuelve null.",
      "steps": ["Paso 1", "Paso 2", "Paso 3"]
    },
    {
      "type": "balanced",
      "title": "...",
      "description": "...",
      "difficulty": "...",
      "time": "...",
      "ingredientsUsed": [],
      "extraIngredient": "...",
      "steps": []
    },
    {
      "type": "creative",
      "title": "...",
      "description": "...",
      "difficulty": "...",
      "time": "...",
      "ingredientsUsed": [],
      "extraIngredient": "...",
      "steps": []
    }
  ]
}

Reglas estrictas para cada tipo:
1. "urgency" (Urgencia Máxima): PRIORIZA usar los ingredientes con etiqueta 'URGENTE' o 'CADUCADO' (si aún son aprovechables para cocinar). Debe ser un plato para salvar comida.
2. "balanced" (Equilibrada): Mezcla algún producto próximo a caducar con ingredientes básicos/estables de la despensa.
3. "creative" (Creativa/Sorpresa): Sé muy creativo. Ignora la caducidad y propón el plato más delicioso y original que se pueda hacer con los ingredientes disponibles.

NO devuelvas NADA MÁS que el JSON (ni \`\`\`json al principio ni al final).
`;

    // Use gemini-1.5-flash as it's fast and highly capable of JSON output
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up potential markdown formatting
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }

    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', text);
      return NextResponse.json(
        { error: 'La IA devolvió un formato inválido. Por favor, inténtalo de nuevo.' },
        { status: 500 }
      );
    }

    return NextResponse.json(jsonData);
  } catch (error: any) {
    console.error('Error generating recipes:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al generar recetas.' },
      { status: 500 }
    );
  }
}
