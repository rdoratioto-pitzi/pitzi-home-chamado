const MacGyverIcon = ({ size = 64 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="#4ade80"/>
      <rect x="24" y="26" width="16" height="20" rx="2" fill="#dc2626" stroke="white" strokeWidth="2"/>
      <rect x="30" y="32" width="4" height="8" fill="white"/>
      <rect x="28" y="34" width="8" height="4" fill="white"/>
      <path d="M40 30L48 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 36L48 40" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="32" cy="24" r="2" fill="white"/>
    </svg>
  );
};

export default MacGyverIcon;
