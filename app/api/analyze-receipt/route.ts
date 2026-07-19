import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' }); // Use flash for speed, 1.5 has great document understanding

    const prompt = `
      Analiza esta imagen de un ticket de compra de supermercado.
      Extrae el gasto total y la lista de productos comprados. Agrupa los productos duplicados (ej: si hay 2 cajas de leche iguales, pon quantity: 2).
      
      Devuelve la información ÚNICAMENTE en este formato JSON exacto:
      {
        "total_spent": 45.30, 
        "items": [
          {
            "name": "Nombre limpio del producto (ej: Leche Semidesnatada Pascual)",
            "category": "Una de estas: Lácteos, Carnes, Frutas y Verduras, Despensa, Bebidas, Congelados, Panadería, Limpieza, Farmacia, Otros",
            "quantity": 1,
            "requires_expiration": true
          }
        ]
      }

      Notas importantes sobre "requires_expiration":
      - Pon true SOLO para alimentos perecederos: Carnes, Frutas, Verduras, Lácteos, Panadería fresca, Platos preparados, Bebidas frescas.
      - Pon false para: Limpieza, Farmacia, Bolsas de plástico, Papel higiénico, Conservas muy duraderas (si quieres), u otros objetos no perecederos.
      - Si tienes dudas, pon true.

      IMPORTANTE: No uses markdown (\`\`\`json) ni devuelvas ningún texto extra. SOLO EL JSON VÁLIDO.
    `;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    console.log("Raw AI Receipt Response:", responseText);

    // Clean up potential markdown code block formatting
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
      console.log("Parsed AI Receipt Data:", parsedData);
      return NextResponse.json({ ...parsedData, rawResponse: responseText });
    } catch (e) {
      console.error('Failed to parse Gemini receipt response:', jsonStr);
      return NextResponse.json(
        { error: 'Invalid JSON response from AI', rawResponse: responseText },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error analyzing receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze receipt' },
      { status: 500 }
    );
  }
}
