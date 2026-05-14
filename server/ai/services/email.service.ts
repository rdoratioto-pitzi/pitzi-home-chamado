import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://rdoratioto-pitzi.github.io/pitzi-home-chamado";
}

export class AIEmailService {
  
  async sendPlanCompleted(params: {
    userEmail: string;
    planTitulo: string;
    planId: string;
    tempoTotal: number;
    custoTotal: number;
    arquivosModificados: string[];
  }): Promise<boolean> {
    
    const baseUrl = getBaseUrl();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1>✅ Feature Concluída!</h1>
            <p style="margin: 0;">${params.planTitulo}</p>
          </div>
          <div style="background: #f9fafb; padding: 20px;">
            <p>Sua feature foi implementada com sucesso!</p>
            <p><strong>⏱️ Tempo:</strong> ${Math.round(params.tempoTotal / 60)}min</p>
            <p><strong>💰 Custo:</strong> $${params.custoTotal.toFixed(2)}</p>
            <p><strong>📁 Arquivos:</strong> ${params.arquivosModificados.length}</p>
            <a href="${baseUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Acessar Pitzi Home</a>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: params.userEmail,
        subject: `✅ Feature Pronta: ${params.planTitulo}`,
        html,
      });
      console.log(`📧 Email enviado para ${params.userEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }
  }
}

export const aiEmailService = new AIEmailService();
