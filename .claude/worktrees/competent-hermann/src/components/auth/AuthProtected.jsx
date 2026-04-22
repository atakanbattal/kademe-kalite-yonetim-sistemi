import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AuthProtected = ({ children }) => {
    const { session, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !session) {
            navigate('/login', { state: { from: location } });
        }
    }, [session, loading, navigate, location]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <p>Yükleniyor...</p>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return children;
};

export default AuthProtected;
