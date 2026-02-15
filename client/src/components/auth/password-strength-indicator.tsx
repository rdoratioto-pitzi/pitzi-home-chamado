import { motion } from "framer-motion";
import { calculatePasswordStrength } from "@/lib/password-utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className = "" }: PasswordStrengthIndicatorProps) {
  const strength = calculatePasswordStrength(password);
  
  // Don't show anything if password is empty
  if (password.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <motion.div
              key={level}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, delay: level * 0.05 }}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                strength.score >= level ? strength.color : 'bg-muted'
              }`}
            />
          ))}
        </div>
        {strength.label && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.2 }}
            className={`text-xs font-medium ${
              strength.score === 1 ? 'text-red-500' :
              strength.score === 2 ? 'text-orange-500' :
              strength.score === 3 ? 'text-yellow-600' :
              strength.score === 4 ? 'text-green-500' :
              'text-muted-foreground'
            }`}
          >
            {strength.label}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}