import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Resend } from 'resend';

export const runtime = 'edge';

// Instantiate safely. Fallback to dummy key so it doesn't break `next build`
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_123');

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createAdminClient();

    // 1. Get tomorrow's date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // We also want to include items that expired today or yesterday, but to avoid spamming
    // let's just get items where expiration_date <= tomorrow AND expiration_date >= yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 2. Fetch critical items
    const { data: items, error: itemsError } = await supabase
      .from('pantry_items')
      .select('*, pantries(name)')
      .lte('expiration_date', tomorrowStr)
      .gte('expiration_date', yesterdayStr)
      .not('expiration_date', 'is', null);

    if (itemsError) {
      throw itemsError;
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No expiring items found today.' });
    }

    // 3. Group items by pantry_id
    const itemsByPantry: Record<string, { pantryName: string, items: any[] }> = {};
    for (const item of items) {
      if (!itemsByPantry[item.pantry_id]) {
        itemsByPantry[item.pantry_id] = {
          pantryName: item.pantries?.name || 'Tu Despensa',
          items: []
        };
      }
      itemsByPantry[item.pantry_id].items.push(item);
    }

    // 4. Send emails to members of each pantry
    let emailsSent = 0;
    
    // We fetch all users once using admin auth to get their emails
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    const userEmails = new Map<string, string>();
    users.forEach(u => {
      if (u.email) userEmails.set(u.id, u.email);
    });

    for (const pantryId of Object.keys(itemsByPantry)) {
      const pantryData = itemsByPantry[pantryId];
      
      // Get members for this pantry
      const { data: members } = await supabase
        .from('pantry_members')
        .select('user_id')
        .eq('pantry_id', pantryId);
        
      if (!members) continue;

      // Construct Email HTML
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1;">🚨 Alerta de Caducidad</h2>
          <p>¡Hola! Tienes productos que están a punto de caducar en tu despensa <strong>"${pantryData.pantryName}"</strong>.</p>
          <ul style="list-style: none; padding: 0;">
            ${pantryData.items.map(i => `
              <li style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <strong>${i.name}</strong> 
                <span style="color: #ef4444; font-size: 0.9em;">Caduca: ${i.expiration_date}</span>
              </li>
            `).join('')}
          </ul>
          <p style="margin-top: 20px;">
            <a href="https://tu-dominio-pantry.vercel.app" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ir a la despensa
            </a>
          </p>
          <p style="color: #888; font-size: 0.8em; margin-top: 30px;">
            Para dejar de recibir estos avisos, puedes configurar tus notificaciones en la app.
          </p>
        </div>
      `;

      // Send email to each member
      for (const member of members) {
        const email = userEmails.get(member.user_id);
        if (!email) continue;
        
        // Skip sending if RESEND_API_KEY is not configured yet (avoids crashing)
        if (process.env.RESEND_API_KEY) {
          try {
            await resend.emails.send({
              from: 'Pantry Assistant <onboarding@resend.dev>', // Replace with your verified domain later
              to: email,
              subject: '🚨 Tienes productos a punto de caducar',
              html: htmlContent
            });
            emailsSent++;
          } catch (e) {
            console.error('Failed to send email to', email, e);
          }
        }
      }
    }

    return NextResponse.json({ message: 'Cron executed successfully', emailsSent });

  } catch (error: any) {
    console.error('Cron error:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
