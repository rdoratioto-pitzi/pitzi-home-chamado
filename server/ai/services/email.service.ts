import { transporter, getBaseUrl } from './email-service';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
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
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .stats { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .stat { display: inline-block; margin-right: 20px; }
          .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
          .files { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .file { padding: 8px; margin: 4px 0; background: #f3f4f6; border-radius: 4px; font-family: monospace; font-size: 12px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Feature Concluída!</h1>
            <p style="margin: 0;">${params.planTitulo}</p>
          </div>
          <div class="content">
            <p>Olá! Sua feature foi implementada com sucesso pelo sistema AI Dev.</p>
            
            <div class="stats">
              <div class="stat">
                <div class="stat-label">Tempo</div>
                <div class="stat-value">${Math.round(params.tempoTotal / 60)}min</div>
              </div>
              <div class="stat">
                <div class="stat-label">Custo</div>
                <div class="stat-value">$${params.custoTotal.toFixed(2)}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Arquivos</div>
                <div class="stat-value">${params.arquivosModificados.length}</div>
              </div>
            </div>
            
            ${params.arquivosModificados.length > 0 ? `
            <div class="files">
              <strong>Arquivos modificados:</strong>
              ${params.arquivosModificados.map(f => `<div class="file">${f}</div>`).join('')}
            </div>
            ` : ''}
            
            <p>Próximos passos:</p>
            <ol>
              <li>Teste a feature localmente</li>
              <li>Revise o código gerado</li>
              <li>Aprove o Pull Request se estiver OK</li>
            </ol>
            
            <a href="${baseUrl}" class="button">Acessar Renov Home</a>
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
