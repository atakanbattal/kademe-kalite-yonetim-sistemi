import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';
  const isSignedOut = new URLSearchParams(location.search).get('signedout') === '1';

  useEffect(() => {
    if (session) {
      // Giriş başarılı - yönlendir (signedout=1 olsa bile, kullanıcı yeni giriş yaptı)
      if (isSignedOut && window.history.replaceState) {
        window.history.replaceState({}, '', '/login');
      }
      setLoading(false);
      navigate(from, { replace: true });
    } else if (isSignedOut && window.history.replaceState) {
      // Çıkış sonrası geldik, session yok - URL'yi temizle, otomatik yönlendirme yapma
      window.history.replaceState({}, '', '/login');
    }
  }, [session, navigate, from, isSignedOut]);

    const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
        setLoading(false);
        toast({
            variant: "destructive",
            title: "Hata",
            description: "E-posta ve şifre alanları zorunludur.",
            duration: 5000,
        });
        return;
    }
    
    const emailToLogin = email.includes('@') ? email : `${email}@kademe.com`;

    try {
      const { data, error } = await signIn(emailToLogin, password);
      
      if (error) {
        setLoading(false);
        // Kullanıcıya anlamlı hata mesajı göster
        let errorMessage = "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.";
        let errorTitle = "Giriş Başarısız";
        
        if (error.message) {
          if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
            errorTitle = "Geçersiz Bilgiler";
            errorMessage = "Kullanıcı adı veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.";
          } else if (error.message.includes("Email not confirmed")) {
            errorTitle = "E-posta Onayı Gerekli";
            errorMessage = "E-posta adresiniz henüz onaylanmamış. Lütfen e-postanızı kontrol edin.";
          } else if (error.message.includes("Too many requests")) {
            errorTitle = "Çok Fazla Deneme";
            errorMessage = "Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.";
          } else if (error.message.includes("fetch") || error.message.includes("network")) {
            errorTitle = "Bağlantı Hatası";
            errorMessage = "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
          } else {
            errorMessage = error.message;
          }
        }
        
        // Hata mesajını göster
        console.error('Login failed:', error);
        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorMessage,
          duration: 6000,
        });
        return;
      }
      
      if (data?.session) {
        toast({
          title: "Giriş Başarılı!",
          description: "Kalite Yönetim Sistemine hoş geldiniz.",
          duration: 3000,
        });
        setLoading(false); // useEffect yönlendirene kadar butonu serbest bırak
      } else {
        // Session yoksa hata göster
        setLoading(false);
        toast({
          variant: "destructive",
          title: "Giriş Başarısız",
          description: "Oturum oluşturulamadı. Lütfen tekrar deneyin.",
          duration: 5000,
        });
      }
    } catch (err) {
      setLoading(false);
      console.error('Login error:', err);
      
      let errorMessage = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
      if (err.message) {
        if (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("Failed to fetch")) {
          errorMessage = "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Bağlantı Hatası",
        description: errorMessage,
        duration: 6000,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Kademe QMS</h1>
            <p className="text-muted-foreground mt-2">Giriş yapmak için bilgilerinizi girin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Kullanıcı Adı / E-posta</Label>
              <Input
                id="email"
                data-testid="login-email"
                type="text"
                placeholder="ornek@kademe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>
            <Button type="submit" data-testid="login-submit" className="w-full" disabled={loading}>
              {loading ? 'Giriş Yapılıyor...' : <> <LogIn className="w-4 h-4 mr-2" /> Giriş Yap</>}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Kademe A.Ş. Kalite Yönetim Sistemi
        </p>
      </motion.div>
    </div>
  );
};

export default Login;