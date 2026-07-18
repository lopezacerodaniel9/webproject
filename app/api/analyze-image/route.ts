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

    // Prepare the image for Gemini
    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
      Analiza esta imagen de un producto de supermercado o despensa.
      Actúa como un experto en lectura de etiquetas. Busca minuciosamente CUALQUIER texto que parezca una fecha de caducidad, consumo preferente (Ej: "Cad", "Cons. Pref", "Lote", fechas impresas en tinta negra en los bordes o tapas).
      
      Extrae la siguiente información y devuélvela ÚNICAMENTE en un formato JSON válido con esta estructura exacta:
      {
        "name": "Nombre del producto (breve y claro, máximo 4 palabras)",
        "category": "Una de estas categorías: Lácteos, Carnes, Frutas y Verduras, Despensa, Bebidas, Congelados, Panadería, Limpieza, Farmacia, Otros. (Elige la que mejor encaje)",
        "expirationDate": "La fecha de caducidad. Es VITAL que esté en formato exacto YYYY-MM-DD. Si encuentras algo como '15/08/25', conviértelo a '2025-08-15'. Si solo indica mes y año (ej: '08/25'), usa el último día del mes: '2025-08-31'. Si es ABSOLUTAMENTE imposible encontrar una fecha, devuelve null."
      }
      
      IMPORTANTE: Devuelve SOLO el JSON, sin bloques de código ni texto adicional. Evita usar markdown para el JSON.
    `;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg', // We assume jpeg as browser-image-compression typically outputs it or we can pass the mime type
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    console.log("Raw AI Response:", responseText);

    // Clean up potential markdown code block formatting
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
      console.log("Parsed AI Data:", parsedData);
      return NextResponse.json({ ...parsedData, rawResponse: responseText });
    } catch (e) {
      console.error('Failed to parse Gemini response:', jsonStr);
      return NextResponse.json(
        { error: 'Invalid JSON response from AI', rawResponse: responseText },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
