
    import { useMemo } from 'react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    export const usePermissions = (moduleName) => {
      const { profile, user } = useAuth();

      const permissions = useMemo(() => {
        // Admin has full access
        if (user?.email === 'atakan.battal@kademe.com.tr') {
          return { canRead: true, canWrite: true, canDelete: true, hasFullAccess: true };
        }

        const modulePermission = profile?.permissions?.[moduleName];

        const hasFullAccess = modulePermission === 'full';
        const canRead = modulePermission === 'full' || modulePermission === 'read';
        // Users with read permission can also write (create/update records)
        const canWrite = modulePermission === 'full' || modulePermission === 'read';

        return {
          canRead,
          canWrite,
          canDelete: hasFullAccess,
          hasFullAccess: hasFullAccess,
        };
      }, [profile, user, moduleName]);

      return permissions;
    };
  