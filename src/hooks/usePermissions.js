
    import { useMemo } from 'react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    export const usePermissions = (moduleName) => {
      const { profile, user } = useAuth();

      const permissions = useMemo(() => {
        // Admin has full access
        if (user?.email === 'atakan.battal@kademe.com.tr') {
          return { canRead: true, canWrite: true, canDelete: true, hasFullAccess: true };
        }

        // Hem profile hem user_metadata kullan (sync tutarsızlığına karşı)
        const perms = profile?.permissions || user?.user_metadata?.permissions || {};
        const modulePermission = perms[moduleName];

        // Profile yüklenmediyse (null) fazla kısıtlama yapma - yetkisiz atma
        if (profile === null && !user?.user_metadata?.permissions?.[moduleName]) {
          return { canRead: true, canWrite: true, canDelete: true, hasFullAccess: true };
        }

        const hasFullAccess = modulePermission === 'full';
        const canRead = modulePermission === 'full' || modulePermission === 'read';
        const canWrite = modulePermission === 'full';

        return {
          canRead,
          canWrite,
          canDelete: hasFullAccess,
          hasFullAccess: hasFullAccess,
        };
      }, [profile, user, moduleName]);

      return permissions;
    };
  