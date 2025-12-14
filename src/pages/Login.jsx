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

  useEffect(() => {
    if (session) {
      navigate(from, { replace: true });
    }
  }, [session, navigate, from]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
        toast({
            variant: "destructive",
            title: "Hata",
            description: "E-posta ve şifre alanları zorunludur.",
        });
        setLoading(false);
        return;
    }
    
    const emailToLogin = email.includes('@') ? email : `${email}@kademe.com`;

    try {
      const { data, error } = await signIn(emailToLogin, password);
      
      if (error) {
        setLoading(false);
        // Kullanıcıya anlamlı hata mesajı göster
        let errorMessage = "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.";
        
        if (error.message) {
          if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
            errorMessage = "Geçersiz kullanıcı adı veya şifre. Lütfen tekrar deneyin.";
          } else if (error.message.includes("Email not confirmed")) {
            errorMessage = "E-posta adresiniz henüz onaylanmamış. Lütfen e-postanızı kontrol edin.";
          } else if (error.message.includes("Too many requests")) {
            errorMessage = "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          variant: "destructive",
          title: "Giriş Başarısız",
          description: errorMessage,
        });
      } else {
        // Başarılı giriş - toast göster ve redirect için bekle
        toast({
          title: "Giriş Başarılı!",
          description: "Kalite Yönetim Sistemine hoş geldiniz.",
        });
        // Loading'i false yapma, useEffect session değiştiğinde redirect yapacak
        // Session state'i auth context'te güncellenecek ve useEffect tetiklenecek
      }
    } catch (err) {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
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
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
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