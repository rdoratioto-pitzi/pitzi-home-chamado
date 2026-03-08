import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown, User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { User as UserType } from "@shared/schema"

interface UserSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  showAutoOption?: boolean
}

export function UserSelect({
  value,
  onValueChange,
  placeholder = "Selecione um usuário",
  emptyMessage = "Nenhum usuário encontrado",
  disabled = false,
  showAutoOption = false,
}: UserSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  })

  // Filter users by search term
  const filteredUsers = search
    ? users.filter(
        (user) =>
          user.name?.toLowerCase().includes(search.toLowerCase()) ||
          user.email?.toLowerCase().includes(search.toLowerCase())
      )
    : users

  // Filter only active users and sort by name
  const activeUsers = filteredUsers
    .filter((user) => user.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

  // Find selected user
  const selectedUser = users.find((user) => user.id === value)
  const isAutoSelected = value === "auto" || !value

  const handleSelect = (userId: string) => {
    onValueChange(userId)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {isAutoSelected ? (
              <Bot className="h-4 w-4" />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span className="truncate">
              {isAutoSelected ? "Atribuição automática" : selectedUser?.name || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar usuário..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Carregando usuários...
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {showAutoOption && (
                <CommandItem
                  value="auto"
                  onSelect={() => handleSelect("auto")}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Bot className="h-4 w-4" />
                    <span className="font-medium">Atribuição automática</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        isAutoSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              )}
              {activeUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => handleSelect(user.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <User className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      {user.email && (
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
