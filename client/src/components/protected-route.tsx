import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getCurrentUser, getUserPermissions, type UserPermissions } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof UserPermissions;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    
    if (!user) {
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
  }, [requiredPermission, setLocation]);

  if (hasAccess === null) {
    return null;
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
