import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Key, Server, Database, Edit2, Save, X, Loader2 } from 'lucide-react';
import axios from 'axios';

// Configurar axios global para enviar cookies
axios.defaults.withCredentials = true;
axios.defaults.baseURL = '';

export default function OmieOverview() {
  const [config, setConfig] = useState({ app_key: '', app_secret: '', is_active: false });
  const [editMode, setEditMode] = useState(false);
  const [tempConfig, setTempConfig] = useState({ app_key: '', app_secret: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      console.log('[Frontend] Loading Omie config...');
      
      // Usar rota de debug temporária para teste
      const { data } = await axios.get('/api/omie/config', { 
        withCredentials: true 
      });
      
      console.log('[Frontend] Config response:', data);
      
      if (data.success && data.data) {
        console.log('[Frontend] Config loaded:', {
          has_app_key: !!data.data.app_key,
          app_key_length: data.data.app_key?.length || 0,
          has_app_secret: !!data.data.app_secret,
          is_active: data.data.is_active
        });
        
        setConfig({
          app_key: data.data.app_key || '',
          app_secret: data.data.app_secret || '',
          is_active: data.data.is_active || false
        });
        
        setTempConfig({ 
          app_key: data.data.app_key || '', 
          app_secret: '' 
        });
      } else {
        console.error('[Frontend] Invalid response:', data);
        setConfig({ app_key: '', app_secret: '', is_active: false });
      }
    } catch (error: any) {
      console.error('[Frontend] Error loading config:', error);
      console.error('[Frontend] Error details:', error.response?.data);
      setConfig({ app_key: '', app_secret: '', is_active: false });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setTempConfig({ app_key: config.app_key, app_secret: '' });
    setMessage(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setTempConfig({ app_key: config.app_key, app_secret: '' });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!tempConfig.app_key || !tempConfig.app_secret) {
      setMessage({ type: 'error', text: 'App Key e App Secret são obrigatórios' });
      return;
    }
    
    setSaving(true);
    setMessage(null);
    
    try {
      console.log('[Frontend] Saving config...');
      console.log('[Frontend] App Key length:', tempConfig.app_key.length);
      console.log('[Frontend] App Secret length:', tempConfig.app_secret.length);
      
      const { data } = await axios.post('/api/omie/config', {
        app_key: tempConfig.app_key.trim(),
        app_secret: tempConfig.app_secret.trim()
      }, { 
        withCredentials: true 
      });
      
      console.log('[Frontend] Save response:', data);
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Credenciais salvas com sucesso!' });
        setEditMode(false);
        
        // Recarregar config do servidor
        await loadConfig();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar' });
      }
    } catch (error: any) {
      console.error('[Frontend] Save error:', error);
      console.error('[Frontend] Error response:', error.response?.data);
      
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || error.message || 'Erro ao salvar credenciais' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    setConnectionStatus(null);
    
    try {
      console.log('[Frontend] Testing Omie connection...');
      
      const { data } = await axios.post('/api/omie/test');
      
      console.log('[Frontend] Test response:', data);
      
      setConnectionStatus(data.connected);
      
      // Usar a mensagem detalhada do backend quando disponível
      const messageText = data.message || (data.connected 
        ? '✓ Conexão estabelecida com sucesso!' 
        : '✗ Falha na conexão. Verifique as credenciais.');
      
      setMessage({
        type: data.connected ? 'success' : 'error',
        text: messageText
      });
      
    } catch (error: any) {
      console.error('[Frontend] Test error:', error);
      
      setConnectionStatus(false);
      
      // Tentar extrair mensagem de erro do backend
      const errorMsg = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Erro ao testar conexão';
      
      setMessage({ 
        type: 'error', 
        text: '✗ ' + errorMsg
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Sobre a Integração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sobre a Integração
          </CardTitle>
          <CardDescription>
            Esta integração permite consultar dados do ERP Omie diretamente no Renov Home
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Base URL:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">https://app.omie.com.br/api/v1/</code>
          </div>
          <div className="text-sm text-muted-foreground">
            A API disponibiliza endpoints para consulta de dispositivos e fechamentos logísticos.
          </div>
        </CardContent>
      </Card>

      {/* Autenticação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Autenticação
              </CardTitle>
              <CardDescription>Credenciais de acesso à API Omie</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Bearer Token</Badge>
              {!editMode && (
                <Button variant="ghost" size="sm" onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="app_key">App Key</Label>
                <Input
                  id="app_key"
                  type="text"
                  placeholder="Digite o App Key"
                  value={tempConfig.app_key}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, app_key: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app_secret">App Secret</Label>
                <Input
                  id="app_secret"
                  type="password"
                  placeholder="Digite o App Secret"
                  value={tempConfig.app_secret}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, app_secret: e.target.value }))}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>App Key</Label>
                <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono">
                  {config.app_key || 'Não configurado'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>App Secret</Label>
                <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono">
                  {config.app_key ? '••••••••••••••••••••' : 'Não configurado'}
                </div>
              </div>
            </>
          )}

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button onClick={handleSave} disabled={saving || !tempConfig.app_key || !tempConfig.app_secret}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleTest} disabled={testing || !config.app_key}>
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {testing ? 'Testando...' : 'Testar Conexão'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Endpoints Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints Disponíveis</CardTitle>
          <CardDescription>Total de endpoints organizados por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">4</div>
              <div className="text-sm text-muted-foreground">Compras e Estoque</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">3</div>
              <div className="text-sm text-muted-foreground">Vendas e NF-e</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">1</div>
              <div className="text-sm text-muted-foreground">Transporte (CT-e)</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">3</div>
              <div className="text-sm text-muted-foreground">Finanças</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">3</div>
              <div className="text-sm text-muted-foreground">Geral</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
