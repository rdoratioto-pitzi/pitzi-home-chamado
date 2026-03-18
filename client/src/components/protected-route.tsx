import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { getUserPermissions, type UserPermissions } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof UserPermissions;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      setLocation("/login");
      return;
    }

    if (!requiredPermission) {
      setHasAccess(true);
      return;
    }

    if (user.isAdmin) {
      setHasAccess(true);
      return;
    }

    const permissions = getUserPermissions(user);
    if (permissions[requiredPermission]) {
      setHasAccess(true);
    } else {
      setLocation("/");
    }
  }, [requiredPermission, setLocation, user, isAuthenticated, isLoading]);

  if (isLoading || hasAccess === null) {
    return null;
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
