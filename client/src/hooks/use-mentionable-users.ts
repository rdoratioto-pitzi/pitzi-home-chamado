import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import type { MentionableUser } from "@/components/rich-textarea";

export function useMentionableUsers(): MentionableUser[] {
  const { data = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  return data
    .filter((u) => u && u.id && u.name)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
}
