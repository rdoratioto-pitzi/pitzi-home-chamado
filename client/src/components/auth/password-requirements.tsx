import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { getPasswordRequirements, PasswordRequirements as PWRequirements } from "@/lib/password-utils";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

const requirementLabels: Record<keyof PWRequirements, string> = {
  minLength: "Mínimo de 8 caracteres",
  hasUppercase: "Pelo menos uma letra maiúscula",
  hasLowercase: "Pelo menos uma letra minúscula",
  hasNumber: "Pelo menos um número",
  hasSpecial: "Pelo menos um caractere especial",
};

const requirementOrder: (keyof PWRequirements)[] = [
  "minLength",
  "hasUppercase",
  "hasLowercase",
  "hasNumber",
  "hasSpecial",
];

export function PasswordRequirements({ password, className = "" }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);
  
  // Don't show if password is empty
  if (password.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`overflow-hidden ${className}`}
    >
      <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Requisitos da senha:
        </p>
        <AnimatePresence>
          {requirementOrder.map((key, index) => {
            const isValid = requirements[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="flex items-center gap-2"
              >
                <motion.div
                  initial={false}
                  animate={{ scale: isValid ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isValid ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </motion.div>
                <motion.span
                  className={`text-xs transition-colors duration-200 ${
                    isValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  }`}
                >
                  {requirementLabels[key]}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}