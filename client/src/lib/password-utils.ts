/**
 * Utility functions for password validation and strength checking
 */

export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  requirements: PasswordRequirements;
}

/**
 * Check if password meets minimum length requirement
 */
export function hasMinLength(password: string, minLength: number = 8): boolean {
  return password.length >= minLength;
}

/**
 * Check if password contains at least one uppercase letter
 */
export function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

/**
 * Check if password contains at least one lowercase letter
 */
export function hasLowercase(password: string): boolean {
  return /[a-z]/.test(password);
}

/**
 * Check if password contains at least one number
 */
export function hasNumber(password: string): boolean {
  return /[0-9]/.test(password);
}

/**
 * Check if password contains at least one special character
 */
export function hasSpecialChar(password: string): boolean {
  return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
}

/**
 * Get all password requirements status
 */
export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: hasMinLength(password),
    hasUppercase: hasUppercase(password),
    hasLowercase: hasLowercase(password),
    hasNumber: hasNumber(password),
    hasSpecial: hasSpecialChar(password),
  };
}

/**
 * Calculate password strength score (0-4)
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements = getPasswordRequirements(password);
  
  // Count how many requirements are met
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  
  // Calculate score based on requirements met
  let score = 0;
  
  if (password.length === 0) {
    score = 0;
  } else if (metRequirements <= 1) {
    score = 1; // Very weak
  } else if (metRequirements === 2) {
    score = 2; // Weak
  } else if (metRequirements === 3) {
    score = 3; // Medium
  } else if (metRequirements >= 4) {
    score = 4; // Strong
  }
  
  // Define labels and colors based on score
  const strengthLabels = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte'];
  const strengthColors = [
    'bg-muted',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
  ];
  
  return {
    score,
    label: strengthLabels[score],
    color: strengthColors[score],
    requirements,
  };
}

/**
 * Check if password is valid (meets minimum requirements)
 */
export function isPasswordValid(password: string): boolean {
  const requirements = getPasswordRequirements(password);
  return requirements.minLength && 
         requirements.hasUppercase && 
         requirements.hasLowercase && 
         requirements.hasNumber;
}